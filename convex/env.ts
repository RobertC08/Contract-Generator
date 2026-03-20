import { resolveClientFacingBaseUrl } from "../lib/urls/clientFacingBaseUrl";

export const AUTH_RESEND_KEY = process.env.AUTH_RESEND_KEY;
export const AUTH_EMAIL = process.env.AUTH_EMAIL;
export const HOST_URL = process.env.HOST_URL;
export const SITE_URL = process.env.SITE_URL;
/** URL public frontend (ex. Vercel). Prioritate față de SITE_URL pentru fillLink / semnare. */
export const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL;

export function clientFacingBaseUrl(): string {
  return resolveClientFacingBaseUrl(PUBLIC_APP_URL, SITE_URL);
}

export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
