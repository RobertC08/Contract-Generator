import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getActiveOrgId } from "./organizations";

const signerRole = v.union(
  v.literal("teacher"),
  v.literal("student"),
  v.literal("guardian"),
  v.literal("school_music")
);

const signerInput = v.object({
  fullName: v.string(),
  email: v.string(),
  phone: v.optional(v.string()),
  role: v.optional(signerRole),
  signingOrder: v.optional(v.number()),
});

const SIGNING_TOKEN_EXPIRY_HOURS = 72;

function toVariablesList(v: Record<string, unknown> | null | undefined): Array<{ key: string; value: string }> {
  if (!v || typeof v !== "object") return [];
  return Object.entries(v).map(([key, value]) => ({ key, value: typeof value === "string" ? value : String(value ?? "") }));
}

function fromVariablesList(list: Array<{ key: string; value: string }>): Record<string, string> {
  return Object.fromEntries(list.map((p) => [p.key, p.value]));
}

function getVariablesListFromContract(
  c: { variables?: unknown; variablesList?: Array<{ key: string; value: string }> }
): Array<{ key: string; value: string }> {
  if (c.variablesList && c.variablesList.length > 0) return c.variablesList;
  return toVariablesList(c.variables as Record<string, unknown>);
}

function stripIntegrationFields<C extends Record<string, unknown>>(c: C): Omit<C, "integrationWebhookUrl" | "integrationMetadata"> {
  const { integrationWebhookUrl: _w, integrationMetadata: _m, ...rest } = c as C & {
    integrationWebhookUrl?: unknown;
    integrationMetadata?: unknown;
  };
  return rest as Omit<C, "integrationWebhookUrl" | "integrationMetadata">;
}

export const list = query({
  args: {
    templateId: v.id("contractTemplates"),
    parentContractId: v.optional(v.id("contracts")),
  },
  handler: async (ctx, args) => {
    const contracts =
      args.parentContractId !== undefined
        ? await ctx.db
            .query("contracts")
            .withIndex("by_parentContractId", (q) => q.eq("parentContractId", args.parentContractId))
            .order("desc")
            .collect()
        : await ctx.db
            .query("contracts")
            .withIndex("by_templateId", (q) => q.eq("templateId", args.templateId))
            .order("desc")
            .collect();
    return contracts.map((c) => ({
      id: c._id,
      status: c.status,
      createdAt: c.createdAt,
      templateId: c.templateId,
      parentContractId: c.parentContractId,
      variablesList: getVariablesListFromContract(c),
    }));
  },
});

export const get = query({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args) => {
    const orgId = await getActiveOrgId(ctx);
    const contract = await ctx.db.get(args.contractId);
    if (!contract) return null;
    if (orgId && contract.orgId && contract.orgId !== orgId) return null;
    if (!orgId && contract.orgId) return null;
    const template = await ctx.db.get(contract.templateId);
    const signers = await ctx.db
      .query("signers")
      .withIndex("by_contractId", (q) => q.eq("contractId", args.contractId))
      .collect();
    signers.sort((a, b) => a.signingOrder - b.signingOrder);
    const { variables, ...rest } = contract;
    return {
      ...stripIntegrationFields(rest as Record<string, unknown>),
      _id: contract._id,
      template: template ? { id: template._id, name: template.name } : null,
      signers,
      variablesList: getVariablesListFromContract(contract),
    };
  },
});

export const getForEdit = query({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args) => {
    const orgId = await getActiveOrgId(ctx);
    const contract = await ctx.db.get(args.contractId);
    if (!contract || contract.status !== "DRAFT") return null;
    if (orgId && contract.orgId && contract.orgId !== orgId) return null;
    if (!orgId && contract.orgId) return null;
    const template = await ctx.db.get(contract.templateId);
    const signers = await ctx.db
      .query("signers")
      .withIndex("by_contractId", (q) => q.eq("contractId", args.contractId))
      .collect();
    signers.sort((a, b) => a.signingOrder - b.signingOrder);
    const firstSigner = signers[0];
    return {
      contractId: contract._id,
      templateId: contract.templateId,
      templateName: template?.name ?? "",
      status: contract.status,
      variablesList: getVariablesListFromContract(contract),
      signerFullName: firstSigner?.fullName ?? "",
      signerEmail: firstSigner?.email ?? "",
      signerRole: firstSigner?.role ?? "student",
      parentContractId: contract.parentContractId,
    };
  },
});

export const getByDraftToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_draftEditToken", (q) => q.eq("draftEditToken", args.token))
      .first();
    return contracts ? (stripIntegrationFields(contracts as Record<string, unknown>) as typeof contracts) : null;
  },
});

