import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getActiveOrgId } from "./organizations";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await getActiveOrgId(ctx);
    const all = await ctx.db.query("contractTemplates").collect();
    const main = all
      .filter((t) => t.addendumForContractId === undefined && (orgId ? (t.orgId === orgId || !t.orgId) : !t.orgId))
      .sort((a, b) => b.createdAt - a.createdAt);
    const contractCounts = await Promise.all(
      main.map(async (t) => {
        const contracts = await ctx.db
          .query("contracts")
          .withIndex("by_templateId", (q) => q.eq("templateId", t._id))
          .collect();
        return { templateId: t._id, count: contracts.length };
      })
    );
    const countMap = new Map(contractCounts.map((c) => [c.templateId, c.count]));
    return main.map((t) => ({
      id: t._id,
      name: t.name,
      version: t.version,
      createdAt: t.createdAt,
      contractsCount: countMap.get(t._id) ?? 0,
    }));
  },
});

export const get = query({
  args: { templateId: v.id("contractTemplates") },
  handler: async (ctx, args) => {
    const orgId = await getActiveOrgId(ctx);
    const template = await ctx.db.get(args.templateId);
    if (!template) return null;
    if (orgId && template.orgId && template.orgId !== orgId) return null;
    if (!orgId && template.orgId) return null;
    return {
      id: template._id,
      name: template.name,
      version: template.version,
      variableDefinitions: template.variableDefinitions,
      hasPreviewDocx: template.previewPdfStorageId !== undefined,
    };
  },
});

