import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSignerByToken } from "@/lib/contracts/sign-service";

export const runtime = "nodejs";

function getSignatureVariableName(variableDefinitions: unknown): string | null {
  const defs = variableDefinitions as Array<{ name: string; type: string }> | null;
  if (!Array.isArray(defs)) return null;
  const found = defs.find((d) => d.type === "signature");
  return found?.name ?? null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }
  const signer = await getSignerByToken(prisma, token);
  if (!signer) {
    return NextResponse.json({ error: "Invalid, expired or already used link" }, { status: 404 });
  }
  const template = await prisma.contractTemplate.findUnique({
    where: { id: signer.contract.templateId },
    select: { variableDefinitions: true },
  });
  const signatureVariableName = template ? getSignatureVariableName(template.variableDefinitions) : null;
  const name = signatureVariableName ?? "signature";
  const contractRow = await prisma.contract.findUnique({
    where: { id: signer.contract.id },
    select: { variables: true },
  });
  const variables = (contractRow?.variables ?? {}) as Record<string, unknown>;
  const existingSignature =
    typeof variables[name] === "string" && (variables[name] as string).trim().length > 0
      ? (variables[name] as string)
      : null;

  return NextResponse.json({
    signerId: signer.id,
    fullName: signer.fullName,
    email: signer.email,
    contractId: signer.contract.id,
    pdfUrl: signer.contract.pdfUrl,
    signatureVariableName: name,
    existingSignature,
  });
}
