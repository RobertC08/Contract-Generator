import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const createTemplateSchema = z.object({
  name: z.string().min(1, "Numele este obligatoriu"),
  content: z.string(),
});

export async function GET() {
  const templates = await prisma.contractTemplate.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, version: true, createdAt: true },
  });
  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { message: first?.message ?? "Date invalide" },
      { status: 400 }
    );
  }

  const template = await prisma.contractTemplate.create({
    data: {
      name: parsed.data.name,
      content: parsed.data.content,
      version: 1,
    },
    select: { id: true, name: true, version: true },
  });

  return NextResponse.json(template);
}
