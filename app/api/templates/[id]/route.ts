import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  variableDefinitionsSchema,
  type VariableDefinitions,
} from "@/lib/contracts/variable-definitions";

const updateTemplateSchema = z.object({
  name: z.string().min(1, "Numele este obligatoriu"),
  content: z.string(),
  variableDefinitions: variableDefinitionsSchema.optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const template = await prisma.contractTemplate.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      content: true,
      version: true,
      variableDefinitions: true,
    },
  });
  if (!template) {
    return NextResponse.json({ message: "Template negăsit" }, { status: 404 });
  }
  return NextResponse.json(template);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { message: first?.message ?? "Date invalide" },
      { status: 400 }
    );
  }

  const existing = await prisma.contractTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: "Template negăsit" }, { status: 404 });
  }

  const updateData: {
    name: string;
    content: string;
    version: number;
    variableDefinitions?: VariableDefinitions;
  } = {
    name: parsed.data.name,
    content: parsed.data.content,
    version: existing.version + 1,
  };
  if (parsed.data.variableDefinitions !== undefined) {
    updateData.variableDefinitions = parsed.data.variableDefinitions;
  }
  const template = await prisma.contractTemplate.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, version: true },
  });

  return NextResponse.json(template);
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
