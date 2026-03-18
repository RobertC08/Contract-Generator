"use node";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { Resend } from "resend";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";
import { buildSignedDocumentPreviewMeta } from "../../lib/contracts/signed-preview-meta";

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

export const sendOtp = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ success: true; code?: string } | { success: false; message: string }> => {
    const signer = await ctx.runQuery(api.sign.getSignerByToken, { token: args.token });
    if (!signer) return { success: false, message: "Invalid or expired link" };
    if ("alreadySigned" in signer && signer.alreadySigned) {
      return { success: false, message: "Contractul este deja semnat." };
    }
    const email = signer.email;
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.RESEND_FROM?.trim() || "Contracte <onboarding@resend.dev>";
    const devReturnCode = process.env.OTP_DEV_RETURN_CODE === "true";

    if (!apiKey) {
      if (!devReturnCode) {
        return {
          success: false,
          message:
            "Emailul nu poate fi trimis: RESEND_API_KEY nu e setat în Convex. În terminal: npx convex env set RESEND_API_KEY re_xxx — sau în Dashboard → Settings → Environment.",
        };
      }
    }

    const code = generateOtpCode();
    const expiresAt = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;
    await ctx.runMutation(internal.sign.storeOtp, {
      signerId: signer.signerId,
      hashedCode: hashOtp(code),
      expiresAt,
    });

    if (!apiKey && devReturnCode) {
      return { success: true, code };
    }

    const resend = new Resend(apiKey!);
    const subject = "Codul tău OTP pentru semnare";
    const html = `Codul tău OTP pentru semnarea documentului: <strong>${code}</strong>. Expiră în 10 minute.`;
    const { error } = await resend.emails.send({ from, to: email, subject, html });
    if (error) {
      const detail = [error.name, error.message].filter(Boolean).join(": ");
      return { success: false, message: detail || "Eroare Resend (verifică cheia API și RESEND_FROM / domeniu verificat)" };
    }
    return { success: true };
  },
});

function verifyClaim(claim: string, signerId: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(claim, "base64url").toString()) as { signerId?: string };
    return payload.signerId === signerId;
  } catch {
    return false;
  }
}

export const verifyOtp = action({
  args: { token: v.string(), code: v.string() },
  handler: async (ctx, args): Promise<{ success: true; claim: string } | { success: false; message: string }> => {
    const signer = await ctx.runQuery(api.sign.getSignerByToken, { token: args.token });
    if (!signer) return { success: false, message: "Invalid or expired link" };
    if ("alreadySigned" in signer && signer.alreadySigned) {
      return { success: false, message: "Contractul este deja semnat." };
    }
    const otps = await ctx.runQuery(internal.sign.listValidOtpsForSigner, { signerId: signer.signerId });
    const hashed = hashOtp(args.code);
    for (const otp of otps) {
      if (otp.hashedCode.length === hashed.length && timingSafeEqual(Buffer.from(otp.hashedCode), Buffer.from(hashed))) {
        await ctx.runMutation(internal.sign.markOtpUsed, { otpId: otp._id });
        const claim = Buffer.from(JSON.stringify({ signerId: signer.signerId, usedAt: Date.now() })).toString("base64url");
        return { success: true, claim };
      }
    }
    return { success: false, message: "Invalid or expired OTP" };
  },
});

function parseDevice(userAgent: string): string {
  if (!userAgent) return "unknown";
  if (/mobile/i.test(userAgent)) return "mobile";
  if (/tablet/i.test(userAgent)) return "tablet";
  return "desktop";
}

export const submitSignature = action({
  args: {
    token: v.string(),
    claim: v.string(),
    consent: v.boolean(),
    signatureDataUrl: v.string(),
    signatureVariableName: v.string(),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    | {
        success: true;
        documentUrl: string;
        previewMeta: ReturnType<typeof buildSignedDocumentPreviewMeta>;
      }
    | { success: false; message: string }
  > => {
    if (!args.consent) return { success: false, message: "Consent required" };
    const signer = await ctx.runQuery(api.sign.getSignerByToken, { token: args.token });
    if (!signer) return { success: false, message: "Invalid or expired link" };
    if ("alreadySigned" in signer && signer.alreadySigned) {
      return { success: false, message: "Contractul este deja semnat." };
    }
    if (!verifyClaim(args.claim, signer.signerId)) return { success: false, message: "Invalid or expired session" };
    const data = await ctx.runQuery(internal.contracts.getContractWithTemplate, { contractId: signer.contractId });
    const contractDoc = data?.contract;
    if (!contractDoc) return { success: false, message: "Contract not found" };
    const contractVariables = (contractDoc.variablesList ?? []).length
      ? (Object.fromEntries((contractDoc.variablesList as Array<{ key: string; value: string }>).map((p) => [p.key, p.value])) as Record<string, unknown>)
      : ((contractDoc as { variables?: Record<string, unknown> }).variables ?? {}) as Record<string, unknown>;
    const updated = { ...contractVariables, [args.signatureVariableName]: args.signatureDataUrl };
    const variablesList = Object.entries(updated).map(([key, value]) => ({ key, value: String(value ?? "") }));
    const ua = args.userAgent?.trim() ?? "";
    const ip = args.ip?.trim() ?? "";
    const deviceSignature = createHash("sha256")
      .update(`${ua}|${ip}|${signer.signerId}`)
      .digest("hex")
      .slice(0, 32);
    const device = ua ? parseDevice(ua) : "unknown";
    const signed = await ctx.runMutation(internal.sign.submitSignature, {
      signerId: signer.signerId,
      contractId: signer.contractId,
      templateId: signer.templateId,
      variablesList,
      ip: args.ip,
      userAgent: args.userAgent,
      device,
      deviceSignature,
      documentHash: signer.documentHash,
      templateVersion: signer.templateVersion ?? undefined,
    });
    const defs = await ctx.runQuery(internal.contracts.getTemplateVariableDefinitions, {
      templateId: signer.templateId,
    });
    const previewMeta = buildSignedDocumentPreviewMeta(
      signed.variablesList,
      defs as Array<{ name?: string; type?: string; label?: unknown }>
    );
    const { documentUrl } = await ctx.runAction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-module action reference
      (api as any)["contracts/actions"].generateDocument,
      { contractId: signer.contractId, variablesListOverride: signed.variablesList }
    );

    const integration = await ctx.runQuery(internal.contracts.getContractIntegrationForWebhook, {
      contractId: signer.contractId,
    });
    if (integration?.integrationWebhookUrl) {
      const payload = {
        event: "contract.signed" as const,
        contractId: signer.contractId,
        templateId: integration.templateId,
        signedAt: Date.now(),
        metadata: integration.integrationMetadata,
      };
      const body = JSON.stringify(payload);
      const secret = process.env.INTEGRATION_WEBHOOK_SECRET?.trim();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "ContractGenerator-Webhook/1",
      };
      if (secret) {
        headers["X-Contract-Generator-Signature"] = createHmac("sha256", secret).update(body).digest("hex");
      }
      try {
        const res = await fetch(integration.integrationWebhookUrl, {
          method: "POST",
          headers,
          body,
        });
        if (!res.ok) {
          console.error("[integration webhook]", res.status, await res.text().catch(() => ""));
        }
      } catch (err) {
        console.error("[integration webhook] fetch failed", err);
      }
    }

    return { success: true, documentUrl, previewMeta };
  },
});
