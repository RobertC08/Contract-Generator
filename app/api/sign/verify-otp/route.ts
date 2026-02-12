import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSignerByToken, verifyOtp } from "@/lib/contracts/sign-service";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(1),
  code: z.string().length(6),
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
  const { token, code } = parsed.data;
  const signer = await getSignerByToken(prisma, token);
  if (!signer) {
    return NextResponse.json({ success: false, message: "Invalid or expired link" }, { status: 404 });
  }
  const result = await verifyOtp(prisma, signer.id, code);
  if (!result.success) {
    return NextResponse.json({ success: false, message: result.message }, { status: 400 });
  }
  return NextResponse.json({ success: true, claim: result.claim });
}
