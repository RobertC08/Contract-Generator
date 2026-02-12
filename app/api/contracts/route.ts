import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createContract, createShareableDraft } from "@/lib/contracts/contract-service";
import { prisma } from "@/lib/db";
import { LocalStorageProvider } from "@/lib/storage/storage-provider";
import {
  TemplateNotFoundError,
  TemplateRenderError,
  PdfGenerationError,
  StorageError,
  ContractSignedError,
} from "@/lib/contracts/errors";
import { sourceToHtml, isHtmlContent, wrapFragmentInDocument } from "@/lib/contracts/source-to-html";

export const runtime = "nodejs";

const signerInputSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(["teacher", "student", "guardian"]).optional(),
  signingOrder: z.number().int().min(0).optional(),
});

const createContractSchema = z.object({
  templateId: z.string().min(1),
  variables: z.record(z.string(), z.unknown()).optional(),
  signers: z.array(signerInputSchema).min(1).optional(),
  shareableLink: z.boolean().optional(),
});

export type CreateContractResponse =
  | { success: true; contractId: string; signingLinks: { signerId: string; email: string; signingLink: string }[] }
  | { success: false; message: string; code?: string };

function errorToStatusAndBody(
  error: unknown
): { status: number; body: CreateContractResponse } {
  if (error instanceof TemplateNotFoundError) {
    return { status: 404, body: { success: false, message: error.message, code: "TEMPLATE_NOT_FOUND" } };
  }
  if (error instanceof TemplateRenderError) {
    return { status: 400, body: { success: false, message: error.message, code: "TEMPLATE_RENDER_ERROR" } };
  }
  if (error instanceof PdfGenerationError) {
    return { status: 500, body: { success: false, message: error.message, code: "PDF_GENERATION_ERROR" } };
  }
  if (error instanceof StorageError) {
    return { status: 500, body: { success: false, message: error.message, code: "STORAGE_ERROR" } };
  }
  if (error instanceof ContractSignedError) {
    return { status: 409, body: { success: false, message: error.message, code: "CONTRACT_SIGNED" } };
  }
  const message = error instanceof Error ? error.message : "Internal server error";
  return { status: 500, body: { success: false, message } };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const templateId = searchParams.get("templateId");
  if (!templateId) {
    return NextResponse.json({ message: "templateId required" }, { status: 400 });
  }
  const template = await prisma.contractTemplate.findUnique({
    where: { id: templateId },
    select: { content: true, variableDefinitions: true },
  });
  if (!template) {
    return NextResponse.json({ message: "Template not found" }, { status: 404 });
  }
  let content = isHtmlContent(template.content)
    ? wrapFragmentInDocument(template.content)
    : sourceToHtml(template.content);
  const defs = template.variableDefinitions as Array<{ name: string; type?: string }> | null;
  if (defs?.length) {
    const regex = /<span[^>]*data-variable="(\w+)"[^>]*>[\s\S]*?<\/span>/gi;
    content = content.replace(regex, (_, name: string) => {
      const def = defs.find((d) => d.name === name);
      return def?.type === "signature" ? `{{{${name}}}}` : `{{${name}}}`;
    });
  }
  return NextResponse.json({
    content,
    variableDefinitions: template.variableDefinitions ?? undefined,
  });
}

export async function POST(request: NextRequest) {
  if (request.method !== "POST") {
    return NextResponse.json(
      { success: false, message: "Method not allowed" },
      { status: 405 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON" },
      { status: 400 }
    );
  }

  const parsed = createContractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.message },
      { status: 400 }
    );
  }

  const { templateId, variables: vars, signers: signersInput, shareableLink } = parsed.data;

  if (shareableLink) {
    try {
      const { contract, fillToken } = await createShareableDraft({ prisma, templateId });
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
      const fillLink = baseUrl ? `${baseUrl}/contract/fill/${fillToken}` : `/contract/fill/${fillToken}`;
      return NextResponse.json({
        success: true,
        contractId: contract.id,
        fillLink,
        shareableLink: true,
      });
    } catch (error) {
      const { status, body: errorBody } = errorToStatusAndBody(error);
      return NextResponse.json(errorBody, { status });
    }
  }

  const variables = vars ?? {};
  const storageProvider = new LocalStorageProvider();
  const signers = signersInput?.length
    ? signersInput.map((s) => ({
        fullName: s.fullName,
        email: s.email,
        phone: s.phone,
        role: s.role ?? "student",
        signingOrder: s.signingOrder,
      }))
    : [{ fullName: "Signer", email: "signer@example.com", role: "student" as const }];

  try {
    const { contract, signers: signersWithLinks } = await createContract({
      prisma,
      storageProvider,
      templateId,
      variables,
      signers,
    });

    return NextResponse.json({
      success: true,
      contractId: contract.id,
      signingLinks: signersWithLinks.map((s) => ({
        signerId: s.id,
        email: s.email,
        signingLink: s.signingLink,
      })),
    });
  } catch (error) {
    const { status, body: errorBody } = errorToStatusAndBody(error);
    return NextResponse.json(errorBody, { status });
  }
}
