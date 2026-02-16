import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
  // Sequential queries to avoid exhausting Supabase Session pool (max clients)
  const templates = await prisma.contractTemplate.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      version: true,
      createdAt: true,
      _count: { select: { contracts: true } },
    },
  });
  const contractCounts = await prisma.contract.groupBy({
    by: ["status"],
    _count: { id: true },
  });
  const recentContracts = await prisma.contract.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      status: true,
      createdAt: true,
      template: { select: { id: true, name: true } },
      _count: { select: { signers: true } },
    },
  });
  const recentAudits = await prisma.signatureAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      createdAt: true,
      device: true,
      deviceSignature: true,
      authMethod: true,
      contract: { select: { id: true } },
      signer: { select: { fullName: true, email: true } },
    },
  });

  const statusCounts = { DRAFT: 0, SENT: 0, SIGNED: 0 };
  for (const row of contractCounts) {
    statusCounts[row.status as keyof typeof statusCounts] = row._count.id;
  }

  return NextResponse.json({
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      version: t.version,
      createdAt: t.createdAt,
      contractsCount: t._count.contracts,
    })),
    contractCounts: {
      draft: statusCounts.DRAFT,
      sent: statusCounts.SENT,
      signed: statusCounts.SIGNED,
      total: statusCounts.DRAFT + statusCounts.SENT + statusCounts.SIGNED,
    },
    recentContracts: recentContracts.map((c) => ({
      id: c.id,
      status: c.status,
      createdAt: c.createdAt,
      templateId: c.template.id,
      templateName: c.template.name,
      signersCount: c._count.signers,
    })),
    recentAudits: recentAudits.map((a) => ({
      id: a.id,
      createdAt: a.createdAt,
      signerName: a.signer?.fullName ?? "—",
      signerEmail: a.signer?.email ?? "—",
      device: a.device,
      deviceSignature: a.deviceSignature,
      authMethod: a.authMethod,
      contractId: a.contract?.id ?? "—",
    })),
  });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Eroare la încărcare";
    console.error("[api/dashboard]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
