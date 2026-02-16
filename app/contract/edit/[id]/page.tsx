"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import type { VariableDefinitions } from "@/lib/contracts/variable-definitions";
import {
  getVariableDefinition,
  getVariableType,
  formatDateToDisplay,
  monthCodeToName,
} from "@/lib/contracts/variable-utils";
import { VariableInput } from "@/app/components/variable-input";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderPreview(templateHtml: string, variables: Record<string, string>): string {
  let out = templateHtml;
  for (const [key, value] of Object.entries(variables)) {
    const replacement =
      typeof value === "string" && value.startsWith("data:image")
        ? `<img src="${value.replace(/"/g, "&quot;")}" alt="Semnătură" class="signature-img" style="max-width: 200px; max-height: 100px; width: auto; height: auto;" />`
        : escapeHtml(value ?? "");
    const safeKey = escapeRegex(key);
    out = out.replace(new RegExp(`\\{\\{\\{\\s*${safeKey}\\s*\\}\\}\\}`, "gi"), replacement);
    out = out.replace(new RegExp(`\\{\\{\\s*${safeKey}\\s*\\}\\}`, "gi"), replacement);
    out = out.replace(new RegExp(`\\{\\s*${safeKey}\\s*\\}`, "gi"), replacement);
    out = out.replace(
      new RegExp(`<span[^>]*data-variable="${safeKey}"[^>]*>[\\s\\S]*?<\\/span>`, "gi"),
      replacement
    );
  }
  out = out.replace(/\{\{\{\s*[^}]+\s*\}\}\}/g, "");
  out = out.replace(/\{\{\s*[^}]+\s*\}\}/g, "");
  out = out.replace(/\{\s*[^}]+\s*\}/g, "");
  const previewStyles =
    "html { box-sizing: border-box; } body, body * { box-sizing: border-box; overflow-wrap: break-word; word-break: break-word; } body { width: 100%; max-width: 210mm; padding: 15mm; } p { margin: 2mm 0; } h1 { font-size: 14pt; text-align: center; margin: 4mm 0; } h2 { font-size: 12pt; margin: 4mm 0 2mm; } .signature-img { max-width: 200px; max-height: 100px; width: auto; height: auto; display: inline-block; vertical-align: middle; }";
  if (out.includes("</head>")) {
    out = out.replace("</head>", `<style>${previewStyles}</style></head>`);
  } else if (out.includes("<body")) {
    out = out.replace("<body", `<head><meta charset="utf-8"><title>Contract</title><style>${previewStyles}</style></head><body`);
  }
  return out;
}

function extractVariables(html: string): string[] {
  const names = new Set<string>();
  const placeholderRe = /\{\{\{?\s*(\w+)\s*\}\}?\}/g;
  let m: RegExpExecArray | null;
  while ((m = placeholderRe.exec(html)) !== null) names.add(m[1]);
  const singleBraceRe = /\{\s*(\w+)\s*\}/g;
  while ((m = singleBraceRe.exec(html)) !== null) names.add(m[1]);
  const spanRe = /<span[^>]*data-variable="(\w+)"[^>]*>/gi;
  while ((m = spanRe.exec(html)) !== null) names.add(m[1]);
  return Array.from(names).sort();
}

const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";
const inputClass = "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 text-sm";

type AnafStatus = "idle" | "loading" | "error" | "success";

