import { createHash, randomBytes } from "crypto";
import type { Contract, PrismaClient } from "@prisma/client";
import type { StorageProvider } from "@/lib/storage/storage-provider";
import {
  TemplateNotFoundError,
  StorageError,
  ContractSignedError,
} from "./errors";
import { renderDocx } from "./docx-generator";
import type { VariableDefinitions } from "./variable-definitions";

export type SignerInput = {
  fullName: string;
  email: string;
  phone?: string;
  role?: "teacher" | "student" | "guardian";
  signingOrder?: number;
};

export type CreateContractParams = {
  prisma: PrismaClient;
  storageProvider: StorageProvider;
  templateId: string;
  variables: Record<string, unknown>;
  signers: SignerInput[];
};

export type CreateContractResult = {
  contract: Contract;
  docxBuffer: Buffer;
  signers: Array<{ id: string; email: string; fullName: string; token: string; signingLink: string }>;
};

const SIGNING_TOKEN_EXPIRY_HOURS = 72;

function computeDocumentHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function generateSigningToken(): string {
  return randomBytes(32).toString("base64url");
}

export function assertContractNotSigned(contract: { status: string; documentHash: string | null }): void {
  if (contract.status === "SIGNED" || contract.documentHash != null) {
    throw new ContractSignedError();
  }
}

