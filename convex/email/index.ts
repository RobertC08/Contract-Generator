import { AUTH_EMAIL, AUTH_RESEND_KEY } from "../env";
import { ERRORS } from "../../errors";

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail(options: SendEmailOptions) {
  if (!AUTH_RESEND_KEY) {
    throw new Error(`Resend - ${ERRORS.ENVS_NOT_INITIALIZED}`);
  }

  const from = AUTH_EMAIL ?? "Contract Generator <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AUTH_RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, ...options }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error(data);
    throw new Error(ERRORS.AUTH_EMAIL_NOT_SENT);
  }
  return data;
}
