import { Contract, PrismaClient } from "@prisma/client";
import type { StorageProvider } from "@/lib/storage/storage-provider";
import {
  TemplateNotFoundError,
  PdfGenerationError,
  StorageError,
} from "./errors";
import { renderTemplate } from "./template-engine";
import { generatePdf } from "./pdf-generator";
import { sourceToHtml, isHtmlContent } from "./source-to-html";

export type CreateContractParams = {
  prisma: PrismaClient;
  storageProvider: StorageProvider;
  templateId: string;
  variables: Record<string, unknown>;
};

export type CreateContractResult = {
  contract: Contract;
  pdfBuffer: Buffer;
};

export async function createContract({
  prisma,
  storageProvider,
  templateId,
  variables,
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
    ? rawContent
    : sourceToHtml(rawContent);
  let html: string;
  try {
    html = renderTemplate(contentForRender, variables);
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

  const key = `contract-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  let pdfUrl: string;
  try {
    pdfUrl = await storageProvider.save(key, pdfBuffer);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[createContract] Storage failed:", message);
    throw new StorageError(message);
  }

  const contract = await prisma.contract.create({
    data: {
      templateId,
      variables: variables as object,
      pdfUrl,
    },
  });

  return { contract, pdfBuffer };
}