export const getFillData = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const contract = await ctx.db
      .query("contracts")
      .withIndex("by_draftEditToken", (q) => q.eq("draftEditToken", args.token))
      .first();
    if (!contract) return null;
    const template = await ctx.db.get(contract.templateId);
    const signers = await ctx.db
      .query("signers")
      .withIndex("by_contractId", (q) => q.eq("contractId", contract._id))
      .collect();
    signers.sort((a, b) => a.signingOrder - b.signingOrder);
    const { variables: _v, ...contractRest } = contract;
    return {
      contract: {
        ...stripIntegrationFields(contractRest as Record<string, unknown>),
        variablesList: getVariablesListFromContract(contract),
      },
      template,
      signers,
    };
  },
});

export const getView = query({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args) => {
    const orgId = await getActiveOrgId(ctx);
    const contract = await ctx.db.get(args.contractId);
    if (!contract) return null;
    if (orgId && contract.orgId && contract.orgId !== orgId) return null;
    if (!orgId && contract.orgId) return null;
    const template = await ctx.db.get(contract.templateId);
    const signers = await ctx.db
      .query("signers")
      .withIndex("by_contractId", (q) => q.eq("contractId", args.contractId))
      .collect();
    signers.sort((a, b) => a.signingOrder - b.signingOrder);
    const addenda = await ctx.db
      .query("contracts")
      .withIndex("by_parentContractId", (q) => q.eq("parentContractId", args.contractId))
      .order("asc")
      .collect();
    const addendaWithDetails = await Promise.all(
      addenda.map(async (a) => {
        const t = await ctx.db.get(a.templateId);
        const s = await ctx.db
          .query("signers")
          .withIndex("by_contractId", (q) => q.eq("contractId", a._id))
          .collect();
        s.sort((x, y) => x.signingOrder - y.signingOrder);
        const { variables: _aV, ...aRest } = a;
        return {
          contract: {
            ...stripIntegrationFields(aRest as Record<string, unknown>),
            variablesList: getVariablesListFromContract(a),
          },
          template: t,
          signers: s,
        };
      })
    );
    const addendumTemplateIds = new Set(addenda.map((a) => a.templateId));
    const pendingAddendumTemplates = template
      ? await ctx.db
          .query("contractTemplates")
          .withIndex("by_addendumForContractId", (q) => q.eq("addendumForContractId", args.contractId))
          .collect()
      : [];
    const usedIds = new Set(addenda.map((a) => a.templateId));
    const pending = pendingAddendumTemplates.filter((t) => !usedIds.has(t._id));
    const { variables: _cV, ...contractRest } = contract;
    return {
      contract: {
        ...stripIntegrationFields(contractRest as Record<string, unknown>),
        template,
        variablesList: getVariablesListFromContract(contract),
      },
      signers,
      addenda: addendaWithDetails,
      pendingAddendumTemplates: pending.map((t) => ({ id: t._id, name: t.name })),
    };
  },
});

export const getSigners = query({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args) => {
    const signers = await ctx.db
      .query("signers")
      .withIndex("by_contractId", (q) => q.eq("contractId", args.contractId))
      .collect();
    signers.sort((a, b) => a.signingOrder - b.signingOrder);
    return signers.map((s) => ({
      fullName: s.fullName,
      email: s.email,
      role: s.role,
      signingOrder: s.signingOrder,
      signedAt: s.signedAt,
    }));
  },
});

export const getAudit = query({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("signatureAuditLogs")
      .withIndex("by_contractId", (q) => q.eq("contractId", args.contractId))
      .collect();
    const sorted = logs.sort((a, b) => a.createdAt - b.createdAt);
    const withSigners = await Promise.all(
      sorted.map(async (log) => {
        const signer = await ctx.db.get(log.signerId);
        return {
          ...log,
          signerName: signer?.fullName ?? "—",
          signerEmail: signer?.email ?? "—",
        };
      })
    );
    return withSigners;
  },
});

export const getAuditReport = query({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args) => {
    const orgId = await getActiveOrgId(ctx);
    const contract = await ctx.db.get(args.contractId);
    if (!contract) return null;
    if (orgId && contract.orgId && contract.orgId !== orgId) return null;
    if (!orgId && contract.orgId) return null;
    const logs = await ctx.db
      .query("signatureAuditLogs")
      .withIndex("by_contractId", (q) => q.eq("contractId", args.contractId))
      .collect();
    const sorted = logs.sort((a, b) => a.createdAt - b.createdAt);
    const withSigners = await Promise.all(
      sorted.map(async (log) => {
        const signer = await ctx.db.get(log.signerId);
        return {
          ...log,
          signerName: signer?.fullName,
          signerEmail: signer?.email,
          signerRole: signer?.role,
        };
      })
    );
    return { contract, auditLogs: withSigners };
  },
});

