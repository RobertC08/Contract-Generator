import { Resend } from "resend";

const FROM = process.env.RESEND_FROM ?? "Contracte <onboarding@resend.dev>";

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const subject = "Codul tău OTP pentru semnare";
  const html = `Codul tău OTP pentru semnarea documentului: <strong>${code}</strong>. Expiră în 10 minute.`;

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
  });
  if (error) {
    const msg = typeof error.message === "string" ? error.message : "Resend error";
    throw new Error(msg);
  }
}