export const getContracts = query({
  args: { templateId: v.id("contractTemplates") },
  handler: async (ctx, args) => {
    const orgId = await getActiveOrgId(ctx);
    const template = await ctx.db.get(args.templateId);
    if (!template) return null;
    if (orgId && template.orgId && template.orgId !== orgId) return null;
    if (!orgId && template.orgId) return null;
    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_templateId", (q) => q.eq("templateId", args.templateId))
      .order("desc")
      .collect();
    const withCounts = await Promise.all(
      contracts.map(async (c) => {
        const signers = await ctx.db
          .query("signers")
          .withIndex("by_contractId", (q) => q.eq("contractId", c._id))
          .collect();
        const addenda = await ctx.db
          .query("contracts")
          .withIndex("by_parentContractId", (q) => q.eq("parentContractId", c._id))
          .collect();
        return {
          id: c._id,
          status: c.status,
          documentStorageId: c.documentStorageId,
          createdAt: c.createdAt,
          signersCount: signers.length,
          parentContractId: c.parentContractId,
          addendaCount: addenda.length,
        };
      })
    );
    return {
      template: { id: template._id, name: template.name },
      contracts: withCounts,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    fileStorageId: v.id("_storage"),
    previewPdfStorageId: v.optional(v.id("_storage")),
    version: v.number(),
    variableDefinitions: v.optional(v.any()),
    addendumForContractId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const orgId = await getActiveOrgId(ctx);
    const now = Date.now();
    const id = await ctx.db.insert("contractTemplates", {
      name: args.name,
      fileStorageId: args.fileStorageId,
      previewPdfStorageId: args.previewPdfStorageId,
      version: args.version,
      variableDefinitions: args.variableDefinitions,
      addendumForContractId: args.addendumForContractId,
      orgId: orgId ?? undefined,
      createdAt: now,
    });
    return { id, name: args.name, version: args.version };
  },
});

export const update = mutation({
  args: {
    templateId: v.id("contractTemplates"),
    name: v.string(),
    fileStorageId: v.optional(v.id("_storage")),
    previewPdfStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    variableDefinitions: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const orgId = await getActiveOrgId(ctx);
    const existing = await ctx.db.get(args.templateId);
    if (!existing) throw new Error("Template negăsit");
    if (orgId && existing.orgId && existing.orgId !== orgId) throw new Error("Fără permisiune");
    if (!orgId && existing.orgId) throw new Error("Fără permisiune");
    const patch: {
      name: string;
      version: number;
      variableDefinitions?: unknown;
      fileStorageId?: Id<"_storage">;
      previewPdfStorageId?: Id<"_storage">;
    } = {
      name: args.name,
      version: existing.version + 1,
    };
    if (args.variableDefinitions !== undefined) patch.variableDefinitions = args.variableDefinitions;
    if (args.fileStorageId !== undefined) patch.fileStorageId = args.fileStorageId;
    if (args.previewPdfStorageId !== undefined) patch.previewPdfStorageId = args.previewPdfStorageId === null ? undefined : args.previewPdfStorageId;
    await ctx.db.patch(args.templateId, patch);
    const updated = await ctx.db.get(args.templateId);
    return updated ? { id: updated._id, name: updated.name, version: updated.version } : null;
  },
});

export const remove = mutation({
  args: { templateId: v.id("contractTemplates") },
  handler: async (ctx, args) => {
    const orgId = await getActiveOrgId(ctx);
    const existing = await ctx.db.get(args.templateId);
    if (!existing) throw new Error("Template negăsit");
    if (orgId && existing.orgId && existing.orgId !== orgId) throw new Error("Fără permisiune");
    if (!orgId && existing.orgId) throw new Error("Fără permisiune");
    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_templateId", (q) => q.eq("templateId", args.templateId))
      .collect();
    for (const c of contracts) {
      const signers = await ctx.db
        .query("signers")
        .withIndex("by_contractId", (q) => q.eq("contractId", c._id))
        .collect();
      for (const s of signers) {
        const otps = await ctx.db
          .query("signingOtps")
          .withIndex("by_signerId", (q) => q.eq("signerId", s._id))
          .collect();
        for (const o of otps) await ctx.db.delete(o._id);
        await ctx.db.delete(s._id);
      }
      const audits = await ctx.db
        .query("signatureAuditLogs")
        .withIndex("by_contractId", (q) => q.eq("contractId", c._id))
        .collect();
      for (const a of audits) await ctx.db.delete(a._id);
      await ctx.db.delete(c._id);
    }
    const seq = await ctx.db
      .query("contractNumberSequences")
      .withIndex("by_templateId", (q) => q.eq("templateId", args.templateId))
      .first();
    if (seq) await ctx.db.delete(seq._id);
    await ctx.db.delete(args.templateId);
  },
});

export const internalTemplateInOrg = internalQuery({
  args: {
    templateId: v.id("contractTemplates"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const t = await ctx.db.get(args.templateId);
    if (!t || t.addendumForContractId) return false;
    if (t.orgId === args.orgId) return true;
    if (t.orgId === undefined) return true;
    return false;
  },
});

export const internalListTemplatesForOrg = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const forOrg = await ctx.db
      .query("contractTemplates")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();
    const allRows = await ctx.db.query("contractTemplates").collect();
    const legacy = allRows.filter(
      (t) => t.orgId === undefined && t.addendumForContractId === undefined
    );
    const orgMain = forOrg.filter((t) => t.addendumForContractId === undefined);
    const byId = new Map<string, (typeof forOrg)[number]>();
    for (const t of legacy) byId.set(t._id, t);
    for (const t of orgMain) byId.set(t._id, t);
    const main = Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
    const contractCounts = await Promise.all(
      main.map(async (t) => {
        const contracts = await ctx.db
          .query("contracts")
          .withIndex("by_templateId", (q) => q.eq("templateId", t._id))
          .collect();
        return { templateId: t._id, count: contracts.length };
      })
    );
    const countMap = new Map(contractCounts.map((c) => [c.templateId, c.count]));
    return main.map((t) => ({
      id: t._id,
      name: t.name,
      version: t.version,
      createdAt: t.createdAt,
      contractsCount: countMap.get(t._id) ?? 0,
    }));
  },
});

export const internalGetTemplateForOrg = internalQuery({
  args: {
    templateId: v.id("contractTemplates"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) return null;
    if (template.orgId !== undefined && template.orgId !== args.orgId) return null;
    return {
      id: template._id,
      name: template.name,
      version: template.version,
      variableDefinitions: template.variableDefinitions,
      hasPreviewDocx: template.previewPdfStorageId !== undefined,
    };
  },
});
