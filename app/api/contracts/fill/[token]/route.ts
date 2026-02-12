import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { LocalStorageProvider } from "@/lib/storage/storage-provider";
import { updateDraftContract } from "@/lib/contracts/contract-service";
import { sourceToHtml, isHtmlContent, wrapFragmentInDocument } from "@/lib/contracts/source-to-html";

export const runtime = "nodejs";

function chipsToPlaceholders(html: string, variableDefinitions: Array<{ name: string; type?: string }> | null): string {
  const defsByName = new Map((variableDefinitions ?? []).map((d) => [d.name, d]));
  const regex = /<span[^>]*data-variable="(\w+)"[^>]*>[\s\S]*?<\/span>/gi;
  return html.replace(regex, (_, name: string) => {
    const def = defsByName.get(name);
    return def?.type === "signature" ? `{{{${name}}}}` : `{{${name}}}`;
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const contract = await prisma.contract.findUnique({
    where: { draftEditToken: token },
    include: { template: true, signers: { orderBy: { signingOrder: "asc" } } },
  });
  if (!contract) return NextResponse.json({ error: "Link invalid sau expirat" }, { status: 404 });
  if (contract.status !== "DRAFT") {
    return NextResponse.json({ error: "Contractul a fost deja finalizat." }, { status: 403 });
  }

  const rawContent = contract.template.content;
  let content = isHtmlContent(rawContent)
    ? wrapFragmentInDocument(rawContent)
    : sourceToHtml(rawContent);
  content = chipsToPlaceholders(content, contract.template.variableDefinitions as Array<{ name: string; type?: string }> | null);
  const vars = contract.variables as Record<string, unknown>;
  const variables: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    variables[k] = typeof v === "string" ? v : String(v ?? "");
  }

  return NextResponse.json({
    contractId: contract.id,
    templateName: contract.template.name,
    content,
    variableDefinitions: contract.template.variableDefinitions ?? undefined,
    variables,
  });
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
