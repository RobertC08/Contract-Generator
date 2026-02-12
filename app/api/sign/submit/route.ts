import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSignerByToken, submitSignature } from "@/lib/contracts/sign-service";
import { regenerateContractPdf } from "@/lib/contracts/contract-service";
import { LocalStorageProvider } from "@/lib/storage/storage-provider";

function computeDeviceSignature(userAgent: string | null, ip: string | null): string {
  const payload = [userAgent ?? "", ip ?? ""].join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(1),
  claim: z.string().min(1),
  consent: z.boolean(),
  signatureDataUrl: z.string().min(1),
  signatureVariableName: z.string().min(1),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.message }, { status: 400 });
  }
  const { token, claim, consent, signatureDataUrl, signatureVariableName } = parsed.data;
  const signer = await getSignerByToken(prisma, token);
  if (!signer) {
    return NextResponse.json({ success: false, message: "Invalid or expired link" }, { status: 404 });
  }
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
  const userAgent = request.headers.get("user-agent") ?? null;

  const deviceSignature = computeDeviceSignature(userAgent, ip);
  const result = await submitSignature({
    prisma,
    signerId: signer.id,
    consent,
    signatureDataUrl,
    signatureVariableName,
    ip,
    userAgent,
    deviceSignature,
    otpClaim: claim,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, message: result.message }, { status: 400 });
  }

  try {
    const storageProvider = new LocalStorageProvider();
    await regenerateContractPdf({
      prisma,
      storageProvider,
      contractId: signer.contract.id,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to regenerate PDF";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