export default function ContractEditPage() {
  const params = useParams();
  const contractId = typeof params.id === "string" ? params.id : "";

  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateContent, setTemplateContent] = useState<string | null>(null);
  const [variableDefinitions, setVariableDefinitions] = useState<VariableDefinitions | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [varNames, setVarNames] = useState<string[]>([]);
  const [signerFullName, setSignerFullName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerRole, setSignerRole] = useState<"student" | "teacher" | "guardian">("student");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signingLinks, setSigningLinks] = useState<{ signerId: string; email: string; signingLink: string }[] | null>(null);
  const [anafStatusByVar, setAnafStatusByVar] = useState<Record<string, AnafStatus>>({});
  const [anafErrorByVar, setAnafErrorByVar] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!contractId) return;
    let cancelled = false;
    fetch(`/api/contracts/${encodeURIComponent(contractId)}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Contract negăsit" : r.status === 403 ? "Contractul nu poate fi editat" : "Eroare");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setTemplateId(data.templateId);
        setSignerFullName(data.signerFullName ?? "");
        setSignerEmail(data.signerEmail ?? "");
        setSignerRole(data.signerRole ?? "student");
        setVariables(data.variables ?? {});
        return data.templateId;
      })
      .then((tid) => {
        if (cancelled || !tid) return;
        return fetch(`/api/contracts?templateId=${encodeURIComponent(tid)}`).then((r) => r.json());
      })
      .then((templateData) => {
        if (cancelled || !templateData) return;
        const defs = (templateData.variableDefinitions ?? []) as Array<{ name: string }>;
        const names = templateData.content
          ? extractVariables(templateData.content)
          : defs.map((d) => d.name);
        setVariableDefinitions(templateData.variableDefinitions ?? null);
        setVarNames(names);
        setTemplateContent(
          templateData.content ??
            "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Contract</title></head><body><p class=\"text-zinc-500\">Previzualizarea documentului nu este disponibilă pentru acest template. Poți completa câmpurile și salva.</p></body></html>"
        );
        setVariables((prev) => {
          const next = { ...Object.fromEntries(names.map((n) => [n, ""])), ...prev };
          return next;
        });
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message ?? "Eroare la încărcare");
      });
    return () => { cancelled = true; };
  }, [contractId]);

  const update = useCallback((key: string, value: string) => {
    setVariables((p) => ({ ...p, [key]: value }));
  }, []);

  const previewVariables = useMemo(() => {
    const out: Record<string, string> = { ...variables };
    varNames.forEach((name) => {
      const v = variables[name];
      if (v === undefined || v === "") return;
      const type = getVariableType(variableDefinitions, name);
      if (type === "date") out[name] = formatDateToDisplay(v);
      else if (type === "month") out[name] = monthCodeToName(v);
    });
    return out;
  }, [variables, variableDefinitions, varNames]);

  const previewHtml = useMemo(
    () => (templateContent ? renderPreview(templateContent, previewVariables) : null),
    [templateContent, previewVariables]
  );

  const resolveLinkedVar = useCallback(
    (preferred: string, fallbacks: string[]): string => {
      const names = new Set(varNames);
      if (names.has(preferred)) return preferred;
      for (const name of fallbacks) {
        if (names.has(name)) return name;
      }
      return preferred;
    },
    [varNames]
  );

  const handleAnafLookup = useCallback(
    async (varName: string) => {
      const def = getVariableDefinition(variableDefinitions, varName);
      if (def?.type !== "cui") return;
      const linked = {
        denumire: resolveLinkedVar("denumireFirma", ["denumire"]),
        sediu: resolveLinkedVar("sediuSoc", ["sediu"]),
        regCom: resolveLinkedVar("nrRegCom", ["regCom"]),
      };
      const cui = variables[varName]?.trim();
      if (!cui) return;
      setAnafStatusByVar((p) => ({ ...p, [varName]: "loading" }));
      setAnafErrorByVar((p) => ({ ...p, [varName]: null }));
      try {
        const res = await fetch("/api/anaf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cui }) });
        const data = (await res.json().catch(() => ({}))) as { message?: string; denumire?: string; adresa?: string; nrRegCom?: string };
        if (!res.ok) {
          setAnafErrorByVar((p) => ({ ...p, [varName]: data.message ?? "Eroare" }));
          setAnafStatusByVar((p) => ({ ...p, [varName]: "error" }));
          return;
        }
        setVariables((p) => ({
          ...p,
          [linked.denumire]: data.denumire ?? p[linked.denumire] ?? "",
          [linked.sediu]: data.adresa ?? p[linked.sediu] ?? "",
          [linked.regCom]: data.nrRegCom ?? p[linked.regCom] ?? "",
        }));
        setAnafStatusByVar((p) => ({ ...p, [varName]: "success" }));
      } catch {
        setAnafErrorByVar((p) => ({ ...p, [varName]: "Eroare rețea" }));
        setAnafStatusByVar((p) => ({ ...p, [varName]: "error" }));
      }
    },
    [variableDefinitions, variables, resolveLinkedVar]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contractId) return;
    setStatus("loading");
    setErrorMessage(null);
    setSigningLinks(null);
    const payload: Record<string, string> = { ...variables };
    varNames.forEach((name) => {
      const v = variables[name];
      if (v === undefined) return;
      const type = getVariableType(variableDefinitions, name);
      if (type === "date") payload[name] = formatDateToDisplay(v);
      else if (type === "month") payload[name] = monthCodeToName(v);
    });
    try {
      const signers = signerFullName.trim() && signerEmail.trim()
        ? [{ fullName: signerFullName.trim(), email: signerEmail.trim(), role: signerRole }]
        : undefined;
      const res = await fetch(`/api/contracts/${encodeURIComponent(contractId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variables: payload, signers }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        success?: boolean;
        signingLinks?: Array<{ signerId: string; email: string; signingLink: string }>;
      };
      if (!res.ok) {
        setErrorMessage(data.error ?? data.message ?? res.statusText ?? "Eroare la salvare");
        setStatus("error");
        return;
      }
      if (data.success && data.signingLinks?.length) {
        setSigningLinks(data.signingLinks);
        setStatus("success");
      } else {
        setErrorMessage("Eroare la salvare");
        setStatus("error");
      }
    } catch {
      setErrorMessage("Eroare de rețea");
      setStatus("error");
    }
  }

  const copySigningLink = (link: string) => {
    const full = link.startsWith("http") ? link : `${typeof window !== "undefined" ? window.location.origin : ""}${link}`;
    void navigator.clipboard.writeText(full);
  };

  if (!contractId) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <p className="text-zinc-600 dark:text-zinc-400">ID contract lipsă.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <p className="text-zinc-600 dark:text-zinc-400">{loadError}</p>
        <Link href="/templates" className="mt-4 inline-block text-sm underline text-zinc-900 dark:text-zinc-100">← Template-uri</Link>
      </div>
    );
  }

  if (!templateContent || !templateId) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Se încarcă…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <main className="w-full max-w-6xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/templates" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
            ← Template-uri
          </Link>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
          Continuă contract (draft)
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400 text-sm mb-6">
          Modifică câmpurile și salvează. Linkurile de semnare rămân valabile.
        </p>

        <div className="flex flex-col lg:flex-row gap-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full lg:max-w-sm">
            {varNames.map((name) => {
              const type = getVariableType(variableDefinitions, name);
              const definition = getVariableDefinition(variableDefinitions, name);
              return (
                <VariableInput
                  key={name}
                  name={name}
                  type={type}
                  definition={definition}
                  value={variables[name] ?? ""}
                  onChange={(value) => update(name, value)}
                  anafStatus={type === "cui" ? (anafStatusByVar[name] ?? "idle") : undefined}
                  anafError={type === "cui" ? (anafErrorByVar[name] ?? null) : undefined}
                  onAnafLookup={type === "cui" ? () => handleAnafLookup(name) : undefined}
                  disabled={status === "loading"}
                />
              );
            })}
            <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-2 space-y-3">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Date semnatar (editabil în draft)</p>
              <div>
                <label htmlFor="signerFullName" className={labelClass}>Nume complet</label>
                <input
                  id="signerFullName"
                  type="text"
                  value={signerFullName}
                  onChange={(e) => setSignerFullName(e.target.value)}
                  placeholder="Ex: Ion Popescu"
                  className={inputClass}
                  disabled={status === "loading"}
                />
              </div>
              <div>
                <label htmlFor="signerEmail" className={labelClass}>Email</label>
                <input
                  id="signerEmail"
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="semnatar@example.com"
                  className={inputClass}
                  disabled={status === "loading"}
                />
              </div>
              <div>
                <label htmlFor="signerRole" className={labelClass}>Rol semnatar</label>
                <select
                  id="signerRole"
                  value={signerRole}
                  onChange={(e) => setSignerRole(e.target.value as "student" | "teacher" | "guardian")}
                  className={inputClass}
                  disabled={status === "loading"}
                >
                  <option value="student">Student</option>
                  <option value="guardian">Părinte / Tutore legal</option>
                  <option value="teacher">Profesor</option>
                </select>
              </div>
            </div>
            {status === "error" && errorMessage && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-3">
                <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">Eroare</p>
                <p className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap break-words">{errorMessage}</p>
              </div>
            )}
            {status === "success" && signingLinks && signingLinks.length > 0 && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 space-y-2">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">Contract actualizat. Linkuri de semnare:</p>
                {signingLinks.map((s) => (
                  <div key={s.signerId} className="flex items-center gap-2">
                    <input
                      readOnly
                      value={s.signingLink.startsWith("http") ? s.signingLink : `${typeof window !== "undefined" ? window.location.origin : ""}${s.signingLink}`}
                      className="flex-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5 text-xs"
                    />
                    <button type="button" onClick={() => copySigningLink(s.signingLink)} className="rounded bg-zinc-200 dark:bg-zinc-600 px-2 py-1.5 text-xs font-medium">
                      Copiază
                    </button>
                  </div>
                ))}
                <Link href={`/audit?contractId=${encodeURIComponent(contractId)}`} className="mt-2 inline-block text-sm text-green-700 dark:text-green-300 hover:underline">
                  Verificare log-uri audit →
                </Link>
              </div>
            )}
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
            >
              {status === "loading" ? "Se salvează…" : "Salvează modificările"}
            </button>
          </form>

          <div className="flex-1 min-w-0 lg:sticky lg:top-6 lg:self-start lg:h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-3rem)] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm flex flex-col">
            <div className="flex-shrink-0 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Previzualizare
            </div>
            <div className="flex-1 min-h-[300px] overflow-auto">
              {previewHtml ? (
                <iframe title="Previzualizare" srcDoc={previewHtml} className="w-full h-full min-h-[600px] border-0 bg-white" sandbox="allow-same-origin" />
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