export const getTemplateFormData = query({
  args: { templateId: v.id("contractTemplates") },
  handler: async (ctx, args) => {
    const orgId = await getActiveOrgId(ctx);
    const template = await ctx.db.get(args.templateId);
    if (!template) return null;
    if (orgId && template.orgId !== orgId) return null;
    if (!orgId && template.orgId) return null;
    return {
      variableDefinitions: template.variableDefinitions ?? undefined,
    };
  },
});

export const setDocument = mutation({
  args: {
    contractId: v.id("contracts"),
    documentStorageId: v.id("_storage"),
    documentHash: v.string(),
    status: v.optional(v.union(v.literal("DRAFT"), v.literal("SENT"), v.literal("SIGNED"))),
  },
  handler: async (ctx, args) => {
    const patch: { documentStorageId: Id<"_storage">; documentHash: string; status?: "DRAFT" | "SENT" | "SIGNED" } = {
      documentStorageId: args.documentStorageId,
      documentHash: args.documentHash,
    };
    if (args.status) patch.status = args.status;
    await ctx.db.patch(args.contractId, patch);
  },
});

function contractNumberPlaceholder(): string {
  return "—";
}

export const updateDraftVariables = mutation({
  args: {
    contractId: v.id("contracts"),
    variablesList: v.array(v.object({ key: v.string(), value: v.string() })),
    signers: v.optional(v.array(signerInput)),
  },
  handler: async (ctx, args) => {
    const contract = await ctx.db.get(args.contractId);
    if (!contract || contract.status !== "DRAFT") throw new Error("Contract not found or not draft");
    // No org check - used by fill flow via draft token (public)
    const template = await ctx.db.get(contract.templateId);
    const defs = Array.isArray(template?.variableDefinitions) ? template.variableDefinitions : [];
    const contractNumberVarNames = defs
      .filter((d: { type?: string }) => d.type === "contractNumber")
      .map((d: { name: string }) => d.name);
    const keysSet = new Set(args.variablesList.map((p) => p.key));
    const merged = [...args.variablesList];
    for (const name of contractNumberVarNames) {
      if (!keysSet.has(name)) {
        merged.push({ key: name, value: contractNumberPlaceholder() });
        keysSet.add(name);
      }
    }
    await ctx.db.patch(args.contractId, { variablesList: merged });
    if (args.signers && args.signers.length > 0) {
      const existing = await ctx.db
        .query("signers")
        .withIndex("by_contractId", (q) => q.eq("contractId", args.contractId))
        .collect();
      existing.sort((a, b) => a.signingOrder - b.signingOrder);
      for (let i = 0; i < args.signers.length && i < existing.length; i++) {
        const s = args.signers[i]!;
        await ctx.db.patch(existing[i]!._id, {
          fullName: s.fullName,
          email: s.email,
          phone: s.phone,
          role: (s.role ?? "student") as "teacher" | "student" | "guardian" | "school_music",
        });
      }
    }
  },
});

export const deleteContract = mutation({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args) => {
    const orgId = await getActiveOrgId(ctx);
    const contract = await ctx.db.get(args.contractId);
    if (!contract) throw new Error("Contract negăsit");
    if (orgId && contract.orgId && contract.orgId !== orgId) throw new Error("Fără permisiune");
    if (!orgId && contract.orgId) throw new Error("Fără permisiune");
    if (!contract.parentContractId) {
      throw new Error("Doar actele adiționale pot fi șterse de aici.");
    }
    const signers = await ctx.db
      .query("signers")
      .withIndex("by_contractId", (q) => q.eq("contractId", args.contractId))
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
      .withIndex("by_contractId", (q) => q.eq("contractId", args.contractId))
      .collect();
    for (const a of audits) await ctx.db.delete(a._id);
    await ctx.db.delete(args.contractId);
  },
});

