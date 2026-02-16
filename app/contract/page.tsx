"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import type { VariableDefinitions } from "@/lib/contracts/variable-definitions";
import {
  getVariableDefinition,
  getVariableType,
  formatDateToDisplay,
  monthCodeToName,
} from "@/lib/contracts/variable-utils";
import { VariableInput } from "@/app/components/variable-input";

type AnafStatus = "idle" | "loading" | "error" | "success";

const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";
const inputClass = "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 text-sm";

function ContractPageInner() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("templateId");

  const [variableDefinitions, setVariableDefinitions] = useState<VariableDefinitions | null>(null);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [varNames, setVarNames] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [anafStatusByVar, setAnafStatusByVar] = useState<Record<string, AnafStatus>>({});
  const [anafErrorByVar, setAnafErrorByVar] = useState<Record<string, string | null>>({});
  const [signerFullName, setSignerFullName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerRole, setSignerRole] = useState<"student" | "teacher" | "guardian">("student");
  const [signingLinks, setSigningLinks] = useState<{ signerId: string; email: string; signingLink: string }[] | null>(null);
  const [createdContractId, setCreatedContractId] = useState<string | null>(null);
  const [fillLink, setFillLink] = useState<string | null>(null);
  const [shareableStatus, setShareableStatus] = useState<"idle" | "loading" | "error">("idle");
  const [shareableError, setShareableError] = useState<string | null>(null);

  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setLoadError(null);
    });
    fetch(`/api/contracts?templateId=${encodeURIComponent(templateId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(data.message ?? "Template negăsit");
          return;
        }
        const defs = data.variableDefinitions ?? [];
        setLoadError(null);
        setVariableDefinitions(Array.isArray(defs) ? defs : []);
        setTemplateLoaded(true);
        const names = Array.isArray(defs) ? defs.map((d: { name: string }) => d.name) : [];
        setVarNames(names);
        setVariables(Object.fromEntries(names.map((n: string) => [n, ""])));
      })
      .catch(() => {
        if (!cancelled) setLoadError("Eroare la încărcare");
      });
    return () => {
      cancelled = true;
    };
  }, [templateId]);

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
    setSigningLinks(null);
    const payload: Record<string, string> = { ...variables };
    varNames.forEach((name) => {
      const v = variables[name];
      if (v === undefined) return;
      const type = getVariableType(variableDefinitions, name);
      if (type === "date") payload[name] = formatDateToDisplay(v);
      else if (type === "month") payload[name] = monthCodeToName(v);
    });
    const signers = signerFullName.trim() && signerEmail.trim()
      ? [{ fullName: signerFullName.trim(), email: signerEmail.trim(), role: signerRole }]
      : undefined;
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, variables: payload, signers }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        success?: boolean;
        signingLinks?: Array<{ signerId: string; email: string; signingLink: string }>;
        contractId?: string;
      };
      if (!res.ok) {
        setErrorMessage(data.message ?? data.error ?? res.statusText ?? "Eroare la generare");
        setStatus("error");
        return;
      }
      if (data.success && data.signingLinks?.length) {
        setSigningLinks(data.signingLinks);
        setCreatedContractId(data.contractId ?? null);
        setStatus("success");
      } else {
        setErrorMessage("Nu s-au primit linkuri de semnare");
        setStatus("error");
      }
    } catch {
      setErrorMessage("Eroare de rețea");
      setStatus("error");
    }
  }

  const copySigningLink = (link: string) => {
    const fullLink = link.startsWith("http") ? link : `${typeof window !== "undefined" ? window.location.origin : ""}${link}`;
    void navigator.clipboard.writeText(fullLink);
  };

  const handleShareableLink = useCallback(async () => {
    if (!templateId) return;
    setShareableStatus("loading");
    setShareableError(null);
    setFillLink(null);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, shareableLink: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setShareableError(data.message ?? "Eroare la generare link");
        setShareableStatus("error");
        return;
      }
      const link = data.fillLink ?? (typeof window !== "undefined" ? `${window.location.origin}/contract/fill/${data.fillToken}` : "");
      setFillLink(link);
      setShareableStatus("idle");
    } catch {
      setShareableError("Eroare de rețea");
      setShareableStatus("error");
    }
  }, [templateId]);

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

  if (!templateLoaded || !variableDefinitions) {
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
          Completați câmpurile și apăsați Generează pentru a crea documentul DOCX.
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
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Date semnatar (link trimis pentru semnare)</p>
              <div>
                <label htmlFor="signerFullName" className={labelClass}>Nume complet semnatar</label>
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
                <label htmlFor="signerEmail" className={labelClass}>Email semnatar</label>
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
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleShareableLink}
                disabled={shareableStatus === "loading"}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-2.5 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50 text-sm"
              >
                {shareableStatus === "loading" ? "Se generează…" : "Generează link partajabil"}
              </button>
              {fillLink && (
                <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Link pentru completare (trimite persoanei)</p>
                  <div className="flex gap-2">
                    <input readOnly value={fillLink} className="flex-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300" />
                    <button type="button" onClick={() => copySigningLink(fillLink)} className="rounded bg-zinc-200 dark:bg-zinc-600 px-2 py-1.5 text-xs font-medium">Copiază</button>
                  </div>
                </div>
              )}
              {shareableStatus === "error" && shareableError && (
                <p className="text-sm text-red-600 dark:text-red-400">{shareableError}</p>
              )}
            </div>
            {status === "error" && errorMessage && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-3">
                <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">Eroare</p>
                <p className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap break-words">{errorMessage}</p>
              </div>
            )}
            {status === "success" && signingLinks && signingLinks.length > 0 && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 space-y-2">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">Link de semnare creat</p>
                {signingLinks.map((s) => (
                  <div key={s.signerId} className="flex items-center gap-2">
                    <input
                      readOnly
                      value={s.signingLink.startsWith("http") ? s.signingLink : `${typeof window !== "undefined" ? window.location.origin : ""}${s.signingLink}`}
                      className="flex-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300"
                    />
                    <button
                      type="button"
                      onClick={() => copySigningLink(s.signingLink)}
                      className="rounded bg-zinc-200 dark:bg-zinc-600 px-2 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-500"
                    >
                      Copiază
                    </button>
                  </div>
                ))}
                {createdContractId && (
                  <Link
                    href={`/audit?contractId=${encodeURIComponent(createdContractId)}`}
                    className="mt-2 inline-block text-sm text-green-700 dark:text-green-300 hover:underline"
                  >
                    Verificare log-uri audit →
                  </Link>
                )}
              </div>
            )}
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
            >
              {status === "loading" ? "Se creează contractul…" : "Creează contract și obține link semnare"}
            </button>
          </form>

          <div className="flex-1 min-w-0 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              După ce completezi câmpurile și apeși „Creează contract”, se generează un document Word (.docx) pe baza template-ului. Semnatorii primesc link pentru descărcare și semnare.
            </p>
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
