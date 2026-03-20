"use node";

import { randomBytes } from "crypto";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
  renderDocx,
  computeDocumentHash,
  TemplateRenderError,
  extractVariableNamesFromDocx,
} from "../lib/docxGenerator.node";
import { clientFacingBaseUrl } from "../env";
import {
  pickWebhookMetadata,
  buildPrefillVariablesList,
  collectTemplateVariableNames,
} from "../../lib/integration/shareable-draft-prefill";

const SIGNING_TOKEN_EXPIRY_HOURS = 72;

function generateSigningToken(): string {
  return randomBytes(32).toString("base64url");
}

export const createContract = action({
  args: {
    templateId: v.id("contractTemplates"),
    parentContractId: v.optional(v.id("contracts")),
    contractOwningOrgId: v.optional(v.id("organizations")),
    variablesList: v.array(v.object({ key: v.string(), value: v.string() })),
    signers: v.array(
      v.object({
        fullName: v.string(),
        email: v.string(),
        phone: v.optional(v.string()),
        role: v.optional(v.union(v.literal("teacher"), v.literal("student"), v.literal("guardian"), v.literal("school_music"))),
        signingOrder: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args): Promise<{ contractId: Id<"contracts">; signingLinks: Array<{ signerId: string; email: string; signingLink: string }> }> => {
    const template = await ctx.runQuery(internal.contracts.getTemplateFile, { templateId: args.templateId });
    if (!template) throw new Error("Template not found");

    if (args.parentContractId) {
      const parent = await ctx.runQuery(internal.contracts.getContractWithTemplate, { contractId: args.parentContractId });
      if (!parent?.contract || parent.contract.status !== "SIGNED") {
        throw new Error("Doar contractele semnate pot avea acte adiționale.");
      }
      const parentSigners = await ctx.runQuery(internal.contracts.getSignersForContract, { contractId: args.parentContractId });
      const normalizedParent = new Map(parentSigners.map((p) => [p.email.toLowerCase().trim(), { email: p.email, fullName: p.fullName.trim() }]));
      for (const s of args.signers) {
        const key = s.email.toLowerCase().trim();
        const parentSigner = normalizedParent.get(key);
        if (!parentSigner || parentSigner.fullName !== s.fullName.trim()) {
          throw new Error("Semnatarul actului adițional trebuie să aibă același nume și email ca la contractul principal.");
        }
      }
    }

    const templateDoc = await ctx.runQuery(internal.contracts.getTemplateWithFile, { templateId: args.templateId });
    if (!templateDoc?.fileStorageId) throw new Error("Template not found");
    const templateUrl = await ctx.storage.getUrl(templateDoc.fileStorageId);
    if (!templateUrl) throw new Error("Template file not found");
    const templateRes = await fetch(templateUrl);
    const templateArrayBuffer = await templateRes.arrayBuffer();
    const templateBuffer = Buffer.from(templateArrayBuffer);

    const variableDefinitions = Array.isArray(templateDoc.variableDefinitions) ? templateDoc.variableDefinitions : undefined;
    const data = Object.fromEntries(args.variablesList.map((p) => [p.key, p.value])) as Record<string, unknown>;
    const signatureVarNames = (variableDefinitions ?? []).filter((d: { type: string }) => d.type === "signature").map((d: { name: string }) => d.name);
    const contractNumberVarNames = (variableDefinitions ?? []).filter((d: { type: string }) => d.type === "contractNumber").map((d: { name: string }) => d.name);
    for (const name of signatureVarNames) delete data[name];
    for (const name of contractNumberVarNames) data[name] = "—";

    let docxBuffer: Buffer;
    try {
      docxBuffer = renderDocx(templateBuffer, data, variableDefinitions);
    } catch (e) {
      const message = e instanceof TemplateRenderError ? e.message : e instanceof Error ? e.message : String(e);
      throw new Error(message);
    }

    const documentHash = computeDocumentHash(docxBuffer);
    const blob = new Blob([new Uint8Array(docxBuffer)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const documentStorageId = await ctx.storage.store(blob);

    const now = Date.now();
    const tokenExpiresAt = now + SIGNING_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000;
    const signersData =
      args.signers.length > 0
        ? args.signers.map((s, i) => ({
            fullName: s.fullName,
            email: s.email,
            phone: s.phone ?? undefined,
            role: (s.role ?? "student") as "teacher" | "student" | "guardian" | "school_music",
            signingOrder: s.signingOrder ?? i,
            token: generateSigningToken(),
            tokenExpiresAt,
          }))
        : [
            {
              fullName: "Signer",
              email: "signer@example.com",
              phone: undefined as string | undefined,
              role: "student" as const,
              signingOrder: 0,
              token: generateSigningToken(),
              tokenExpiresAt,
            },
          ];

    const templateRow = await ctx.runQuery(internal.contracts.getTemplateVersion, { templateId: args.templateId });
    const templateVersion = templateRow?.version ?? 1;
    const orgId = templateRow?.orgId ?? args.contractOwningOrgId;

    const keysSet = new Set(args.variablesList.map((p) => p.key));
    const variablesListWithNumbers = [...args.variablesList];
    for (const name of contractNumberVarNames) {
      if (!keysSet.has(name)) {
        variablesListWithNumbers.push({ key: name, value: "—" });
        keysSet.add(name);
      }
    }

    const contractId = await ctx.runMutation(internal.contracts.createWithSigners, {
      templateId: args.templateId,
      parentContractId: args.parentContractId,
      orgId,
      variablesList: variablesListWithNumbers,
      templateVersion,
      signers: signersData,
    });

    await ctx.runMutation(api.contracts.setDocument, {
      contractId,
      documentStorageId,
      documentHash,
    });

    const signersList = await ctx.runQuery(internal.contracts.getSignersForContract, { contractId });
    const baseUrl = clientFacingBaseUrl();
    const signingLinks = signersList.map((s) => ({
      signerId: s._id,
      email: s.email,
      signingLink: baseUrl ? `${baseUrl}/semneaza/${s.token}` : `/semneaza/${s.token}`,
    }));

    return { contractId, signingLinks };
  },
});

export const createShareableDraft = action({
  args: {
    templateId: v.id("contractTemplates"),
    parentContractId: v.optional(v.id("contracts")),
    contractOwningOrgId: v.optional(v.id("organizations")),
    integrationMetadata: v.optional(v.record(v.string(), v.string())),
    integrationWebhookUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ contractId: Id<"contracts">; fillLink: string }> => {
    const template = await ctx.runQuery(internal.contracts.getTemplateVersion, { templateId: args.templateId });
    if (!template) throw new Error("Template not found");
    if (args.parentContractId) {
      const parent = await ctx.runQuery(internal.contracts.getContractWithTemplate, { contractId: args.parentContractId });
      if (!parent?.contract || parent.contract.status !== "SIGNED") {
        throw new Error("Doar contractele semnate pot avea acte adiționale.");
      }
    }
    const fillToken = randomBytes(32).toString("base64url");
    const signerToken = generateSigningToken();
    const templateFile = await ctx.runQuery(internal.contracts.getTemplateFile, { templateId: args.templateId });
    if (!templateFile) throw new Error("Template not found");

    let fromDocx: string[] = [];
    try {
      const templateUrl = await ctx.storage.getUrl(templateFile.fileStorageId);
      if (templateUrl) {
        const templateRes = await fetch(templateUrl);
        if (templateRes.ok) {
          fromDocx = extractVariableNamesFromDocx(Buffer.from(await templateRes.arrayBuffer()));
        }
      }
    } catch {
      // use variableDefinitions only
    }

    const allowedNames = collectTemplateVariableNames(fromDocx, templateFile.variableDefinitions);
    const metaFull = args.integrationMetadata ?? {};
    const webhookMeta = pickWebhookMetadata(metaFull);
    const variablesList = buildPrefillVariablesList(metaFull, allowedNames);

    const contractId = await ctx.runMutation(internal.contracts.createShareableDraftMutation, {
      templateId: args.templateId,
      parentContractId: args.parentContractId,
      orgId: template.orgId ?? args.contractOwningOrgId,
      fillToken,
      signerToken,
      templateVersion: template.version,
      variablesList,
      integrationMetadata: Object.keys(webhookMeta).length > 0 ? webhookMeta : undefined,
      integrationWebhookUrl: args.integrationWebhookUrl,
    });
    await ctx.runAction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-module action reference
      (api as any)["contracts/actions"].generateDocument,
      { contractId }
    );
    const baseUrl = clientFacingBaseUrl();
    const fillLink = baseUrl ? `${baseUrl}/contract/completeaza/${fillToken}` : `/contract/completeaza/${fillToken}`;
    return { contractId, fillLink };
  },
});

export const generateDocument = action({
  args: {
    contractId: v.id("contracts"),
    variablesListOverride: v.optional(
      v.array(v.object({ key: v.string(), value: v.string() }))
    ),
  },
  handler: async (ctx, args): Promise<{ documentUrl: string }> => {
    const data = await ctx.runQuery(internal.contracts.getContractWithTemplate, { contractId: args.contractId });
    if (!data?.contract || !data.template) throw new Error("Contract or template not found");
    const templateUrl = await ctx.storage.getUrl(data.template.fileStorageId);
    if (!templateUrl) throw new Error("Template file not found");
    const templateRes = await fetch(templateUrl);
    const templateBuffer = Buffer.from(await templateRes.arrayBuffer());
    const override = args.variablesListOverride;
    const useOverride = override !== undefined && override.length > 0;
    const variables = useOverride
      ? (Object.fromEntries(override.map((p) => [p.key, p.value])) as Record<string, unknown>)
      : data.contract.variablesList?.length
        ? (Object.fromEntries(data.contract.variablesList.map((p) => [p.key, p.value])) as Record<string, unknown>)
        : ((data.contract.variables ?? {}) as Record<string, unknown>);
    const variableDefinitions = data.template.variableDefinitions;
    const defs = Array.isArray(variableDefinitions) ? variableDefinitions : [];
    const signatureVarNames = defs.filter((d: { type: string }) => d.type === "signature").map((d: { name: string }) => d.name);
    const contractNumberVarNames = defs.filter((d: { type: string }) => d.type === "contractNumber").map((d: { name: string }) => d.name);
    const isSigned = useOverride || data.contract.status === "SIGNED";
    const dataCopy = { ...variables };
    if (!isSigned) {
      for (const name of signatureVarNames) delete dataCopy[name];
      for (const name of contractNumberVarNames) dataCopy[name] = "—";
    }
    let docxBuffer: Buffer;
    try {
      docxBuffer = renderDocx(templateBuffer, dataCopy, variableDefinitions);
    } catch (e) {
      const message = e instanceof TemplateRenderError ? e.message : e instanceof Error ? e.message : String(e);
      throw new Error(message);
    }
    const documentHash = computeDocumentHash(docxBuffer);
    const docxBlob = new Blob([new Uint8Array(docxBuffer)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const documentStorageId = await ctx.storage.store(docxBlob);
    await ctx.runMutation(api.contracts.setDocument, {
      contractId: args.contractId,
      documentStorageId,
      documentHash,
    });
    const url = await ctx.storage.getUrl(documentStorageId);
    return { documentUrl: url ?? "" };
  },
});

export const getDocumentUrl = action({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args): Promise<string | null> => {
    const data = await ctx.runQuery(internal.contracts.getContractWithTemplate, { contractId: args.contractId });
    if (!data?.contract?.documentStorageId) return null;
    return await ctx.storage.getUrl(data.contract.documentStorageId);
  },
});

/** Pasul 1 „Citește contractul”: DOCX opțional de preview din șablon (fără variabile). */
export const getReadStepPreviewUrl = action({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args): Promise<string | null> => {
    const data = await ctx.runQuery(internal.contracts.getContractWithTemplate, { contractId: args.contractId });
    const sid = data?.template?.previewPdfStorageId;
    if (!sid) return null;
    return await ctx.storage.getUrl(sid);
  },
});

export const updateDraftAndGenerateDocument = action({
  args: {
    contractId: v.id("contracts"),
    variablesList: v.array(v.object({ key: v.string(), value: v.string() })),
    signers: v.optional(
      v.array(
        v.object({
          fullName: v.string(),
          email: v.string(),
          phone: v.optional(v.string()),
          role: v.optional(v.union(v.literal("teacher"), v.literal("student"), v.literal("guardian"), v.literal("school_music"))),
        })
      )
    ),
  },
  handler: async (ctx, args): Promise<{ signingLinks: Array<{ signerId: string; email: string; signingLink: string }> }> => {
    await ctx.runMutation(api.contracts.updateDraftVariables, {
      contractId: args.contractId,
      variablesList: args.variablesList,
      signers: args.signers,
    });
    await ctx.runAction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-module action reference
      (api as any)["contracts/actions"].generateDocument,
      { contractId: args.contractId }
    );
    const signersList = await ctx.runQuery(internal.contracts.getSignersForContract, { contractId: args.contractId });
    const baseUrl = clientFacingBaseUrl();
    const signingLinks = signersList.map((s) => ({
      signerId: s._id,
      email: s.email,
      signingLink: baseUrl ? `${baseUrl}/semneaza/${s.token}` : `/semneaza/${s.token}`,
    }));
    return { signingLinks };
  },
});

export const regenerateContractDocument = action({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args): Promise<void> => {
    await ctx.runAction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cross-module action reference
      (api as any)["contracts/actions"].generateDocument,
      { contractId: args.contractId }
    );
  },
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateUtc(ts: number): string {
  return new Date(ts).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export const getAuditReportHtml = action({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, args): Promise<string> => {
    const report = await ctx.runQuery(api.contracts.getAuditReport, { contractId: args.contractId });
    const signers = await ctx.runQuery(api.contracts.getSigners, { contractId: args.contractId });
    if (!report) throw new Error("Contract not found");
    const { contract, auditLogs } = report;
    const contractIdStr = args.contractId;
    type AuditRow = (typeof auditLogs)[number];
    const rows = auditLogs.map(
      (log: AuditRow) => `
    <tr>
      <td>${escapeHtml(formatDateUtc(log.createdAt))}</td>
      <td>${escapeHtml(log.signerName ?? "—")}</td>
      <td>${escapeHtml(log.signerEmail ?? "—")}</td>
      <td>${escapeHtml(log.signerRole ?? "—")}</td>
      <td>${escapeHtml(log.ip ?? "—")}</td>
      <td>${escapeHtml(log.device ?? "—")}</td>
      <td>${escapeHtml(log.deviceSignature ?? "—")}</td>
      <td>${escapeHtml(log.authMethod)}</td>
      <td>${escapeHtml(log.documentHash ?? "—")}</td>
    </tr>`
    ).join("");
    type SignerRow = (typeof signers)[number];
    const signersRows = signers.map(
      (s: SignerRow) => `
    <tr>
      <td>${escapeHtml(s.fullName)}</td>
      <td>${escapeHtml(s.email)}</td>
      <td>${escapeHtml(s.role)}</td>
      <td>${s.signedAt != null ? escapeHtml(formatDateUtc(s.signedAt)) : "—"}</td>
    </tr>`
    ).join("");
    const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <title>Raport audit semnătură – Contract ${escapeHtml(contractIdStr)}</title>
  <style>
    @page { size: A4; margin: 12mm 14mm; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    .meta { font-size: 0.875rem; color: #555; margin-bottom: 1.5rem; word-break: break-all; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.8125rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem 0.75rem; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    .audit-table td:nth-child(7), .audit-table td:nth-child(9) { word-break: break-all; max-width: 0; }
    .section { margin-bottom: 2rem; }
    .section h2 { font-size: 1rem; margin-bottom: 0.75rem; }
    .print-note { font-size: 0.75rem; color: #666; }
    @media print {
      html, body { margin: 0; padding: 0; max-width: none; width: 100%; font-size: 9pt; color: #000; background: #fff; }
      body { padding: 0 2mm; }
      h1 { font-size: 11pt; margin-bottom: 2mm; }
      .meta { font-size: 7.5pt; margin-bottom: 3mm; line-height: 1.3; color: #333; word-break: break-all; }
      .section { margin-bottom: 3mm; }
      .section:first-of-type { page-break-inside: avoid; }
      .section h2 { font-size: 9pt; margin-bottom: 2mm; }
      table { font-size: 6.5pt; margin-bottom: 3mm; table-layout: fixed; width: 100%; }
      tr { page-break-inside: avoid; }
      th, td { padding: 1.5pt 2pt; border-color: #999; overflow: hidden; }
      th { background: #eee; }
      .audit-table td:nth-child(7), .audit-table td:nth-child(9) { word-break: break-all; font-size: 5.5pt; }
      .print-note { font-size: 6.5pt; margin-top: 2mm; }
    }
  </style>
</head>
<body>
  <h1>Raport de audit – Semnătură electronică</h1>
  <div class="meta">
    Contract ID: ${escapeHtml(contractIdStr)}<br>
    Status: ${escapeHtml(contract.status)}<br>
    Hash document (SHA-256): ${escapeHtml(contract.documentHash ?? "—")}<br>
    Versiune template: ${contract.templateVersion ?? "—"}<br>
    Data creării contract: ${formatDateUtc(contract.createdAt)}<br>
    Raport generat: ${formatDateUtc(Date.now())}
  </div>

  <div class="section">
    <h2>Semnatari</h2>
    <table>
      <thead><tr><th>Nume</th><th>Email</th><th>Rol</th><th>Data semnăturii (UTC)</th></tr></thead>
      <tbody>${signersRows}</tbody>
    </table>
  </div>

  <div class="section">
    <h2>Jurnal evenimente (audit trail)</h2>
    <p>Fiecare înregistrare corespunde unei acțiuni de semnare: identitate, IP, dispozitiv, semnătură dispozitiv, metodă de autentificare, hash document.</p>
    <table class="audit-table">
      <thead>
        <tr>
          <th>Data (UTC)</th>
          <th>Semnatar</th>
          <th>Email</th>
          <th>Rol</th>
          <th>IP</th>
          <th>Dispozitiv</th>
          <th>Semnătură dispozitiv</th>
          <th>Autentificare</th>
          <th>Hash document</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <p class="print-note">
    Acest raport poate fi salvat ca PDF din browser (Ctrl+P / Cmd+P → Salvează ca PDF) și păstrat ca probă în caz de litigiu.
  </p>
</body>
</html>`;
    return html;
  },
});
