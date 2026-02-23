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
    select: {
      signers: {
        orderBy: { signingOrder: "asc" },
        select: { fullName: true, email: true, role: true },
      },
    },
  });
  if (!contract) return NextResponse.json({ error: "Contract negăsit" }, { status: 404 });

  return NextResponse.json({
    signers: contract.signers.map((s) => ({
      fullName: s.fullName,
      email: s.email,
      role: s.role,
    })),
  });
}
