"use client";

import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import type { VariableDefinitions } from "@/lib/contracts/variable-definitions";
import {
  getVariableDefinition,
  getVariableType,
  formatDateToDisplay,
  monthCodeToName,
  humanizeVariableName,
  addDays,
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
    "html { box-sizing: border-box; } body, body * { box-sizing: border-box; overflow-wrap: break-word; word-break: break-word; } body { width: 100%; max-width: 210mm; padding: 15mm; background: #fff; color: #1a1a1a; } p { margin: 2mm 0; } h1 { font-size: 14pt; text-align: center; margin: 4mm 0; } h2 { font-size: 12pt; margin: 4mm 0 2mm; } .signature-img { max-width: 200px; max-height: 100px; width: auto; height: auto; display: inline-block; vertical-align: middle; }";
  if (out.includes("</head>")) {
    out = out.replace("</head>", `<style>${previewStyles}</style></head>`);
  } else if (out.includes("<body")) {
    out = out.replace("<body", `<head><meta charset="utf-8"><title>Contract</title><style>${previewStyles}</style></head><body`);
  }
  return out;
}

const DROPDOWN_RE = /\{#(\w+)#\s*[^}]*\}/g;
const SIBLING_RE = /\{@(\w+)\}/g;

function extractVariables(html: string): string[] {
  const names = new Set<string>();
  const placeholderRe = /\{\{\{?\s*(\w+)\s*\}\}?\}/g;
  let m: RegExpExecArray | null;
  while ((m = placeholderRe.exec(html)) !== null) names.add(m[1]);
  const singleBraceRe = /\{\s*(\w+)\s*\}/g;
  while ((m = singleBraceRe.exec(html)) !== null) names.add(m[1]);
  const spanRe = /<span[^>]*data-variable="(\w+)"[^>]*>/gi;
  while ((m = spanRe.exec(html)) !== null) names.add(m[1]);
  while ((m = DROPDOWN_RE.exec(html)) !== null) names.add(m[1]);
  while ((m = SIBLING_RE.exec(html)) !== null) names.add(m[1]);
  return Array.from(names).sort();
}

type DropdownSiblingMeta = {
  dropdownOptions: Record<string, string[]>;
  dropdownSiblings: Record<string, string>;
};

const DERIVED_VAR_NAMES = ["Data_final_un_an"];

function getVarNamesFromContentAndDefs(content: string | null, variableDefinitions: VariableDefinitions | null): string[] {
  const fromContent = content ? extractVariables(content) : [];
  const fromDefs = (variableDefinitions ?? []).map((d) => d.name);
  const combined = new Set([...fromContent, ...fromDefs]);
  return Array.from(combined).sort();
}

const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";
const inputClass = "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 text-sm";
const inputErrorClass = "w-full rounded-lg border-2 border-red-500 dark:border-red-500 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-400";

type Step = "read" | "form" | "verify";

export default function ContractFillPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const token = typeof params.token === "string" ? params.token : "";
  const step = (searchParams.get("step") === "form" ? "form" : searchParams.get("step") === "verify" ? "verify" : "read") as Step;

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
  const [fieldErrors, setFieldErrors] = useState<{
    missingVarNames: string[];
    missingSignerName: boolean;
    missingSignerEmail: boolean;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signingLink, setSigningLink] = useState<string | null>(null);
  const [hasPreviewDocx, setHasPreviewDocx] = useState(false);
  const [readPreviewStatus, setReadPreviewStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [verifyPreviewStatus, setVerifyPreviewStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const readPreviewRef = useRef<HTMLDivElement>(null);
  const verifyPreviewRef = useRef<HTMLDivElement>(null);
  const [readContainerReady, setReadContainerReady] = useState(false);
  const [verifyContainerReady, setVerifyContainerReady] = useState(false);
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, string[]>>({});
  const [dropdownSiblings, setDropdownSiblings] = useState<Record<string, string>>({});
  const [varOrder, setVarOrder] = useState<string[]>([]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/contracts/fill/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg = data?.error ?? data?.message ?? (r.status === 404 ? "Link invalid sau expirat" : "Eroare la încărcare");
          throw new Error(msg);
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setTemplateName(data.templateName ?? "");
        const hasContent = data.content && typeof data.content === "string" && data.content.trim().length > 0;
        setTemplateContent(hasContent ? data.content : "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body><p>Completează datele mai jos.</p></body></html>");
        const defs = data.variableDefinitions ?? null;
        setVariableDefinitions(defs);
        const names = getVarNamesFromContentAndDefs(hasContent ? data.content : null, defs);
        setVarNames(names);
        const initialVars = (data.variables && typeof data.variables === "object") ? data.variables : {};
        const merged: Record<string, string> = {};
        names.forEach((n) => {
          const v = initialVars[n];
          merged[n] = typeof v === "string" ? v : "";
        });
        setVariables(merged);
        setHasPreviewDocx(Boolean(data.hasPreviewDocx));
        setDropdownOptions(
          data.dropdownOptions && typeof data.dropdownOptions === "object" ? data.dropdownOptions : {}
        );
        setDropdownSiblings(
          data.dropdownSiblings && typeof data.dropdownSiblings === "object" ? data.dropdownSiblings : {}
        );
        setVarOrder(Array.isArray(data.varOrder) ? data.varOrder : []);
        setSigningLink(data.signingLink ?? null);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Eroare la încărcare");
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

  useEffect(() => {
    if (step !== "read" || !token || !readContainerReady || !readPreviewRef.current) return;
    let cancelled = false;
    setReadPreviewStatus("loading");
    const container = readPreviewRef.current;
    fetch(`/api/contracts/fill/${encodeURIComponent(token)}/preview-document`)
      .then((r) => {
        if (!r.ok) throw new Error("Document fetch failed");
        const ct = r.headers.get("Content-Type") ?? "";
        if (!ct.includes("openxml") && !ct.includes("wordprocessingml")) throw new Error("Răspuns invalid");
        return r.blob();
      })
      .then((blob) => {
        if (cancelled || blob.size < 100) throw new Error("Document invalid");
        return import("docx-preview").then(({ renderAsync }) => {
          if (cancelled || !container) return;
          container.innerHTML = "";
          return renderAsync(blob, container, undefined, {
            className: "docx-contract-preview",
            inWrapper: true,
          });
        });
      })
      .then(() => {
        if (!cancelled) setReadPreviewStatus("loaded");
      })
      .catch(() => {
        if (!cancelled) setReadPreviewStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [step, token, readContainerReady]);

  useEffect(() => {
    if (step !== "verify" || !token || !verifyContainerReady || !verifyPreviewRef.current) return;
    let cancelled = false;
    setVerifyPreviewStatus("loading");
    const container = verifyPreviewRef.current;
    fetch(`/api/contracts/fill/${encodeURIComponent(token)}/document`)
      .then((r) => {
        if (!r.ok) throw new Error("Document fetch failed");
        return r.blob();
      })
      .then((blob) => {
        if (cancelled || blob.size < 100) throw new Error("Document invalid");
        return import("docx-preview").then(({ renderAsync }) => {
          if (cancelled || !container) return;
          container.innerHTML = "";
          return renderAsync(blob, container, undefined, {
            className: "docx-contract-preview",
            inWrapper: true,
          });
        });
      })
      .then(() => {
        if (!cancelled) setVerifyPreviewStatus("loaded");
      })
      .catch(() => {
        if (!cancelled) setVerifyPreviewStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [step, token, verifyContainerReady]);

  const dropdownMeta: DropdownSiblingMeta = useMemo(
    () => ({ dropdownOptions, dropdownSiblings }),
    [dropdownOptions, dropdownSiblings]
  );

  const formVarNames = useMemo(() => {
    const list = varNames.filter(
      (name) =>
        getVariableType(variableDefinitions, name) !== "signature" && !DERIVED_VAR_NAMES.includes(name)
    );
    if (varOrder.length === 0) return list;
    const orderIdx = new Map(varOrder.map((n, i) => [n, i]));
    return [...list].sort((a, b) => {
      const ia = orderIdx.get(a) ?? 1e9;
      const ib = orderIdx.get(b) ?? 1e9;
      return ia - ib;
    });
  }, [varNames, variableDefinitions, varOrder]);

  const signHrefWithBack = useMemo(() => {
    if (!signingLink) return "";
    const base = signingLink.startsWith("http") ? signingLink : (typeof window !== "undefined" ? window.location.origin : "") + signingLink;
    return `${base}${base.includes("?") ? "&" : "?"}back=${encodeURIComponent(pathname + "?step=verify")}`;
  }, [signingLink, pathname]);

  function validateStep2(): { missingVarNames: string[]; missingSignerName: boolean; missingSignerEmail: boolean } | null {
    const missingVarNames: string[] = [];
    for (const name of formVarNames) {
      const v = (variables[name] ?? "").toString().trim();
      if (!v) missingVarNames.push(name);
    }
    const missingSignerName = !signerFullName.trim();
    const missingSignerEmail = !signerEmail.trim();
    if (missingVarNames.length === 0 && !missingSignerName && !missingSignerEmail) return null;
    return { missingVarNames, missingSignerName, missingSignerEmail };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const validationResult = validateStep2();
    if (validationResult) {
      setFieldErrors(validationResult);
      setErrorMessage("Completați câmpurile obligatorii marcate mai jos.");
      setStatus("error");
      return;
    }
    setFieldErrors(null);
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
    if (varNames.includes("Data_final_un_an") && (variables["Data"] ?? "").toString().trim()) {
      const iso = addDays((variables["Data"] ?? "").toString().trim(), 365);
      payload["Data_final_un_an"] = iso ? formatDateToDisplay(iso) : "";
    }
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
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setFieldErrors(null);
        setErrorMessage(data.error ?? data.message ?? "Eroare la salvare");
        setStatus("error");
        return;
      }
      setStatus("success");
      setSigningLink((data as { signingLink?: string }).signingLink ?? null);
      router.push(`${pathname}?step=verify`);
    } catch {
      setFieldErrors(null);
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

  if (!templateName) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6 flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Se încarcă…</p>
      </div>
    );
  }

  const steps: { id: Step; label: string }[] = [
    { id: "read", label: "Citește contractul" },
    { id: "form", label: "Completează" },
    { id: "verify", label: "Verifică datele" },
  ];
  const currentStepIndex = steps.findIndex((s) => s.id === step);

  function Stepper() {
    return (
      <nav className="flex items-center justify-center gap-2 sm:gap-4 mb-8" aria-label="Pași">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                i < currentStepIndex
                  ? "bg-green-600 text-white"
                  : i === currentStepIndex
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {i < currentStepIndex ? "✓" : i + 1}
            </div>
            <span className={`hidden sm:inline text-sm ${i === currentStepIndex ? "font-medium text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="mx-1 text-zinc-300 dark:text-zinc-600">→</span>}
          </div>
        ))}
        <span className="mx-1 text-zinc-300 dark:text-zinc-600">→</span>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">
            4
          </div>
          <span className="hidden sm:inline text-sm text-zinc-500 dark:text-zinc-400">Semnează</span>
        </div>
      </nav>
    );
  }

  if (step === "read") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <main className="w-full max-w-4xl mx-auto">
          <Stepper />
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">
            Pasul 1: Citește contractul
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6">
            {templateName}. Citește documentul mai jos. Nu există câmpuri de completat pe acest pas.
          </p>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm mb-6">
            <div
              ref={(el) => {
                (readPreviewRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                setReadContainerReady(!!el);
              }}
              className="min-h-[420px] overflow-auto p-4 docx-wrapper bg-white text-zinc-900"
              style={{ maxHeight: "70vh" }}
            />
            {readPreviewStatus === "loading" && (
              <p className="p-4 text-zinc-500 dark:text-zinc-400 text-sm">Se încarcă documentul…</p>
            )}
            {readPreviewStatus === "error" && (
              <p className="p-4 text-red-600 dark:text-red-400 text-sm">Nu s-a putut încărca previzualizarea.</p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push(`${pathname}?step=form`)}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-3 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              Continuă la pasul 2
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (step === "verify") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <main className="w-full max-w-4xl mx-auto">
          <Stepper />
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">
            Pasul 3: Verifică datele
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6">
            Iată contractul cu datele completate. Verifică și apasă butonul pentru a merge la semnare (OTP + semnătură).
          </p>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm mb-6">
            <div
              ref={(el) => {
                (verifyPreviewRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                setVerifyContainerReady(!!el);
              }}
              className="min-h-[420px] overflow-auto p-4 docx-wrapper bg-white text-zinc-900"
              style={{ maxHeight: "70vh" }}
            />
            {verifyPreviewStatus === "loading" && (
              <p className="p-4 text-zinc-500 dark:text-zinc-400 text-sm">Se încarcă documentul…</p>
            )}
            {verifyPreviewStatus === "error" && (
              <p className="p-4 text-red-600 dark:text-red-400 text-sm">Nu s-a putut încărca previzualizarea.</p>
            )}
          </div>
          {signingLink ? (
            <div className="flex flex-wrap gap-3 items-center">
              <Link
                href={`${pathname}?step=form`}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 px-6 py-3 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Înapoi la pasul 2
              </Link>
              <a
                href={signHrefWithBack}
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-3 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
              >
                Continuă la pasul 4: Semnează
              </a>
            </div>
          ) : (
            <p className="text-zinc-600 dark:text-zinc-400 text-sm">
              Completează datele semnatarului (nume, email) în pasul 2 și salvează pentru a obține linkul de semnare.
            </p>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <main className="w-full max-w-2xl mx-auto">
        <Stepper />
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">
          Pasul 2: Completează
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6">
          {templateName}. Completați toate câmpurile. Semnătura se va adăuga la pasul 4.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {fieldErrors && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {errorMessage}
            </p>
          )}
          {formVarNames.map((name) => {
            const options = dropdownMeta.dropdownOptions[name];
            if (options) {
              return (
                <div key={name} className="space-y-1">
                  <label htmlFor={`var-${name}`} className={labelClass}>
                    {humanizeVariableName(name)}
                  </label>
                  <select
                    id={`var-${name}`}
                    value={variables[name] ?? ""}
                    onChange={(e) => update(name, e.target.value)}
                    disabled={status === "loading"}
                    className={fieldErrors?.missingVarNames.includes(name) ? inputErrorClass : inputClass}
                  >
                    <option value="">Alegeți...</option>
                    {options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {fieldErrors?.missingVarNames.includes(name) && (
                    <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                      Completați acest câmp.
                    </p>
                  )}
                </div>
              );
            }
            return (
              <VariableInput
                key={name}
                name={name}
                type={getVariableType(variableDefinitions, name)}
                definition={getVariableDefinition(variableDefinitions, name)}
                value={variables[name] ?? ""}
                onChange={(value) => update(name, value)}
                disabled={status === "loading"}
                error={fieldErrors?.missingVarNames.includes(name) ? "Completați acest câmp." : null}
              />
            );
          })}
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-2 space-y-3">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Date semnatar</p>
            <p className="text-xs text-zinc-500">Vei primi linkul de semnare la acest email după salvare.</p>
            <div className="space-y-1">
              <label htmlFor="signerFullName" className={labelClass}>Nume complet</label>
              <input id="signerFullName" type="text" value={signerFullName} onChange={(e) => setSignerFullName(e.target.value)} placeholder="Ex: Ion Popescu" className={fieldErrors?.missingSignerName ? inputErrorClass : inputClass} disabled={status === "loading"} />
              {fieldErrors?.missingSignerName && <p className="text-sm text-red-600 dark:text-red-400" role="alert">Introduceți numele complet al semnatarului.</p>}
            </div>
            <div className="space-y-1">
              <label htmlFor="signerEmail" className={labelClass}>Email</label>
              <input id="signerEmail" type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} placeholder="email@example.com" className={fieldErrors?.missingSignerEmail ? inputErrorClass : inputClass} disabled={status === "loading"} />
              {fieldErrors?.missingSignerEmail && <p className="text-sm text-red-600 dark:text-red-400" role="alert">Introduceți adresa de email a semnatarului.</p>}
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
          {status === "error" && errorMessage && !fieldErrors && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-3">
              <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">Eroare</p>
              <p className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap break-words">{errorMessage}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Link
              href={`${pathname}?step=read`}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 px-6 py-3 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Înapoi la pasul 1
            </Link>
            <button type="submit" disabled={status === "loading"} className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-3 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50">
              {status === "loading" ? "Se salvează…" : "Salvează și continuă la pasul 3"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
