import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const updateTemplateSchema = z.object({
  name: z.string().min(1, "Numele este obligatoriu"),
  content: z.string(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const template = await prisma.contractTemplate.findUnique({
    where: { id },
    select: { id: true, name: true, content: true, version: true },
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

  const template = await prisma.contractTemplate.update({
    where: { id },
    data: {
      name: parsed.data.name,
      content: parsed.data.content,
      version: existing.version + 1,
    },
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
