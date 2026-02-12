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
  }
  out = out.replace(/\{\{\{\s*[^}]+\s*\}\}\}/g, "");
  out = out.replace(/\{\{\s*[^}]+\s*\}\}/g, "");
  out = out.replace(
    "</head>",
    "<style>body { padding: 15mm; background: #fff; color: #1a1a1a; } .signature-img { max-width: 200px; max-height: 100px; width: auto; height: auto; }</style></head>"
  );
  return out;
}

function extractVariables(html: string): string[] {
  const names = new Set<string>();
  const re = /\{\{\{?\s*(\w+)\s*\}\}?\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) names.add(m[1]);
  return Array.from(names).sort();
}

function getVarNamesFromContentAndDefs(content: string | null, variableDefinitions: VariableDefinitions | null): string[] {
  const fromContent = content ? extractVariables(content) : [];
  const fromDefs = (variableDefinitions ?? []).map((d) => d.name);
  const combined = new Set([...fromContent, ...fromDefs]);
  return Array.from(combined).sort();
}

const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";
const inputClass = "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 text-sm";

export default function ContractFillPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";
  const [templateName, setTemplateName] = useState("");
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
  const [signingLink, setSigningLink] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/contracts/fill/${encodeURIComponent(token)}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Link invalid sau expirat" : "Eroare");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setTemplateName(data.templateName ?? "");
        setTemplateContent(data.content ?? null);
        const defs = data.variableDefinitions ?? null;
        setVariableDefinitions(defs);
        const names = getVarNamesFromContentAndDefs(data.content ?? null, defs);
        setVarNames(names);
        const initialVars = (data.variables && typeof data.variables === "object") ? data.variables : {};
        const merged: Record<string, string> = {};
        names.forEach((n) => {
          const v = initialVars[n];
          merged[n] = typeof v === "string" ? v : "";
        });
        setVariables(merged);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message ?? "Eroare la încărcare");
      });
    return () => { cancelled = true; };
  }, [token]);

  const update = useCallback((key: string, value: string) => {
    setVariables((p) => ({ ...p, [key]: value }));
  }, []);

  const previewVariables = useMemo(() => {
    const out: Record<string, string> = {};
    varNames.forEach((name) => {
      const v = variables[name];
      if (v === undefined || v === "") {
        out[name] = "";
        return;
      }
      const type = getVariableType(variableDefinitions, name);
      if (type === "date") out[name] = formatDateToDisplay(v);
      else if (type === "month") out[name] = monthCodeToName(v);
      else out[name] = v;
    });
    return out;
  }, [variables, variableDefinitions, varNames]);

  const previewHtml = useMemo(
    () => (templateContent ? renderPreview(templateContent, previewVariables) : null),
    [templateContent, previewVariables]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setStatus("loading");
    setErrorMessage(null);
    const payload: Record<string, string> = { ...variables };
    varNames.forEach((name) => {
      const v = variables[name];
      if (v === undefined) return;
      const type = getVariableType(variableDefinitions, name);
      if (type === "date") payload[name] = formatDateToDisplay(v);
      else if (type === "month") payload[name] = monthCodeToName(v);
    });
    const body: { variables: Record<string, string>; signerFullName?: string; signerEmail?: string; signerRole?: "student" | "teacher" | "guardian" } = { variables: payload };
    if (signerFullName.trim() && signerEmail.trim()) {
      body.signerFullName = signerFullName.trim();
      body.signerEmail = signerEmail.trim();
      body.signerRole = signerRole;
    }
    try {
      const res = await fetch(`/api/contracts/fill/${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(data.error ?? "Eroare la salvare");
        setStatus("error");
        return;
      }
      setStatus("success");
      setSigningLink((data as { signingLink?: string }).signingLink ?? null);
    } catch {
      setErrorMessage("Eroare de rețea");
      setStatus("error");
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <p className="text-zinc-500 text-sm">Link invalid.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <p className="text-red-600 dark:text-red-400 text-sm">{loadError}</p>
        <Link href="/" className="mt-2 inline-block text-sm text-zinc-600 dark:text-zinc-400 hover:underline">Înapoi</Link>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-lg font-medium text-green-700 dark:text-green-400 text-center">
          Contract completat cu succes.
        </p>
        {signingLink ? (
          <>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm text-center max-w-md">
              Poți continua direct la semnarea electronică.
            </p>
            <a
              href={signingLink.startsWith("http") ? signingLink : `${typeof window !== "undefined" ? window.location.origin : ""}${signingLink}`}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-3 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              Continuă la semnare
            </a>
          </>
        ) : (
          <p className="text-zinc-600 dark:text-zinc-400 text-sm text-center max-w-md">
            Administratorul va primi datele și va trimite linkul de semnare la emailul indicat.
          </p>
        )}
      </div>
    );
  }

  if (!templateContent) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <p className="text-zinc-500 text-sm">Se încarcă…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <main className="w-full max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
          Completează contractul
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400 text-sm mb-6">
          {templateName}. Completați câmpurile și apăsați „Salvează”.
        </p>

        <div className="flex flex-col lg:flex-row gap-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full lg:max-w-sm">
            {varNames.map((name) => (
              <VariableInput
                key={name}
                name={name}
                type={getVariableType(variableDefinitions, name)}
                definition={getVariableDefinition(variableDefinitions, name)}
                value={variables[name] ?? ""}
                onChange={(value) => update(name, value)}
                disabled={status === "loading"}
              />
            ))}
            <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-2 space-y-3">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Date semnatar (opțional)</p>
              <p className="text-xs text-zinc-500">Dacă completezi, vei primi linkul de semnare la acest email.</p>
              <div>
                <label htmlFor="signerFullName" className={labelClass}>Nume complet</label>
                <input id="signerFullName" type="text" value={signerFullName} onChange={(e) => setSignerFullName(e.target.value)} placeholder="Ex: Ion Popescu" className={inputClass} disabled={status === "loading"} />
              </div>
              <div>
                <label htmlFor="signerEmail" className={labelClass}>Email</label>
                <input id="signerEmail" type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} placeholder="email@example.com" className={inputClass} disabled={status === "loading"} />
              </div>
              <div>
                <label htmlFor="signerRole" className={labelClass}>Rol semnatar</label>
                <select id="signerRole" value={signerRole} onChange={(e) => setSignerRole(e.target.value as "student" | "teacher" | "guardian")} className={inputClass} disabled={status === "loading"}>
                  <option value="student">Student</option>
                  <option value="guardian">Părinte / Tutore legal</option>
                  <option value="teacher">Profesor</option>
                </select>
              </div>
            </div>
            {status === "error" && <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>}
            <button type="submit" disabled={status === "loading"} className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50">
              {status === "loading" ? "Se salvează…" : "Salvează contractul"}
            </button>
          </form>

          <div className="flex-1 min-w-0 lg:sticky lg:top-6 lg:self-start lg:h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-3rem)] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm flex flex-col">
            <div className="flex-shrink-0 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Previzualizare
            </div>
            <div className="flex-1 min-h-[300px] overflow-auto">
              {previewHtml ? (
                <iframe
                  title="Previzualizare"
                  srcDoc={previewHtml}
                  className="w-full h-full min-h-[600px] border-0 bg-white"
                  sandbox="allow-same-origin"
                />
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
