import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSignerByToken, createAndSendOtp } from "@/lib/contracts/sign-service";
import { sendOtpEmail } from "@/lib/email";

export const runtime = "nodejs";

const bodySchema = z.object({ token: z.string().min(1) });

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
  const { token } = parsed.data;
  const signer = await getSignerByToken(prisma, token);
  if (!signer) {
    return NextResponse.json({ success: false, message: "Invalid or expired link" }, { status: 404 });
  }
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const returnCodeInResponse = process.env.NODE_ENV === "development" && !hasResend;
  let result: Awaited<ReturnType<typeof createAndSendOtp>>;
  try {
    result = await createAndSendOtp(
      prisma,
      signer.id,
      sendOtpEmail,
      { returnCodeInResponse }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
  if (!result.success) {
    return NextResponse.json({ success: false, message: result.message }, { status: 400 });
  }
  return NextResponse.json(
    returnCodeInResponse && "code" in result ? { success: true, code: result.code } : { success: true }
  );
}
