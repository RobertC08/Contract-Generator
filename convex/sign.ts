import { v } from "convex/values";
import { query, internalMutation, internalQuery } from "./_generated/server";
import { buildSignedDocumentPreviewMeta } from "../lib/contracts/signed-preview-meta";

export const getSignerByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const signer = await ctx.db
      .query("signers")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!signer) return null;
    if (signer.signedAt) {
      const contract = await ctx.db.get(signer.contractId);
      if (!contract) return null;
      const template = await ctx.db.get(contract.templateId);
      const defs = (Array.isArray(template?.variableDefinitions) ? template.variableDefinitions : []) as Array<{
        name?: string;
        type?: string;
        label?: unknown;
      }>;
      const variablesList = contract.variablesList?.length
        ? contract.variablesList
        : Object.entries((contract.variables ?? {}) as Record<string, unknown>).map(([key, value]) => ({
            key,
            value: String(value ?? ""),
          }));
      const previewMeta = buildSignedDocumentPreviewMeta(variablesList, defs);
      return {
        alreadySigned: true as const,
        fullName: signer.fullName,
        email: signer.email,
        contractId: contract._id,
        documentStorageId: contract.documentStorageId,
        previewMeta,
      };
    }
    if (signer.tokenExpiresAt < Date.now()) return null;
    const contract = await ctx.db.get(signer.contractId);
    if (!contract) return null;
    const template = await ctx.db.get(contract.templateId);
    const variables = (contract.variablesList?.length
      ? Object.fromEntries(contract.variablesList.map((p) => [p.key, p.value]))
      : (contract.variables ?? {})) as Record<string, unknown>;
    const defs = (template?.variableDefinitions ?? []) as Array<{ type?: string; name?: string }>;
    const signatureVarName = defs.find((d) => d.type === "signature")?.name ?? "signature";
    const existingSignature = typeof variables[signatureVarName] === "string" ? (variables[signatureVarName] as string) : null;
    return {
      alreadySigned: false as const,
      signerId: signer._id,
      fullName: signer.fullName,
      email: signer.email,
      contractId: contract._id,
      documentStorageId: contract.documentStorageId,
      templateId: contract.templateId,
      status: contract.status,
      documentHash: contract.documentHash,
      templateVersion: contract.templateVersion,
      variableDefinitions: template?.variableDefinitions,
      signatureVariableName: signatureVarName,
      existingSignature,
    };
  },
});

export const getSignerByTokenForDocument = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const signer = await ctx.db
      .query("signers")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!signer) return null;
    if (signer.tokenExpiresAt < Date.now()) return null;
    const contract = await ctx.db.get(signer.contractId);
    if (!contract) return null;
    return {
      signerId: signer._id,
      fullName: signer.fullName,
      email: signer.email,
      contractId: contract._id,
      documentStorageId: contract.documentStorageId,
      templateId: contract.templateId,
      status: contract.status,
      documentHash: contract.documentHash,
      templateVersion: contract.templateVersion,
    };
  },
});

export const storeOtp = internalMutation({
  args: {
    signerId: v.id("signers"),
    hashedCode: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("signingOtps", {
      signerId: args.signerId,
      hashedCode: args.hashedCode,
      expiresAt: args.expiresAt,
    });
  },
});

export const markOtpUsed = internalMutation({
  args: { otpId: v.id("signingOtps") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.otpId, { usedAt: Date.now() });
  },
});

function fromVarsList(list: Array<{ key: string; value: string }>): Record<string, string> {
  return Object.fromEntries(list.map((p) => [p.key, p.value]));
}
function toVarsList(v: Record<string, unknown>): Array<{ key: string; value: string }> {
  return Object.entries(v).map(([key, value]) => ({ key, value: String(value ?? "") }));
}

export const submitSignature = internalMutation({
  args: {
    signerId: v.id("signers"),
    contractId: v.id("contracts"),
    templateId: v.id("contractTemplates"),
    variablesList: v.array(v.object({ key: v.string(), value: v.string() })),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    device: v.optional(v.string()),
    deviceSignature: v.optional(v.string()),
    documentHash: v.optional(v.string()),
    templateVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const seq = await ctx.db
      .query("contractNumberSequences")
      .withIndex("by_templateId", (q) => q.eq("templateId", args.templateId))
      .first();
    const variables = { ...fromVarsList(args.variablesList) };
    let assignedNumber: number;
    if (!seq) {
      await ctx.db.insert("contractNumberSequences", {
        templateId: args.templateId,
        lastNumber: 1,
      });
      assignedNumber = 1;
    } else {
      assignedNumber = seq.lastNumber + 1;
      await ctx.db.patch(seq._id, { lastNumber: assignedNumber });
    }
    const template = await ctx.db.get(args.templateId);
    const defs = (Array.isArray(template?.variableDefinitions) ? template.variableDefinitions : []) as Array<{
      type?: string;
      name?: string;
    }>;
    const signatureNames = new Set(
      defs.filter((d) => d.type === "signature" && d.name).map((d) => d.name as string)
    );
    for (const d of defs) {
      if (d.type === "contractNumber" && d.name && !signatureNames.has(d.name)) {
        variables[d.name] = String(assignedNumber);
      }
    }

    const finalList = toVarsList(variables);
    await ctx.db.patch(args.contractId, { variablesList: finalList, status: "SIGNED" });
    await ctx.db.patch(args.signerId, { signedAt: now });
    await ctx.db.insert("signatureAuditLogs", {
      contractId: args.contractId,
      signerId: args.signerId,
      ip: args.ip,
      userAgent: args.userAgent,
      device: args.device,
      deviceSignature: args.deviceSignature,
      authMethod: "otp",
      documentHash: args.documentHash,
      contractVersion: args.templateVersion,
      createdAt: now,
    });
    return { variablesList: finalList };
  },
});

export const getSignerEmail = internalQuery({
  args: { signerId: v.id("signers") },
  handler: async (ctx, args) => {
    const signer = await ctx.db.get(args.signerId);
    return signer?.email ?? null;
  },
});

export const listValidOtpsForSigner = internalQuery({
  args: { signerId: v.id("signers") },
  handler: async (ctx, args) => {
    const otps = await ctx.db
      .query("signingOtps")
      .withIndex("by_signerId", (q) => q.eq("signerId", args.signerId))
      .collect();
    const now = Date.now();
    return otps
      .filter((o) => !o.usedAt && o.expiresAt > now)
      .sort((a, b) => b.expiresAt - a.expiresAt);
  },
});