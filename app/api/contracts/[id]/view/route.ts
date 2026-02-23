import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      template: { select: { id: true, name: true } },
      signers: { orderBy: { signingOrder: "asc" }, select: { id: true, fullName: true, email: true, token: true } },
      addenda: {
        orderBy: { createdAt: "asc" },
        include: {
          template: { select: { id: true, name: true } },
          signers: { orderBy: { signingOrder: "asc" }, select: { id: true, fullName: true, email: true, token: true } },
        },
      },
    },
  });
  if (!contract) return NextResponse.json({ error: "Contract negăsit" }, { status: 404 });

  const addendumTemplatesForThisContract = await prisma.contractTemplate.findMany({
    where: { addendumForContractId: id },
    select: { id: true, name: true },
  });
  const usedTemplateIds = new Set(contract.addenda.map((a) => a.template.id));
  const pendingAddendumTemplates = addendumTemplatesForThisContract.filter((t) => !usedTemplateIds.has(t.id));

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  const buildSigningLinks = (signers: { id: string; fullName: string; email: string; token: string }[]) =>
    signers.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      email: s.email,
      signingLink: baseUrl ? `${baseUrl}/sign/${s.token}` : `/sign/${s.token}`,
    }));

  return NextResponse.json({
    contract: {
      id: contract.id,
      status: contract.status,
      createdAt: contract.createdAt,
      templateId: contract.template.id,
      templateName: contract.template.name,
      documentUrl: contract.documentUrl,
      signers: buildSigningLinks(contract.signers),
    },
    addenda: contract.addenda.map((a) => ({
      id: a.id,
      status: a.status,
      createdAt: a.createdAt,
      templateId: a.template.id,
      templateName: a.template.name,
      documentUrl: a.documentUrl,
      signers: buildSigningLinks(a.signers),
    })),
    pendingAddendumTemplates: pendingAddendumTemplates.map((t) => ({ id: t.id, name: t.name })),
  });
}