export const createWithSigners = internalMutation({
  args: {
    templateId: v.id("contractTemplates"),
    parentContractId: v.optional(v.id("contracts")),
    orgId: v.optional(v.id("organizations")),
    variablesList: v.array(v.object({ key: v.string(), value: v.string() })),
    templateVersion: v.number(),
    signers: v.array(
      v.object({
        fullName: v.string(),
        email: v.string(),
        phone: v.optional(v.string()),
        role: signerRole,
        signingOrder: v.number(),
        token: v.string(),
        tokenExpiresAt: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const contractId = await ctx.db.insert("contracts", {
      templateId: args.templateId,
      parentContractId: args.parentContractId,
      orgId: args.orgId,
      variablesList: args.variablesList,
      status: "DRAFT",
      templateVersion: args.templateVersion,
      createdAt: now,
    });
    for (const s of args.signers) {
      await ctx.db.insert("signers", {
        contractId,
        fullName: s.fullName,
        email: s.email,
        phone: s.phone,
        role: s.role,
        signingOrder: s.signingOrder,
        token: s.token,
        tokenExpiresAt: s.tokenExpiresAt,
      });
    }
    return contractId;
  },
});

export const createShareableDraftMutation = internalMutation({
  args: {
    templateId: v.id("contractTemplates"),
    parentContractId: v.optional(v.id("contracts")),
    orgId: v.optional(v.id("organizations")),
    fillToken: v.string(),
    signerToken: v.string(),
    templateVersion: v.number(),
    variablesList: v.array(v.object({ key: v.string(), value: v.string() })),
    integrationMetadata: v.optional(v.record(v.string(), v.string())),
    integrationWebhookUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const tokenExpiresAt = now + SIGNING_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000;
    const contractId = await ctx.db.insert("contracts", {
      templateId: args.templateId,
      parentContractId: args.parentContractId,
      orgId: args.orgId,
      variablesList: args.variablesList,
      status: "DRAFT",
      draftEditToken: args.fillToken,
      templateVersion: args.templateVersion,
      integrationMetadata:
        args.integrationMetadata && Object.keys(args.integrationMetadata).length > 0
          ? args.integrationMetadata
          : undefined,
      integrationWebhookUrl: args.integrationWebhookUrl,
      createdAt: now,
    });
    await ctx.db.insert("signers", {
      contractId,
      fullName: "—",
      email: "completare@placeholder.local",
      role: "student",
      signingOrder: 0,
      token: args.signerToken,
      tokenExpiresAt,
    });
    return contractId;
  },
});

export const getContractWithTemplate = internalQuery({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args) => {
    const contract = await ctx.db.get(args.contractId);
    if (!contract) return null;
    const template = await ctx.db.get(contract.templateId);
    return { contract, template };
  },
});

export const getTemplateFile = internalQuery({
  args: { templateId: v.id("contractTemplates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    return template ? { fileStorageId: template.fileStorageId, variableDefinitions: template.variableDefinitions } : null;
  },
});

export const getTemplateWithFile = internalQuery({
  args: { templateId: v.id("contractTemplates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    return template ? { fileStorageId: template.fileStorageId, variableDefinitions: template.variableDefinitions } : null;
  },
});

export const getTemplateVersion = internalQuery({
  args: { templateId: v.id("contractTemplates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    return template ? { version: template.version, orgId: template.orgId } : null;
  },
});

export const getTemplateVariableDefinitions = internalQuery({
  args: { templateId: v.id("contractTemplates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    const defs = template?.variableDefinitions;
    return Array.isArray(defs) ? defs : [];
  },
});

export const getSignersForContract = internalQuery({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args) => {
    const signers = await ctx.db
      .query("signers")
      .withIndex("by_contractId", (q) => q.eq("contractId", args.contractId))
      .collect();
    signers.sort((a, b) => a.signingOrder - b.signingOrder);
    return signers;
  },
});

export const getContractIntegrationForWebhook = internalQuery({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.contractId);
    if (!c) return null;
    return {
      integrationWebhookUrl: c.integrationWebhookUrl,
      integrationMetadata: c.integrationMetadata ?? {},
      templateId: c.templateId,
    };
  },
});

export const internalContractInOrg = internalQuery({
  args: {
    contractId: v.id("contracts"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const c = await ctx.db.get(args.contractId);
    return Boolean(c && c.orgId === args.orgId);
  },
});

export const internalGetContractForOrgApi = internalQuery({
  args: {
    contractId: v.id("contracts"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const contract = await ctx.db.get(args.contractId);
    if (!contract || contract.orgId !== args.orgId) return null;
    const template = await ctx.db.get(contract.templateId);
    const signers = await ctx.db
      .query("signers")
      .withIndex("by_contractId", (q) => q.eq("contractId", args.contractId))
      .collect();
    signers.sort((a, b) => a.signingOrder - b.signingOrder);
    const { variables, ...rest } = contract;
    return {
      ...stripIntegrationFields(rest as Record<string, unknown>),
      _id: contract._id,
      template: template ? { id: template._id, name: template.name } : null,
      signers,
      variablesList: getVariablesListFromContract(contract),
    };
  },
});

export const internalGetAuditForOrgApi = internalQuery({
  args: {
    contractId: v.id("contracts"),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const contract = await ctx.db.get(args.contractId);
    if (!contract || contract.orgId !== args.orgId) return null;
    const logs = await ctx.db
      .query("signatureAuditLogs")
      .withIndex("by_contractId", (q) => q.eq("contractId", args.contractId))
      .collect();
    const sorted = logs.sort((a, b) => a.createdAt - b.createdAt);
    const withSigners = await Promise.all(
      sorted.map(async (log) => {
        const signer = await ctx.db.get(log.signerId);
        return {
          ...log,
          signerName: signer?.fullName ?? "—",
          signerEmail: signer?.email ?? "—",
        };
      })
    );
    return withSigners;
  },
});
