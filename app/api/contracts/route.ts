import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createContract } from "@/lib/contracts/contract-service";
import { prisma } from "@/lib/db";
import { LocalStorageProvider } from "@/lib/storage/storage-provider";
import {
  TemplateNotFoundError,
  TemplateRenderError,
  PdfGenerationError,
  StorageError,
} from "@/lib/contracts/errors";
import { sourceToHtml, isHtmlContent, wrapFragmentInDocument } from "@/lib/contracts/source-to-html";

export const runtime = "nodejs";

const createContractSchema = z.object({
  templateId: z.string().min(1),
  variables: z.record(z.string(), z.unknown()),
});

export type CreateContractResponse =
  | { success: true; contractId: string; contract: unknown }
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
  const content = isHtmlContent(template.content)
    ? wrapFragmentInDocument(template.content)
    : sourceToHtml(template.content);
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

  const { templateId, variables } = parsed.data;
  const storageProvider = new LocalStorageProvider();

  try {
    const { contract, pdfBuffer } = await createContract({
      prisma,
      storageProvider,
      templateId,
      variables,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="contract.pdf"',
        "X-Contract-Id": contract.id,
      },
    });
  } catch (error) {
    const { status, body: errorBody } = errorToStatusAndBody(error);
    return NextResponse.json(errorBody, { status });
  }
}
