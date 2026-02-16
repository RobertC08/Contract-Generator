import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { renderDocx } from "@/lib/contracts/docx-generator";
import type { VariableDefinitions } from "@/lib/contracts/variable-definitions";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const contract = await prisma.contract.findUnique({
    where: { draftEditToken: token },
    select: {
      id: true,
      status: true,
      templateId: true,
      template: {
        select: { fileContent: true, variableDefinitions: true, previewPdfContent: true },
      },
    },
  });

  if (!contract) return NextResponse.json({ error: "Link invalid sau expirat" }, { status: 404 });
  if (contract.status !== "DRAFT") {
    return NextResponse.json({ error: "Contractul a fost deja finalizat." }, { status: 403 });
  }

  const template = contract.template as {
    fileContent: Buffer | Uint8Array;
    variableDefinitions?: VariableDefinitions | null;
    previewPdfContent?: Buffer | Uint8Array | null;
  };
  let previewBuf: Buffer | Uint8Array | null = template.previewPdfContent ?? null;

  if (!previewBuf || (previewBuf as Buffer).length === 0) {
    try {
      const rows = await prisma.$queryRaw<[{ previewPdfContent: Buffer | null }]>`
        SELECT "previewPdfContent" FROM "ContractTemplate" WHERE id = ${contract.templateId}
      `;
      const raw = rows[0]?.previewPdfContent;
      if (raw && raw.length > 0) previewBuf = raw;
    } catch {
      // ignore
    }
  }

  const hasPreview = Boolean(previewBuf && (previewBuf as Buffer).length > 0);

  if (hasPreview) {
    const buffer = Buffer.isBuffer(previewBuf) ? previewBuf : Buffer.from(previewBuf as ArrayLike<number>);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'inline; filename="preview.docx"',
      },
    });
  }

  if (!template.fileContent || template.fileContent.length === 0) {
    return NextResponse.json({ error: "Template fără conținut" }, { status: 404 });
  }

  const templateBuffer = Buffer.isBuffer(template.fileContent)
    ? template.fileContent
    : Buffer.from(template.fileContent as ArrayLike<number>);
  const variableDefinitions = Array.isArray(template.variableDefinitions) ? template.variableDefinitions : undefined;
  const allVarNames = (variableDefinitions ?? []).map((d) => d.name);
  const data: Record<string, unknown> = {};
  for (const name of allVarNames) {
    data[name] = "";
  }
  const signatureVarNames = (variableDefinitions ?? []).filter((d) => d.type === "signature").map((d) => d.name);
  for (const name of signatureVarNames) {
    delete data[name];
  }

  try {
    const docxBuffer = renderDocx(templateBuffer, data, variableDefinitions);
    return new NextResponse(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'inline; filename="preview.docx"',
      },
    });
  } catch {
    return NextResponse.json({ error: "Eroare la generarea previzualizării" }, { status: 500 });
  }
}
