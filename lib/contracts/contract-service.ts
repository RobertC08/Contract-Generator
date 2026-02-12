import { createHash, randomBytes } from "crypto";
import type { Contract, PrismaClient } from "@prisma/client";
import type { StorageProvider } from "@/lib/storage/storage-provider";
import {
  TemplateNotFoundError,
  PdfGenerationError,
  StorageError,
  ContractSignedError,
} from "./errors";
import { renderTemplate } from "./template-engine";
import { generatePdf } from "./pdf-generator";
import { sourceToHtml, isHtmlContent, wrapFragmentInDocument } from "./source-to-html";

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
  pdfBuffer: Buffer;
  signers: Array<{ id: string; email: string; fullName: string; token: string; signingLink: string }>;
};

const SIGNING_TOKEN_EXPIRY_HOURS = 72;

function computeDocumentHash(pdfBuffer: Buffer): string {
  return createHash("sha256").update(pdfBuffer).digest("hex");
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
    console.error("[createContract] Template not found:", templateId);
    throw new TemplateNotFoundError(templateId);
  }

  const rawContent = template.content;
  const contentForRender = isHtmlContent(rawContent)
    ? wrapFragmentInDocument(rawContent)
    : sourceToHtml(rawContent);
  const variableDefinitions = (template.variableDefinitions ?? []) as Array<{ name: string; type: string }>;
  const renderVars = { ...variables };
  for (const def of variableDefinitions) {
    if (def.type === "signature") {
      const v = renderVars[def.name];
      if (typeof v === "string" && v.length > 0 && v.startsWith("data:image")) {
        renderVars[def.name] = `<img src="${v}" alt="Semnătură" class="signature-img" style="max-width: 200px; max-height: 100px; width: auto; height: auto;" />`;
      }
    }
  }
  let html: string;
  try {
    html = renderTemplate(contentForRender, renderVars);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[createContract] Template render failed:", message);
    throw e;
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generatePdf(html);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[createContract] PDF generation failed:", message);
    throw new PdfGenerationError(message);
  }

  const documentHash = computeDocumentHash(pdfBuffer);
  const key = `contract-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  let pdfUrl: string;
  try {
    pdfUrl = await storageProvider.save(key, pdfBuffer);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[createContract] Storage failed:", message);
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
      pdfUrl,
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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  const signersWithLinks = contract.signers.map((s) => ({
    ...s,
    signingLink: baseUrl ? `${baseUrl}/sign/${s.token}` : `/sign/${s.token}`,
  }));

  return { contract, pdfBuffer, signers: signersWithLinks };
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
  const rawContent = template.content;
  const contentForRender = isHtmlContent(rawContent)
    ? wrapFragmentInDocument(rawContent)
    : sourceToHtml(rawContent);
  const variableDefinitions = (template.variableDefinitions ?? []) as Array<{ name: string; type: string }>;
  const renderVars = { ...variables };
  for (const def of variableDefinitions) {
    if (def.type === "signature") {
      const v = renderVars[def.name];
      if (typeof v === "string" && v.length > 0 && v.startsWith("data:image")) {
        renderVars[def.name] = `<img src="${v}" alt="Semnătură" class="signature-img" style="max-width: 200px; max-height: 100px; width: auto; height: auto;" />`;
      }
    }
  }
  let html: string;
  try {
    html = renderTemplate(contentForRender, renderVars);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[updateDraftContract] Template render failed:", message);
    throw e;
  }
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generatePdf(html);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[updateDraftContract] PDF generation failed:", message);
    throw new PdfGenerationError(message);
  }
  const documentHash = computeDocumentHash(pdfBuffer);
  const key = `contract-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  let pdfUrl: string;
  try {
    pdfUrl = await storageProvider.save(key, pdfBuffer);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new StorageError(message);
  }
  const updated = await prisma.contract.update({
    where: { id: contractId },
    data: { variables: variables as object, pdfUrl, documentHash },
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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  const signersWithLinks = signersList.map((s) => ({
    ...s,
    signingLink: baseUrl ? `${baseUrl}/sign/${s.token}` : `/sign/${s.token}`,
  }));
  return { contract: refreshed ?? updated, signers: signersWithLinks };
}

export type RegenerateContractPdfParams = {
  prisma: PrismaClient;
  storageProvider: StorageProvider;
  contractId: string;
};

export async function regenerateContractPdf({
  prisma,
  storageProvider,
  contractId,
}: RegenerateContractPdfParams): Promise<void> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { template: true },
  });
  if (!contract) throw new TemplateNotFoundError(contractId);

  const variables = (contract.variables ?? {}) as Record<string, unknown>;
  const template = contract.template;
  const rawContent = template.content;
  const contentForRender = isHtmlContent(rawContent)
    ? wrapFragmentInDocument(rawContent)
    : sourceToHtml(rawContent);
  const variableDefinitions = (template.variableDefinitions ?? []) as Array<{ name: string; type: string }>;
  const renderVars = { ...variables };
  for (const def of variableDefinitions) {
    if (def.type === "signature") {
      const v = renderVars[def.name];
      if (typeof v === "string" && v.length > 0 && v.startsWith("data:image")) {
        renderVars[def.name] = `<img src="${v}" alt="Semnătură" class="signature-img" style="max-width: 200px; max-height: 100px; width: auto; height: auto;" />`;
      }
    }
  }
  const html = renderTemplate(contentForRender, renderVars);
  const pdfBuffer = await generatePdf(html);
  const documentHash = computeDocumentHash(pdfBuffer);
  const key = `contract-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const pdfUrl = await storageProvider.save(key, pdfBuffer);
  await prisma.contract.update({
    where: { id: contractId },
    data: { pdfUrl, documentHash },
  });
}
