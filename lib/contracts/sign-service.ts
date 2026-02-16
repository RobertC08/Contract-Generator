import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { PrismaClient, Prisma } from "@prisma/client";

const OTP_EXPIRY_MINUTES = 10;
const OTP_LENGTH = 6;

function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateOtpCode(): string {
  const digits = "0123456789";
  let code = "";
  const bytes = randomBytes(OTP_LENGTH);
  for (let i = 0; i < OTP_LENGTH; i++) {
    code += digits[bytes[i]! % 10];
  }
  return code;
}

export type SignerWithContract = {
  id: string;
  fullName: string;
  email: string;
  signedAt: Date | null;
  tokenExpiresAt: Date;
  contract: {
    id: string;
    templateId: string;
    status: string;
    documentHash: string | null;
    templateVersion: number | null;
    documentUrl: string | null;
  };
};

export async function getSignerByToken(
  prisma: PrismaClient,
  token: string
): Promise<SignerWithContract | null> {
  const signer = await prisma.signer.findUnique({
    where: { token },
    include: {
      contract: {
        select: { id: true, templateId: true, status: true, documentHash: true, templateVersion: true, documentUrl: true },
      },
    },
  });
  if (!signer || signer.signedAt || signer.tokenExpiresAt < new Date()) return null;
  return signer as SignerWithContract;
}

export async function getSignerByTokenForDocument(
  prisma: PrismaClient,
  token: string
): Promise<SignerWithContract | null> {
  const signer = await prisma.signer.findUnique({
    where: { token },
    include: {
      contract: {
        select: { id: true, templateId: true, status: true, documentHash: true, templateVersion: true, documentUrl: true },
      },
    },
  });
  if (!signer || signer.tokenExpiresAt < new Date()) return null;
  return signer as SignerWithContract;
}

export async function createAndSendOtp(
  prisma: PrismaClient,
  signerId: string,
  sendEmail: (email: string, code: string) => Promise<void>,
  options?: { returnCodeInResponse?: boolean }
): Promise<{ success: true; code?: string } | { success: false; message: string }> {
  const signer = await prisma.signer.findUnique({
    where: { id: signerId },
    select: { email: true },
  });
  if (!signer) return { success: false, message: "Signer not found" };

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  await prisma.signingOtp.create({
    data: {
      signerId,
      hashedCode: hashOtp(code),
      expiresAt,
    },
  });
  if (!options?.returnCodeInResponse) {
    await sendEmail(signer.email, code);
  }
  return options?.returnCodeInResponse ? { success: true, code } : { success: true };
}

export async function verifyOtp(
  prisma: PrismaClient,
  signerId: string,
  code: string
): Promise<{ success: true; claim: string } | { success: false; message: string }> {
  const otps = await prisma.signingOtp.findMany({
    where: { signerId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
  });
  const hashed = hashOtp(code);
  for (const otp of otps) {
    if (otp.hashedCode.length === hashed.length && timingSafeEqual(Buffer.from(otp.hashedCode), Buffer.from(hashed))) {
      await prisma.signingOtp.update({
        where: { id: otp.id },
        data: { usedAt: new Date() },
      });
      const claim = Buffer.from(JSON.stringify({ signerId, usedAt: Date.now() })).toString("base64url");
      return { success: true, claim };
    }
  }
  return { success: false, message: "Invalid or expired OTP" };
}

export function verifyClaim(claim: string, signerId: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(claim, "base64url").toString()) as { signerId?: string };
    return payload.signerId === signerId;
  } catch {
    return false;
  }
}

function parseDevice(userAgent: string): string {
  if (!userAgent) return "unknown";
  if (/mobile/i.test(userAgent)) return "mobile";
  if (/tablet/i.test(userAgent)) return "tablet";
  return "desktop";
}

export type SubmitSignatureParams = {
  prisma: PrismaClient;
  signerId: string;
  consent: boolean;
  signatureDataUrl: string;
  signatureVariableName: string;
  ip: string | null;
  userAgent: string | null;
  deviceSignature: string | null;
  otpClaim: string;
};

export async function submitSignature({
  prisma,
  signerId,
  consent,
  signatureDataUrl,
  signatureVariableName,
  ip,
  userAgent,
  deviceSignature,
  otpClaim,
}: SubmitSignatureParams): Promise<{ success: true } | { success: false; message: string }> {
  if (!consent) return { success: false, message: "Consent required" };
  if (!verifyClaim(otpClaim, signerId)) return { success: false, message: "Invalid or expired session" };

  const signer = await prisma.signer.findUnique({
    where: { id: signerId },
    include: { contract: true },
  });
  if (!signer || signer.signedAt) return { success: false, message: "Already signed or invalid signer" };
  if (signer.contract.status === "SIGNED") return { success: false, message: "Contract already fully signed" };

  const variables = signer.contract.variables as Record<string, unknown>;
  const updated = { ...variables, [signatureVariableName]: signatureDataUrl } as Prisma.InputJsonValue;

  await prisma.$transaction([
    prisma.contract.update({
      where: { id: signer.contractId },
      data: { variables: updated, status: "SIGNED" },
    }),
    prisma.signer.update({
      where: { id: signerId },
      data: { signedAt: new Date() },
    }),
    prisma.signatureAuditLog.create({
      data: {
        contractId: signer.contractId,
        signerId,
        ip,
        userAgent,
        device: parseDevice(userAgent ?? ""),
        deviceSignature: deviceSignature ?? undefined,
        authMethod: "otp",
        documentHash: signer.contract.documentHash ?? undefined,
        contractVersion: signer.contract.templateVersion ?? undefined,
      },
    }),
  ]);

  return { success: true };
}
