import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { renderDocx } from "@/lib/contracts/docx-generator";
import type { VariableDefinitions } from "@/lib/contracts/variable-definitions";
import { addDays, formatDateToDisplay } from "@/lib/contracts/variable-utils";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const contract = await prisma.contract.findUnique({
    where: { draftEditToken: token },
    include: { template: { select: { fileContent: true, variableDefinitions: true } } },
  });
  if (!contract) return NextResponse.json({ error: "Link invalid sau expirat" }, { status: 404 });
  if (contract.status !== "DRAFT") {
    return NextResponse.json({ error: "Contractul a fost deja finalizat." }, { status: 403 });
  }

  const template = contract.template as { fileContent?: Buffer | Uint8Array; variableDefinitions?: VariableDefinitions | null };
  if (!template.fileContent || template.fileContent.length === 0) {
    return NextResponse.json({ error: "Template fără conținut" }, { status: 404 });
  }

  const templateBuffer = Buffer.isBuffer(template.fileContent)
    ? template.fileContent
    : Buffer.from(template.fileContent as ArrayLike<number>);
  const variableDefinitions = Array.isArray(template.variableDefinitions) ? template.variableDefinitions : undefined;
  const existingVars = (contract.variables ?? {}) as Record<string, unknown>;
  const data: Record<string, unknown> = { ...existingVars };
  for (const d of variableDefinitions ?? []) {
    if (!(d.name in data)) data[d.name] = "";
  }
  const signatureVarNames = (variableDefinitions ?? []).filter((d) => d.type === "signature").map((d) => d.name);
  for (const name of signatureVarNames) {
    delete data[name];
  }
  const dataStr = data["Data"];
  if (dataStr && typeof dataStr === "string" && dataStr.trim() && !data["Data_final_un_an"]) {
    const iso = addDays(dataStr.trim(), 365);
    if (iso) data["Data_final_un_an"] = formatDateToDisplay(iso);
  }

  try {
    const docxBuffer = renderDocx(templateBuffer, data, variableDefinitions);
    return new NextResponse(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'inline; filename="contract.docx"',
      },
    });
  } catch {
    return NextResponse.json({ error: "Eroare la generarea documentului" }, { status: 500 });
  }
}
