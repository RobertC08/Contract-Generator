import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractVariableNamesFromDocx } from "@/lib/contracts/docx-generator";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const template = await prisma.contractTemplate.findUnique({
    where: { id },
    select: { fileContent: true },
  });
  if (!template?.fileContent || template.fileContent.length === 0) {
    return NextResponse.json({ message: "Template fără conținut" }, { status: 404 });
  }
  try {
    const buffer = Buffer.isBuffer(template.fileContent)
      ? template.fileContent
      : Buffer.from(template.fileContent as ArrayLike<number>);
    const variableNames = extractVariableNamesFromDocx(buffer);
    return NextResponse.json({ variableNames });
  } catch {
    return NextResponse.json({ message: "Eroare la citirea documentului" }, { status: 500 });
  }
}
