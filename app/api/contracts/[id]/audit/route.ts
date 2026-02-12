import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contractId } = await params;
  if (!contractId) {
    return NextResponse.json({ error: "Contract ID required" }, { status: 400 });
  }

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      signers: {
        orderBy: { signingOrder: "asc" },
      },
      auditLogs: {
        orderBy: { createdAt: "asc" },
        include: { signer: { select: { fullName: true, email: true, role: true } } },
      },
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  return NextResponse.json({
    contract: {
      id: contract.id,
      status: contract.status,
      documentHash: contract.documentHash,
      templateVersion: contract.templateVersion,
      pdfUrl: contract.pdfUrl,
      createdAt: contract.createdAt,
    },
    signers: contract.signers.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      email: s.email,
      role: s.role,
      signingOrder: s.signingOrder,
      signedAt: s.signedAt,
    })),
    auditLogs: contract.auditLogs.map((log) => ({
      id: log.id,
      signerName: log.signer.fullName,
      signerEmail: log.signer.email,
      signerRole: log.signer.role,
      ip: log.ip,
      userAgent: log.userAgent,
      device: log.device,
      authMethod: log.authMethod,
      documentHash: log.documentHash,
      contractVersion: log.contractVersion,
      createdAt: log.createdAt,
    })),
  });
}
