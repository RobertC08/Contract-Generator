"use node";

import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { SITE_URL } from "../env";
import { requireOrg } from "./authHelpers";

type TemplateListItem = {
  id: Id<"contractTemplates">;
  name: string;
  version: number;
  createdAt: number;
  contractsCount: number;
};

type TemplateDetail = {
  id: Id<"contractTemplates">;
  name: string;
  version: number;
  variableDefinitions: unknown;
  hasPreviewDocx: boolean;
};

type SignerRole = "teacher" | "student" | "guardian" | "school_music";

type SignerWithToken = {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  signedAt?: number;
  token: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const contractActions = (api as any)["contracts/actions"];

export const apiListTemplates = action({
  args: { apiKey: v.string() },
  handler: async (ctx, args): Promise<TemplateListItem[]> => {
    const orgId = await requireOrg(ctx, args.apiKey);
    return await ctx.runQuery(internal.templates.internalListTemplatesForOrg, { orgId });
  },
});

export const apiGetTemplate = action({
  args: { apiKey: v.string(), templateId: v.id("contractTemplates") },
  handler: async (ctx, args): Promise<TemplateDetail> => {
    const orgId = await requireOrg(ctx, args.apiKey);
    const template = await ctx.runQuery(internal.templates.internalGetTemplateForOrg, {
      templateId: args.templateId,
      orgId,
    });
    if (!template) throw new Error("Template not found");
    return template;
  },
});

export const apiShareableDraft = action({
  args: {
    apiKey: v.string(),
    templateId: v.id("contractTemplates"),
    parentContractId: v.optional(v.id("contracts")),
    integrationMetadata: v.optional(v.record(v.string(), v.string())),
    integrationWebhookUrl: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ contractId: Id<"contracts">; fillLink: string }> => {
    const orgId = await requireOrg(ctx, args.apiKey);
    const ok = await ctx.runQuery(internal.templates.internalTemplateInOrg, {
      templateId: args.templateId,
      orgId,
    });
    if (!ok) throw new Error("Template not found");
    if (args.parentContractId) {
      const parentOk = await ctx.runQuery(internal.contracts.internalContractInOrg, {
        contractId: args.parentContractId,
        orgId,
      });
      if (!parentOk) throw new Error("Parent contract not found");
    }
    return await ctx.runAction(contractActions.createShareableDraft, {
      templateId: args.templateId,
      parentContractId: args.parentContractId,
      contractOwningOrgId: orgId,
      integrationMetadata: args.integrationMetadata,
      integrationWebhookUrl: args.integrationWebhookUrl,
    });
  },
});

export const apiCreateContract = action({
  args: {
    apiKey: v.string(),
    templateId: v.id("contractTemplates"),
    parentContractId: v.optional(v.id("contracts")),
    variablesList: v.array(v.object({ key: v.string(), value: v.string() })),
    signers: v.array(
      v.object({
        fullName: v.string(),
        email: v.string(),
        phone: v.optional(v.string()),
        role: v.optional(
          v.union(
            v.literal("teacher"),
            v.literal("student"),
            v.literal("guardian"),
            v.literal("school_music")
          )
        ),
        signingOrder: v.optional(v.number()),
      })
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    contractId: Id<"contracts">;
    signingLinks: Array<{ signerId: string; email: string; signingLink: string }>;
  }> => {
    const orgId = await requireOrg(ctx, args.apiKey);
    const ok = await ctx.runQuery(internal.templates.internalTemplateInOrg, {
      templateId: args.templateId,
      orgId,
    });
    if (!ok) throw new Error("Template not found");
    if (args.parentContractId) {
      const parentOk = await ctx.runQuery(internal.contracts.internalContractInOrg, {
        contractId: args.parentContractId,
        orgId,
      });
      if (!parentOk) throw new Error("Parent contract not found");
    }
    return await ctx.runAction(contractActions.createContract, {
      templateId: args.templateId,
      parentContractId: args.parentContractId,
      contractOwningOrgId: orgId,
      variablesList: args.variablesList,
      signers: args.signers.map((s) => ({
        fullName: s.fullName,
        email: s.email,
        phone: s.phone,
        role: s.role as SignerRole | undefined,
        signingOrder: s.signingOrder,
      })),
    });
  },
});

export const apiGetContract = action({
  args: { apiKey: v.string(), contractId: v.id("contracts") },
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const orgId = await requireOrg(ctx, args.apiKey);
    const doc = await ctx.runQuery(internal.contracts.internalGetContractForOrgApi, {
      contractId: args.contractId,
      orgId,
    });
    if (!doc) throw new Error("Contract not found");
    return doc as Record<string, unknown>;
  },
});

export const apiGetDocumentUrl = action({
  args: { apiKey: v.string(), contractId: v.id("contracts") },
  handler: async (ctx, args): Promise<string | null> => {
    const orgId = await requireOrg(ctx, args.apiKey);
    const ok = await ctx.runQuery(internal.contracts.internalContractInOrg, {
      contractId: args.contractId,
      orgId,
    });
    if (!ok) throw new Error("Contract not found");
    return await ctx.runAction(contractActions.getDocumentUrl, {
      contractId: args.contractId,
    });
  },
});

export const apiGetSigningLinks = action({
  args: { apiKey: v.string(), contractId: v.id("contracts") },
  handler: async (
    ctx,
    args
  ): Promise<{
    contractId: Id<"contracts">;
    signingLinks: Array<{
      signerId: string;
      fullName: string;
      email: string;
      role: string;
      signedAt?: number;
      signingLink: string | null;
    }>;
  }> => {
    const orgId = await requireOrg(ctx, args.apiKey);
    const doc = await ctx.runQuery(internal.contracts.internalGetContractForOrgApi, {
      contractId: args.contractId,
      orgId,
    });
    if (!doc) throw new Error("Contract not found");
    const baseUrl = SITE_URL ?? "";
    const signers = doc.signers as SignerWithToken[];
    const signingLinks = signers.map((s) => ({
      signerId: s._id,
      fullName: s.fullName,
      email: s.email,
      role: s.role,
      signedAt: s.signedAt,
      signingLink: s.token ? `${baseUrl}/semneaza/${s.token}` : null,
    }));
    return { contractId: args.contractId, signingLinks };
  },
});

export const apiGetAudit = action({
  args: { apiKey: v.string(), contractId: v.id("contracts") },
  handler: async (ctx, args): Promise<unknown[]> => {
    const orgId = await requireOrg(ctx, args.apiKey);
    const audit = await ctx.runQuery(internal.contracts.internalGetAuditForOrgApi, {
      contractId: args.contractId,
      orgId,
    });
    if (!audit) throw new Error("Contract not found");
    return audit;
  },
});
