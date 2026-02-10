"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
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

function renderPreview(templateHtml: string, variables: Record<string, string>): string {
  let out = templateHtml;
  for (const [key, value] of Object.entries(variables)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), escapeHtml(value));
  }
  out = out.replace(/\{\{[^}]+\}\}/g, "");
  out = out.replace(
    "</head>",
    "<style>body { padding: 25mm; }</style></head>"
  );
  return out;
}

function extractVariables(html: string): string[] {
  const names = new Set<string>();
  const re = /\{\{(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) names.add(m[1]);
  return Array.from(names).sort();
}

type AnafStatus = "idle" | "loading" | "error" | "success";

function ContractPageInner() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("templateId");

  const [templateContent, setTemplateContent] = useState<string | null>(null);
  const [variableDefinitions, setVariableDefinitions] = useState<VariableDefinitions | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [varNames, setVarNames] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [anafStatusByVar, setAnafStatusByVar] = useState<Record<string, AnafStatus>>({});
  const [anafErrorByVar, setAnafErrorByVar] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoadError(null);
    });
    fetch(`/api/contracts?templateId=${encodeURIComponent(templateId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.content == null) {
          setLoadError("Template negăsit");
          return;
        }
        setLoadError(null);
        setTemplateContent(data.content);
        setVariableDefinitions(data.variableDefinitions ?? null);
        const names = extractVariables(data.content);
        setVarNames(names);
        setVariables(Object.fromEntries(names.map((n) => [n, ""])));
      })
      .catch(() => {
        if (!cancelled) setLoadError("Eroare la încărcare");
      });
    return () => {
      cancelled = true;
    };
  }, [templateId]);

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
    () =>
      templateContent
        ? renderPreview(templateContent, previewVariables)
        : null,
    [templateContent, previewVariables]
  );

  const update = useCallback((key: string, value: string) => {
    setVariables((p) => ({ ...p, [key]: value }));
  }, []);

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
      const raw = def.linkedVariables ?? { denumire: "denumireFirma", sediu: "sediuSoc", regCom: "nrRegCom" };
      const linked = {
        denumire: resolveLinkedVar(raw.denumire, ["denumireFirma", "denumire"]),
        sediu: resolveLinkedVar(raw.sediu, ["sediuSoc", "sediu"]),
        regCom: resolveLinkedVar(raw.regCom, ["nrRegCom", "regCom"]),
      };
      const cui = variables[varName]?.trim();
      if (!cui) return;
      setAnafStatusByVar((p) => ({ ...p, [varName]: "loading" }));
      setAnafErrorByVar((p) => ({ ...p, [varName]: null }));
      try {
        const res = await fetch("/api/anaf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cui }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
          denumire?: string;
          adresa?: string;
          nrRegCom?: string;
        };
        if (!res.ok) {
          setAnafErrorByVar((p) => ({ ...p, [varName]: data.message ?? "Eroare la căutare" }));
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
    if (!templateId) return;
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
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, variables: payload }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.message ?? res.statusText ?? "Eroare la generare PDF");
        setStatus("error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "contract.pdf";
      a.click();
      URL.revokeObjectURL(url);
      setStatus("success");
    } catch {
      setErrorMessage("Eroare de rețea");
      setStatus("error");
    }
  }

  if (!templateId) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <main className="w-full max-w-2xl mx-auto">
          <p className="text-zinc-600 dark:text-zinc-400">
            Adaugă <code className="rounded bg-zinc-200 dark:bg-zinc-700 px-1">?templateId=...</code> în URL sau alege un template din{" "}
            <Link href="/templates" className="text-zinc-900 dark:text-zinc-100 underline">
              lista de template-uri
            </Link>
            .
          </p>
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <main className="w-full max-w-2xl mx-auto">
          <p className="text-zinc-600 dark:text-zinc-400">{loadError}</p>
          <Link href="/templates" className="mt-4 inline-block text-sm text-zinc-900 dark:text-zinc-100 underline">
            Înapoi la template-uri
          </Link>
        </main>
      </div>
    );
  }

  if (!templateContent) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <main className="w-full max-w-2xl mx-auto">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Se încarcă template-ul…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <main className="w-full max-w-6xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/templates"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Template-uri
          </Link>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
          Generează contract
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400 text-sm mb-6">
          Completați câmpurile; previzualizarea se actualizează în timp real.
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
            {status === "error" && (
              <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            )}
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
            >
              {status === "loading" ? "Se generează PDF…" : "Generează PDF"}
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

export default function ContractPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
          <p className="text-zinc-500 text-sm">Se încarcă…</p>
        </div>
      }
    >
      <ContractPageInner />
    </Suspense>
  );
}
