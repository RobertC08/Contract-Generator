import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { VariableDefinitions } from "@/lib/contracts/variable-definitions";
import { variableDefinitionsSchema } from "@/lib/contracts/variable-definitions";

export async function GET() {
  const templates = await prisma.contractTemplate.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, version: true, createdAt: true },
  });
  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "Invalid form data" }, { status: 400 });
  }

  const name = formData.get("name");
  const file = formData.get("file") as File | null;
  const previewDocx = formData.get("previewDocx") as File | null;
  const variableDefinitionsRaw = formData.get("variableDefinitions");

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ message: "Numele este obligatoriu" }, { status: 400 });
  }
  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ message: "Fișierul DOCX este obligatoriu" }, { status: 400 });
  }
  const contentType = file.type;
  if (
    contentType !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
    !file.name.toLowerCase().endsWith(".docx")
  ) {
    return NextResponse.json({ message: "Doar fișiere .docx sunt acceptate" }, { status: 400 });
  }

  let variableDefinitions: VariableDefinitions | undefined;
  if (variableDefinitionsRaw != null && variableDefinitionsRaw !== "") {
    try {
      const parsed = JSON.parse(String(variableDefinitionsRaw));
      const validated = variableDefinitionsSchema.safeParse(parsed);
      if (validated.success) {
        variableDefinitions = validated.data;
      }
    } catch {
      // ignore invalid JSON
    }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const createData: Parameters<typeof prisma.contractTemplate.create>[0]["data"] = {
      name: name.trim(),
      fileContent: buffer,
      version: 1,
      variableDefinitions: variableDefinitions ?? undefined,
    };
    if (previewDocx && previewDocx instanceof File && previewDocx.size > 0) {
      const docxType = previewDocx.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || previewDocx.name.toLowerCase().endsWith(".docx");
      if (docxType) {
        createData.previewPdfContent = Buffer.from(await previewDocx.arrayBuffer()) as unknown as Parameters<typeof prisma.contractTemplate.create>[0]["data"]["previewPdfContent"];
      }
    }
    const template = await prisma.contractTemplate.create({
      data: createData,
      select: { id: true, name: true, version: true },
    });
    return NextResponse.json(template);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Eroare la salvare";
    return NextResponse.json({ message }, { status: 500 });
  }
}
