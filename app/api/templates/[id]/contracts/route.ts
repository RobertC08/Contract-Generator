import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: templateId } = await params;
  if (!templateId) {
    return NextResponse.json({ error: "Template ID required" }, { status: 400 });
  }

  const template = await prisma.contractTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, name: true },
  });
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const contracts = await prisma.contract.findMany({
    where: { templateId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      pdfUrl: true,
      createdAt: true,
      _count: { select: { signers: true } },
    },
  });

  return NextResponse.json({
    template: { id: template.id, name: template.name },
    contracts: contracts.map((c) => ({
      id: c.id,
      status: c.status,
      pdfUrl: c.pdfUrl,
      createdAt: c.createdAt,
      signersCount: c._count.signers,
    })),
  });
}
