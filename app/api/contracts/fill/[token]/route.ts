import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mammoth from "mammoth";
import { prisma } from "@/lib/db";
import { LocalStorageProvider } from "@/lib/storage/storage-provider";
import { updateDraftContract } from "@/lib/contracts/contract-service";
import {
  extractDropdownsAndSiblingsFromDocx,
  extractVariableNamesFromDocx,
} from "@/lib/contracts/docx-generator";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

    interface FillContract {
      id: string;
      status: string;
      variables: unknown;
      template: { name: string; variableDefinitions: unknown; fileContent?: Buffer | Uint8Array; previewPdfContent?: Buffer | Uint8Array | null };
      signers: unknown[];
    }
    let contract: FillContract | null;
    try {
      contract = await prisma.contract.findUnique({
        where: { draftEditToken: token },
        include: { template: { select: { name: true, variableDefinitions: true, fileContent: true, previewPdfContent: true } }, signers: { orderBy: { signingOrder: "asc" } } },
      }) as FillContract | null;
    } catch {
      contract = await prisma.contract.findUnique({
        where: { draftEditToken: token },
        include: { template: { select: { name: true, variableDefinitions: true, fileContent: true } }, signers: { orderBy: { signingOrder: "asc" } } },
      }) as FillContract | null;
    }
    if (!contract) return NextResponse.json({ error: "Link invalid sau expirat" }, { status: 404 });
    if (contract.status !== "DRAFT") {
      return NextResponse.json({ error: "Contractul a fost deja finalizat." }, { status: 403 });
    }

    const vars = contract.variables as Record<string, unknown>;
    const variables: Record<string, string> = {};
    for (const [k, v] of Object.entries(vars)) {
      variables[k] = typeof v === "string" ? v : String(v ?? "");
    }

    let content: string | undefined;
    const template = contract.template as { name: string; variableDefinitions: unknown; fileContent?: Buffer | Uint8Array; previewPdfContent?: Buffer | Uint8Array | null };
    if (template.fileContent && template.fileContent.length > 0) {
      try {
        const buf = Buffer.isBuffer(template.fileContent)
          ? template.fileContent
          : Buffer.from(template.fileContent as ArrayLike<number>);
        const result = await mammoth.convertToHtml({ buffer: buf });
        content = result.value?.trim() ? result.value : undefined;
      } catch {
        content = undefined;
      }
    }

    const hasPreviewDocx = Boolean(template.previewPdfContent && template.previewPdfContent.length > 0);

    let dropdownOptions: Record<string, string[]> = {};
    let dropdownSiblings: Record<string, string> = {};
    let varOrder: string[] = [];
    if (template.fileContent && template.fileContent.length > 0) {
      try {
        const buf = Buffer.isBuffer(template.fileContent)
          ? template.fileContent
          : Buffer.from(template.fileContent as ArrayLike<number>);
        const meta = extractDropdownsAndSiblingsFromDocx(buf);
        dropdownOptions = meta.dropdownOptions;
        dropdownSiblings = meta.dropdownSiblings;
        varOrder = extractVariableNamesFromDocx(buf);
      } catch {
        // ignore
      }
    }
    const defNames = (Array.isArray(template.variableDefinitions)
      ? template.variableDefinitions
      : []
    ).map((d: { name: string }) => d.name);
    const orderSet = new Set(varOrder);
    for (const n of defNames) {
      if (!orderSet.has(n)) {
        varOrder.push(n);
        orderSet.add(n);
      }
    }

    let signingLink: string | null = null;
    const signers = contract.signers as Array<{ token: string }>;
    if (signers?.length) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
      const firstSigner = signers[0];
      if (firstSigner?.token) {
        signingLink = baseUrl ? `${baseUrl}/sign/${firstSigner.token}` : `/sign/${firstSigner.token}`;
      }
    }

    return NextResponse.json({
      contractId: contract.id,
      templateName: template.name,
      variableDefinitions: template.variableDefinitions ?? undefined,
      variables,
      content,
      hasPreviewDocx,
      dropdownOptions,
      dropdownSiblings,
      varOrder,
      signingLink,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Eroare la încărcare";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const patchSchema = z.object({
  variables: z.record(z.string(), z.unknown()),
  signerFullName: z.string().optional(),
  signerEmail: z.string().email().optional(),
  signerRole: z.enum(["teacher", "student", "guardian"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const contract = await prisma.contract.findUnique({
    where: { draftEditToken: token },
    include: { template: true, signers: { orderBy: { signingOrder: "asc" } } },
  });
  if (!contract) return NextResponse.json({ error: "Link invalid sau expirat" }, { status: 404 });
  if (contract.status !== "DRAFT") {
    return NextResponse.json({ error: "Contractul a fost deja finalizat." }, { status: 403 });
  }

  const variables = parsed.data.variables as Record<string, string>;
  const signers =
    parsed.data.signerFullName && parsed.data.signerEmail
      ? [
          {
            fullName: parsed.data.signerFullName,
            email: parsed.data.signerEmail,
            role: (parsed.data.signerRole ?? "student") as "teacher" | "student" | "guardian",
          },
        ]
      : undefined;

  try {
    const storageProvider = new LocalStorageProvider();
    await updateDraftContract({
      prisma,
      storageProvider,
      contractId: contract.id,
      variables,
      signers,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Eroare la salvare";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  let signingLink: string | null = null;
  if (signers?.length) {
    const signer = await prisma.signer.findFirst({
      where: { contractId: contract.id },
      orderBy: { signingOrder: "asc" },
      select: { token: true },
    });
    if (signer) {
      signingLink = baseUrl ? `${baseUrl}/sign/${signer.token}` : `/sign/${signer.token}`;
    }
  }

  return NextResponse.json({ success: true, contractId: contract.id, signingLink });
}
