import { httpAction } from "../_generated/server";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { httpRouter } from "convex/server";
import { validateShareableDraftInput } from "./shareableDraftValidate";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getBearer(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const t = h.slice(7).trim();
  return t.length > 0 ? t : null;
}

function mapErr(e: unknown): Response {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "Invalid API key") return json({ error: msg }, 401);
  if (
    msg.includes("does not match the table name in validator") &&
    msg.includes("contractTemplates") &&
    msg.includes("templateId")
  ) {
    return json(
      {
        error:
          "templateId must be a template ID (from GET /api/v1/templates → field id), not a contract ID.",
      },
      400
    );
  }
  if (
    msg === "Template not found" ||
    msg === "Contract not found" ||
    msg === "Parent contract not found"
  ) {
    return json({ error: msg }, 404);
  }
  return json({ error: msg }, 500);
}

const VALID_ROLES = ["teacher", "student", "guardian", "school_music"] as const;

export function registerIntegrationHttpApi(http: ReturnType<typeof httpRouter>) {
  http.route({
    path: "/api/v1/contracts/shareable-draft",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      const apiKey = getBearer(request);
      if (!apiKey) return json({ error: "Missing or invalid Authorization header" }, 401);
      let body: {
        templateId?: string;
        parentContractId?: string;
        metadata?: Record<string, unknown>;
        webhookUrl?: string;
      };
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
      if (!body.templateId) return json({ error: "templateId is required" }, 400);
      const v = validateShareableDraftInput({
        metadata: body.metadata,
        webhookUrl: body.webhookUrl,
      });
      if (!v.ok) return json({ error: v.message }, 400);
      try {
        const result = await ctx.runAction(api.integration.actions.apiShareableDraft, {
          apiKey,
          templateId: body.templateId as Id<"contractTemplates">,
          parentContractId: body.parentContractId
            ? (body.parentContractId as Id<"contracts">)
            : undefined,
          integrationMetadata:
            Object.keys(v.metadata).length > 0 ? v.metadata : undefined,
          integrationWebhookUrl: v.webhookUrl,
        });
        return json({ contractId: result.contractId, fillLink: result.fillLink }, 201);
      } catch (e) {
        return mapErr(e);
      }
    }),
  });

  http.route({
    path: "/api/v1/templates",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      const apiKey = getBearer(request);
      if (!apiKey) return json({ error: "Missing or invalid Authorization header" }, 401);
      try {
        const list = await ctx.runAction(api.integration.actions.apiListTemplates, { apiKey });
        return json(list);
      } catch (e) {
        return mapErr(e);
      }
    }),
  });

  http.route({
    path: "/api/v1/template",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      const apiKey = getBearer(request);
      if (!apiKey) return json({ error: "Missing or invalid Authorization header" }, 401);
      const id = new URL(request.url).searchParams.get("id");
      if (!id) return json({ error: "Query id (templateId) is required" }, 400);
      try {
        const t = await ctx.runAction(api.integration.actions.apiGetTemplate, {
          apiKey,
          templateId: id as Id<"contractTemplates">,
        });
        return json(t);
      } catch (e) {
        return mapErr(e);
      }
    }),
  });

  http.route({
    path: "/api/v1/contracts",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      const apiKey = getBearer(request);
      if (!apiKey) return json({ error: "Missing or invalid Authorization header" }, 401);
      let body: {
        templateId?: string;
        parentContractId?: string;
        variables?: Record<string, string>;
        signers?: Array<{
          fullName: string;
          email: string;
          phone?: string;
          role?: string;
          signingOrder?: number;
        }>;
      };
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
      if (!body.templateId) return json({ error: "templateId is required" }, 400);
      if (!body.signers?.length) return json({ error: "At least one signer is required" }, 400);
      for (const s of body.signers) {
        if (!s.fullName || !s.email) {
          return json({ error: "Each signer must have fullName and email" }, 400);
        }
        if (s.role && !VALID_ROLES.includes(s.role as (typeof VALID_ROLES)[number])) {
          return json({ error: `Invalid signer role: ${s.role}` }, 400);
        }
      }
      const variablesList = Object.entries(body.variables ?? {}).map(([key, value]) => ({
        key,
        value: String(value ?? ""),
      }));
      try {
        const result = await ctx.runAction(api.integration.actions.apiCreateContract, {
          apiKey,
          templateId: body.templateId as Id<"contractTemplates">,
          parentContractId: body.parentContractId
            ? (body.parentContractId as Id<"contracts">)
            : undefined,
          variablesList,
          signers: body.signers.map((s) => ({
            fullName: s.fullName,
            email: s.email,
            phone: s.phone,
            role: s.role as "teacher" | "student" | "guardian" | "school_music" | undefined,
            signingOrder: s.signingOrder,
          })),
        });
        return json(result, 201);
      } catch (e) {
        return mapErr(e);
      }
    }),
  });

  http.route({
    path: "/api/v1/contract",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      const apiKey = getBearer(request);
      if (!apiKey) return json({ error: "Missing or invalid Authorization header" }, 401);
      const id = new URL(request.url).searchParams.get("id");
      if (!id) return json({ error: "Query id (contractId) is required" }, 400);
      try {
        const doc = await ctx.runAction(api.integration.actions.apiGetContract, {
          apiKey,
          contractId: id as Id<"contracts">,
        });
        return json(doc);
      } catch (e) {
        return mapErr(e);
      }
    }),
  });

  http.route({
    path: "/api/v1/contract/document-url",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      const apiKey = getBearer(request);
      if (!apiKey) return json({ error: "Missing or invalid Authorization header" }, 401);
      const id = new URL(request.url).searchParams.get("id");
      if (!id) return json({ error: "Query id (contractId) is required" }, 400);
      try {
        const url = await ctx.runAction(api.integration.actions.apiGetDocumentUrl, {
          apiKey,
          contractId: id as Id<"contracts">,
        });
        if (!url) return json({ error: "Document not found" }, 404);
        return json({ documentUrl: url });
      } catch (e) {
        return mapErr(e);
      }
    }),
  });

  http.route({
    path: "/api/v1/contract/signing-links",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      const apiKey = getBearer(request);
      if (!apiKey) return json({ error: "Missing or invalid Authorization header" }, 401);
      const id = new URL(request.url).searchParams.get("id");
      if (!id) return json({ error: "Query id (contractId) is required" }, 400);
      try {
        const data = await ctx.runAction(api.integration.actions.apiGetSigningLinks, {
          apiKey,
          contractId: id as Id<"contracts">,
        });
        return json(data);
      } catch (e) {
        return mapErr(e);
      }
    }),
  });

  http.route({
    path: "/api/v1/contract/audit",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      const apiKey = getBearer(request);
      if (!apiKey) return json({ error: "Missing or invalid Authorization header" }, 401);
      const id = new URL(request.url).searchParams.get("id");
      if (!id) return json({ error: "Query id (contractId) is required" }, 400);
      try {
        const audit = await ctx.runAction(api.integration.actions.apiGetAudit, {
          apiKey,
          contractId: id as Id<"contracts">,
        });
        return json(audit);
      } catch (e) {
        return mapErr(e);
      }
    }),
  });
}