export async function createContract({
  prisma,
  storageProvider,
  templateId,
  variables,
  signers: signersInput,
}: CreateContractParams): Promise<CreateContractResult> {
  const template = await prisma.contractTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) {
    throw new TemplateNotFoundError(templateId);
  }

  const templateBuffer = Buffer.from(template.fileContent);
  const variableDefinitions = Array.isArray(template.variableDefinitions)
    ? (template.variableDefinitions as VariableDefinitions)
    : undefined;
  const data = { ...variables };
  const signatureVarNames = (variableDefinitions ?? []).filter((d) => d.type === "signature").map((d) => d.name);
  for (const name of signatureVarNames) {
    delete data[name];
  }

  let docxBuffer: Buffer;
  try {
    docxBuffer = renderDocx(templateBuffer, data, variableDefinitions);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[createContract] DOCX render failed:", message);
    throw e;
  }

  const documentHash = computeDocumentHash(docxBuffer);
  const key = `contract-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.docx`;
  let documentUrl: string;
  try {
    documentUrl = await storageProvider.save(key, docxBuffer);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new StorageError(message);
  }

  const tokenExpiresAt = new Date(Date.now() + SIGNING_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  const signersData = signersInput.length > 0
    ? signersInput.map((s, i) => ({
        fullName: s.fullName,
        email: s.email,
        phone: s.phone ?? null,
        role: (s.role ?? "student") as "teacher" | "student" | "guardian",
        signingOrder: s.signingOrder ?? i,
        token: generateSigningToken(),
        tokenExpiresAt,
      }))
    : [{ fullName: "Signer", email: "signer@example.com", phone: null, role: "student" as const, signingOrder: 0, token: generateSigningToken(), tokenExpiresAt }];

  const contract = await prisma.contract.create({
    data: {
      templateId,
      variables: variables as object,
      documentUrl,
      status: "DRAFT",
      documentHash,
      templateVersion: template.version,
      signers: {
        create: signersData.map((s) => ({
          fullName: s.fullName,
          email: s.email,
          phone: s.phone,
          role: s.role,
          signingOrder: s.signingOrder,
          token: s.token,
          tokenExpiresAt: s.tokenExpiresAt,
        })),
      },
    },
    include: { signers: true },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const signersWithLinks = contract.signers.map((s) => ({
    ...s,
    signingLink: baseUrl ? `${baseUrl}/sign/${s.token}` : `/sign/${s.token}`,
  }));

  return { contract, docxBuffer, signers: signersWithLinks };
}

export type CreateShareableDraftParams = {
  prisma: PrismaClient;
  templateId: string;
};

export type CreateShareableDraftResult = {
  contract: Contract;
  fillToken: string;
};

export async function createShareableDraft({
  prisma,
  templateId,
}: CreateShareableDraftParams): Promise<CreateShareableDraftResult> {
  const template = await prisma.contractTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) throw new TemplateNotFoundError(templateId);

  const fillToken = randomBytes(32).toString("base64url");
  const tokenExpiresAt = new Date(Date.now() + SIGNING_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  const contract = await prisma.contract.create({
    data: {
      templateId,
      variables: {},
      status: "DRAFT",
      documentUrl: null,
      documentHash: null,
      templateVersion: template.version,
      draftEditToken: fillToken,
      signers: {
        create: {
          fullName: "—",
          email: "completare@placeholder.local",
          role: "student",
          signingOrder: 0,
          token: generateSigningToken(),
          tokenExpiresAt,
        },
      },
    },
  });
  return { contract, fillToken };
}

export type UpdateDraftContractParams = {
  prisma: PrismaClient;
  storageProvider: StorageProvider;
  contractId: string;
  variables: Record<string, unknown>;
  signers?: SignerInput[];
};

export type UpdateDraftContractResult = {
  contract: Contract;
  signers: Array<{ id: string; email: string; fullName: string; token: string; signingLink: string }>;
};

export async function updateDraftContract({
  prisma,
  storageProvider,
  contractId,
  variables,
  signers: signersInput,
}: UpdateDraftContractParams): Promise<UpdateDraftContractResult> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { template: true, signers: { orderBy: { signingOrder: "asc" } } },
  });
  if (!contract) throw new TemplateNotFoundError(contractId);
  if (contract.status !== "DRAFT") throw new ContractSignedError("Contractul este deja semnat sau trimis.");

  const template = contract.template;
  const templateBuffer = Buffer.from(template.fileContent);
  const variableDefinitions = Array.isArray(template.variableDefinitions)
    ? (template.variableDefinitions as VariableDefinitions)
    : undefined;
  const data = { ...variables };
  const signatureVarNames = (variableDefinitions ?? []).filter((d) => d.type === "signature").map((d) => d.name);
  for (const name of signatureVarNames) {
    delete data[name];
  }

  let docxBuffer: Buffer;
  try {
    docxBuffer = renderDocx(templateBuffer, data, variableDefinitions);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[updateDraftContract] DOCX render failed:", message);
    throw e;
  }

  const documentHash = computeDocumentHash(docxBuffer);
  const key = `contract-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.docx`;
  const documentUrl = await storageProvider.save(key, docxBuffer);

  const updated = await prisma.contract.update({
    where: { id: contractId },
    data: { variables: variables as object, documentUrl, documentHash },
    include: { signers: { orderBy: { signingOrder: "asc" } } },
  });

  if (signersInput && signersInput.length > 0) {
    for (let i = 0; i < signersInput.length && i < updated.signers.length; i++) {
      const s = signersInput[i]!;
      const existing = updated.signers[i];
      if (existing) {
        await prisma.signer.update({
          where: { id: existing.id },
          data: {
            fullName: s.fullName,
            email: s.email,
            phone: s.phone ?? null,
            role: (s.role ?? "student") as "teacher" | "student" | "guardian",
          },
        });
      }
    }
  }
  const refreshed = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { signers: true },
  });
  const signersList = refreshed?.signers ?? updated.signers;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const signersWithLinks = signersList.map((s) => ({
    ...s,
    signingLink: baseUrl ? `${baseUrl}/sign/${s.token}` : `/sign/${s.token}`,
  }));
  return { contract: refreshed ?? updated, signers: signersWithLinks };
}

export type RegenerateContractDocumentParams = {
  prisma: PrismaClient;
  storageProvider: StorageProvider;
  contractId: string;
};

export async function regenerateContractDocument({
  prisma,
  storageProvider,
  contractId,
}: RegenerateContractDocumentParams): Promise<void> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { template: true },
  });
  if (!contract) throw new TemplateNotFoundError(contractId);

  const variables = (contract.variables ?? {}) as Record<string, unknown>;
  const template = contract.template;
  const templateBuffer = Buffer.from(template.fileContent);
  const variableDefinitions = Array.isArray(template.variableDefinitions)
    ? (template.variableDefinitions as VariableDefinitions)
    : undefined;

  const docxBuffer = renderDocx(templateBuffer, variables, variableDefinitions);
  const documentHash = computeDocumentHash(docxBuffer);
  const key = `contract-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.docx`;
  const documentUrl = await storageProvider.save(key, docxBuffer);
  await prisma.contract.update({
    where: { id: contractId },
    data: { documentUrl, documentHash },
  });
}
