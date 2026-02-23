import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
        documentUrl: true,
        createdAt: true,
        parentContractId: true,
        _count: { select: { signers: true, addenda: true } },
      },
    });

    return NextResponse.json({
      template: { id: template.id, name: template.name },
      contracts: contracts.map((c) => ({
        id: c.id,
        status: c.status,
        documentUrl: c.documentUrl,
        createdAt: c.createdAt,
        signersCount: c._count.signers,
        parentContractId: c.parentContractId,
        addendaCount: c._count.addenda,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/templates/[id]/contracts]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
