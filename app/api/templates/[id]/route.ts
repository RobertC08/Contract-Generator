import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { VariableDefinitions } from "@/lib/contracts/variable-definitions";
import { variableDefinitionsSchema } from "@/lib/contracts/variable-definitions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const template = await prisma.contractTemplate.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        version: true,
        variableDefinitions: true,
        previewPdfContent: true,
      },
    });
    if (!template) {
      return NextResponse.json({ message: "Template negăsit" }, { status: 404 });
    }
    const t = template as { previewPdfContent?: Buffer | Uint8Array | null };
    const hasPreviewDocx = Boolean(t.previewPdfContent && t.previewPdfContent.length > 0);
    const { previewPdfContent: _preview, ...rest } = template;
    return NextResponse.json({ ...rest, hasPreviewDocx });
  } catch {
    const template = await prisma.contractTemplate.findUnique({
      where: { id },
      select: { id: true, name: true, version: true, variableDefinitions: true },
    });
    if (!template) {
      return NextResponse.json({ message: "Template negăsit" }, { status: 404 });
    }
    return NextResponse.json({ ...template, hasPreviewDocx: false });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "Invalid form data" }, { status: 400 });
  }

  const name = formData.get("name");
  const file = formData.get("file") as File | null;
  const previewDocx = formData.get("previewDocx") as File | null;
  const clearPreviewDocx = formData.get("clearPreviewDocx") === "true" || formData.get("clearPreviewDocx") === "1";
  const variableDefinitionsRaw = formData.get("variableDefinitions");

  const existing = await prisma.contractTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: "Template negăsit" }, { status: 404 });
  }

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ message: "Numele este obligatoriu" }, { status: 400 });
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
      // ignore
    }
  }

  const updateData: Prisma.ContractTemplateUpdateInput = {
    name: name.trim(),
    version: existing.version + 1,
    ...(variableDefinitions !== undefined && { variableDefinitions: variableDefinitions as Prisma.InputJsonValue }),
  };
  if (file && file instanceof File && file.size > 0) {
    const ok =
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.toLowerCase().endsWith(".docx");
    if (ok) {
      updateData.fileContent = new Uint8Array(await file.arrayBuffer()) as unknown as Prisma.ContractTemplateUpdateInput["fileContent"];
    }
  }
  if (clearPreviewDocx) {
    updateData.previewPdfContent = null;
  } else {
    const previewFile = formData.get("previewDocx") as File | null;
    if (previewFile && previewFile instanceof File && previewFile.size > 0) {
      const isDocx =
        previewFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        previewFile.name.toLowerCase().endsWith(".docx");
      if (isDocx) {
        updateData.previewPdfContent = new Uint8Array(await previewFile.arrayBuffer()) as unknown as Prisma.ContractTemplateUpdateInput["previewPdfContent"];
      }
    }
  }

  try {
    const template = await prisma.contractTemplate.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, version: true },
    });
    return NextResponse.json(template);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Eroare la salvare";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await prisma.contractTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: "Template negăsit" }, { status: 404 });
  }

  await prisma.contract.deleteMany({ where: { templateId: id } });
  await prisma.contractTemplate.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
