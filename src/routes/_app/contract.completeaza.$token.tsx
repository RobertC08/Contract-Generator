import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@cvx/_generated/api";
import { contractsActions, templatesActions } from "@/lib/convex-actions";
import { extractVariableNamesFromText } from "@lib/contracts/extract-variable-names";
import type { VariableDefinitions } from "@lib/contracts/variable-definitions";
import {
  getVariableDefinition,
  getVariableLabel,
  getVariableType,
  formatDateToDisplay,
  monthCodeToName,
  addDays,
} from "@lib/contracts/variable-utils";
import {
  DERIVED_NO_INPUT_VAR_NAMES,
  computeContractDurationDays,
} from "@lib/contracts/derived-contract-variables";
import {
  applyStudentGuardianSingleFieldToPayload,
  coalesceFromCompositeName,
  expandPlaceholderToInputVariableKeys,
  mergeCoalesceCompositePlaceholders,
  studentGuardianCompositeKind,
} from "@lib/contracts/template-coalesce";
import {
  CONTRACT_DATE_FIELD_NAME,
  todayIsoDateEuropeBucharest,
} from "@lib/contracts/contract-data-defaults";
import { VariableInput } from "@/components/variable-input";

type DropdownSiblingMeta = {
  dropdownOptions: Record<string, string[]>;
  dropdownSiblings: Record<string, string[]>;
};

function getVarNamesFromContentAndDefs(content: string | null, variableDefinitions: VariableDefinitions | null): string[] {
  const fromContent = content ? extractVariableNamesFromText(content) : [];
  const fromDefs = (variableDefinitions ?? []).map((d) => d.name);
  const combined = new Set([...fromContent, ...fromDefs]);
  return Array.from(combined).sort();
}

const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";
const inputClass = "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 text-sm";
const inputErrorClass = "w-full rounded-lg border-2 border-red-500 dark:border-red-500 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-red-400";

type Step = "read" | "form" | "verify";

export const Route = createFileRoute("/_app/contract/completeaza/$token")({
  validateSearch: (search: Record<string, unknown>) => ({
    step: (search.step === "form" ? "form" : search.step === "verify" ? "verify" : "read") as Step,
  }),
  component: ContractCompleteazaPage,
});

function ContractCompleteazaPage() {
  const { token } = Route.useParams();
  const { step } = Route.useSearch({ strict: false });
  const navigate = useNavigate();
  const pathname = Route.fullPath.split("?")[0];

  const [templateName, setTemplateName] = useState("");
  const [variableDefinitions, setVariableDefinitions] = useState<VariableDefinitions | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [varNames, setVarNames] = useState<string[]>([]);
  const [signerFullName, setSignerFullName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerRole, setSignerRole] = useState<"student" | "teacher" | "guardian" | "school_music">("student");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    missingVarNames: string[];
    missingSignerName: boolean;
    missingSignerEmail: boolean;
  } | null>(null);
  const [signingLink, setSigningLink] = useState<string | null>(null);
  const [readPreviewStatus, setReadPreviewStatus] = useState<"idle" | "loading" | "loaded" | "error" | "no-document">("idle");
  const [verifyPreviewStatus, setVerifyPreviewStatus] = useState<"idle" | "loading" | "loaded" | "error" | "no-document">("idle");
  const readPreviewRef = useRef<HTMLDivElement>(null);
  const verifyPreviewRef = useRef<HTMLDivElement>(null);
  const [readContainerReady, setReadContainerReady] = useState(false);
  const [verifyContainerReady, setVerifyContainerReady] = useState(false);
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, string[]>>({});
  const [dropdownSiblings, setDropdownSiblings] = useState<Record<string, string[]>>({});
  const [varOrder, setVarOrder] = useState<string[]>([]);

  const fillData = useQuery(api.contracts.getFillData, token ? { token } : "skip");
  const getTemplateContentHtml = useAction(templatesActions.getTemplateContentHtml);
  const getDocumentUrl = useAction(contractsActions.getDocumentUrl);
  const getReadStepPreviewUrl = useAction(contractsActions.getReadStepPreviewUrl);
  const generateDocument = useAction(contractsActions.generateDocument);
  const updateDraftAndGenerateDocument = useAction(contractsActions.updateDraftAndGenerateDocument);

  const contractId = fillData?.contract?._id ?? null;

  useEffect(() => {
    if (!fillData?.contract || !fillData.template) return;
    let cancelled = false;
    setTemplateName(fillData.template.name ?? "");
    const defs = (fillData.template.variableDefinitions ?? null) as VariableDefinitions | null;
    setVariableDefinitions(defs);
    const initialVars =
      fillData.contract.variablesList && Array.isArray(fillData.contract.variablesList)
        ? Object.fromEntries(fillData.contract.variablesList.map((p) => [p.key, p.value]))
        : {};
    getTemplateContentHtml({ templateId: fillData.template._id })
      .then((res) => {
        if (cancelled) return;
        const content = res.content;
        const hasContent = content && typeof content === "string" && content.trim().length > 0;
        const namesFromDocx = Array.isArray(res.variableNamesFromDocx) && res.variableNamesFromDocx.length > 0
          ? res.variableNamesFromDocx
          : null;
        const names = namesFromDocx ?? getVarNamesFromContentAndDefs(hasContent ? content : null, defs);
        setVarNames(names);
        const merged: Record<string, string> = {};
        const ctxForCoalesce: Record<string, unknown> = fillData?.coalesceContext
          ? {
              hasGuardian: fillData.coalesceContext.hasGuardian,
              contractFor: fillData.coalesceContext.contractFor,
            }
          : {};
        names.forEach((n) => {
          const v = initialVars[n];
          merged[n] = typeof v === "string" ? v : "";
        });
        for (const n of names) {
          if (studentGuardianCompositeKind(n)) {
            merged[n] = coalesceFromCompositeName(n, { ...initialVars, ...ctxForCoalesce });
            continue;
          }
          for (const part of expandPlaceholderToInputVariableKeys(n)) {
            if (part in merged) continue;
            merged[part] = typeof initialVars[part] === "string" ? initialVars[part] : "";
          }
        }
        const dropdownOpts: Record<string, string[]> = {};
        const dropdownSibs: Record<string, string[]> = {};
        const order: string[] = [];
        (defs as Array<{ name?: string; type?: string; options?: string[]; siblingVariables?: string[] }> ?? []).forEach((d) => {
          if (d.name) order.push(d.name);
          if (d.type === "dropdown" && Array.isArray(d.options)) dropdownOpts[d.name!] = d.options;
          if (d.siblingVariables && Array.isArray(d.siblingVariables)) dropdownSibs[d.name!] = d.siblingVariables;
        });
        if (Array.isArray(res.dropdownOptionsList)) {
          res.dropdownOptionsList.forEach(({ name, options }) => {
            dropdownOpts[name] = options;
          });
        }
        if (Array.isArray(res.dropdownSiblingsList)) {
          res.dropdownSiblingsList.forEach(({ dropdown, siblings }) => {
            dropdownSibs[dropdown] = siblings;
          });
        }
        const dropdownKeys = Object.keys(dropdownOpts);
        dropdownKeys.forEach((k) => {
          if (!(k in merged)) merged[k] = typeof initialVars[k] === "string" ? initialVars[k] : "";
        });
        const baseOrder = order.length ? order : names;
        const orderWithDropdowns = dropdownKeys.length
          ? [...new Set([...baseOrder, ...dropdownKeys])]
          : baseOrder;
        if (
          names.includes(CONTRACT_DATE_FIELD_NAME) &&
          !String(merged[CONTRACT_DATE_FIELD_NAME] ?? "").trim()
        ) {
          const t = todayIsoDateEuropeBucharest();
          if (t) merged[CONTRACT_DATE_FIELD_NAME] = t;
        }
        setVariables(merged);
        setDropdownOptions(dropdownOpts);
        setDropdownSiblings(dropdownSibs);
        setVarOrder(orderWithDropdowns);
      })
      .catch(() => {
        if (!cancelled) {
          setVarNames(Object.keys(initialVars));
          setVariables(initialVars);
        }
      });
    return () => { cancelled = true; };
  }, [fillData, getTemplateContentHtml]);

  const loadError = token && fillData === null ? "Link invalid sau expirat" : null;

  const update = useCallback((key: string, value: string) => {
    setVariables((p) => ({ ...p, [key]: value }));
  }, []);

  useEffect(() => {
    if (step !== "read" || !contractId || !readContainerReady || !readPreviewRef.current) return;
    let cancelled = false;
    setReadPreviewStatus("loading");
    const container = readPreviewRef.current;

    function loadPreview(url: string): Promise<void> {
      return fetch(url)
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
          if (!cancelled) setReadPreviewStatus("loaded");
        });
    }

    getReadStepPreviewUrl({ contractId })
      .then(async (previewUrl) => {
        if (cancelled) return;
        if (previewUrl) return loadPreview(previewUrl);
        return getDocumentUrl({ contractId }).then(async (url) => {
          if (cancelled) return;
          if (url) return loadPreview(url);
          await generateDocument({ contractId });
          if (cancelled) return;
          const retryUrl = await getDocumentUrl({ contractId });
          if (cancelled) return;
          if (retryUrl) return loadPreview(retryUrl);
          setReadPreviewStatus("no-document");
        });
      })
      .catch(() => {
        if (!cancelled) setReadPreviewStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [step, contractId, readContainerReady, getReadStepPreviewUrl, getDocumentUrl, generateDocument]);

  useEffect(() => {
    if (step !== "verify" || !contractId || !verifyContainerReady || !verifyPreviewRef.current) return;
    let cancelled = false;
    setVerifyPreviewStatus("loading");
    const container = verifyPreviewRef.current;

    function loadVerifyPreview(url: string): Promise<void> {
      return fetch(url)
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
        });
    }

    getDocumentUrl({ contractId })
      .then(async (url) => {
        if (cancelled) return;
        if (url) return loadVerifyPreview(url);
        await generateDocument({ contractId });
        if (cancelled) return;
        const retryUrl = await getDocumentUrl({ contractId });
        if (cancelled) return;
        if (retryUrl) return loadVerifyPreview(retryUrl);
        setVerifyPreviewStatus("no-document");
      })
      .catch(() => {
        if (!cancelled) setVerifyPreviewStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [step, contractId, verifyContainerReady, getDocumentUrl, generateDocument]);

  const dropdownMeta: DropdownSiblingMeta = useMemo(
    () => ({ dropdownOptions, dropdownSiblings }),
    [dropdownOptions, dropdownSiblings]
  );

  const siblingVarNames = useMemo(() => {
    const set = new Set<string>();
    for (const siblings of Object.values(dropdownSiblings)) {
      for (const s of siblings) set.add(s);
    }
    return set;
  }, [dropdownSiblings]);

  const formVarNames = useMemo(() => {
    const dropdownKeys = Object.keys(dropdownOptions);
    const list = new Set(varNames);
    dropdownKeys.forEach((k) => list.add(k));

    const isFormInputKey = (name: string) =>
      getVariableType(variableDefinitions, name) !== "signature" &&
      getVariableType(variableDefinitions, name) !== "contractNumber" &&
      !DERIVED_NO_INPUT_VAR_NAMES.includes(name) &&
      !siblingVarNames.has(name);

    const orderIdx = new Map(varOrder.map((n, i) => [n, i]));
    const sortedTemplateNames = [...list].sort((a, b) => {
      const ia = orderIdx.get(a) ?? 1e9;
      const ib = orderIdx.get(b) ?? 1e9;
      return ia - ib;
    });

    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of sortedTemplateNames) {
      if (name.includes("|")) {
        if (studentGuardianCompositeKind(name)) {
          if (!isFormInputKey(name) || seen.has(name)) continue;
          seen.add(name);
          out.push(name);
          continue;
        }
        for (const part of expandPlaceholderToInputVariableKeys(name)) {
          if (!isFormInputKey(part) || seen.has(part)) continue;
          seen.add(part);
          out.push(part);
        }
        continue;
      }
      if (!isFormInputKey(name) || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
    return out;
  }, [varNames, variableDefinitions, varOrder, dropdownOptions, siblingVarNames]);

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
    for (const name of Object.keys(payload)) {
      const v = variables[name];
      if (v === undefined) continue;
      const type = getVariableType(variableDefinitions, name);
      if (type === "date") payload[name] = formatDateToDisplay(v);
      else if (type === "month") payload[name] = monthCodeToName(v);
    }
    if (varNames.includes("Data_final_un_an") && (variables["Data"] ?? "").toString().trim()) {
      const iso = addDays((variables["Data"] ?? "").toString().trim(), 365);
      payload["Data_final_un_an"] = iso ? formatDateToDisplay(iso) : "";
    }
    const dur = computeContractDurationDays(
      payload["contractStartDate"] ?? variables["contractStartDate"],
      payload["contractEndDate"] ?? variables["contractEndDate"]
    );
    if (dur !== "") {
      payload["contractDurationDays"] = dur;
      payload["Perioada contract (in zile)"] = dur;
    }
    const cc = fillData?.coalesceContext;
    const coalesceCtx = cc
      ? { contractFor: cc.contractFor, hasGuardian: cc.hasGuardian }
      : undefined;
    const payloadWithAtoms = applyStudentGuardianSingleFieldToPayload(
      payload,
      varNames,
      coalesceCtx ?? {}
    );
    const payloadWithCoalesce = mergeCoalesceCompositePlaceholders(
      payloadWithAtoms,
      varNames,
      coalesceCtx
    );
    if (!contractId) return;
    try {
      const variablesList = Object.entries(payloadWithCoalesce).map(([key, value]) => ({
        key,
        value: String(value ?? ""),
      }));
      const data = await updateDraftAndGenerateDocument({
        contractId,
        variablesList,
        signers: signerFullName.trim() && signerEmail.trim()
          ? [{ fullName: signerFullName.trim(), email: signerEmail.trim(), role: signerRole }]
          : [],
      });
      setStatus("success");
      const first = data.signingLinks?.[0] as { signingLink: string } | undefined;
      setSigningLink(first?.signingLink ?? null);
      navigate({ to: "/contract/completeaza/$token", params: { token }, search: { step: "verify" } });
    } catch (err) {
      setFieldErrors(null);
      setErrorMessage(err instanceof Error ? err.message : "Eroare la salvare");
      setStatus("error");
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-3 sm:p-6">
        <p className="text-zinc-500 text-sm">Link invalid.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-3 sm:p-6">
        <p className="text-red-600 dark:text-red-400 text-sm">{loadError}</p>
        <Link to="/" className="mt-2 inline-block text-sm text-zinc-600 dark:text-zinc-400 hover:underline">Înapoi</Link>
      </div>
    );
  }

  if (!templateName) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-3 sm:p-6 flex items-center justify-center">
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
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-3 sm:p-6">
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
              className="min-h-[260px] sm:min-h-[420px] max-h-[50vh] sm:max-h-[70vh] overflow-auto p-2 sm:p-4 docx-wrapper contract-preview bg-white text-zinc-900"
              style={{ maxHeight: "70vh" }}
            />
            {readPreviewStatus === "loading" && (
              <p className="p-4 text-zinc-500 dark:text-zinc-400 text-sm">Se încarcă documentul…</p>
            )}
            {readPreviewStatus === "no-document" && (
              <p className="p-4 text-zinc-600 dark:text-zinc-400 text-sm">Documentul nu este încă disponibil. Poți continua la pasul 2 pentru a completa datele.</p>
            )}
            {readPreviewStatus === "error" && (
              <p className="p-4 text-amber-600 dark:text-amber-400 text-sm">Nu s-a putut încărca previzualizarea. Poți continua la pasul 2.</p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate({ to: "/contract/completeaza/$token", params: { token }, search: { step: "form" } })}
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
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-3 sm:p-6">
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
              className="min-h-[260px] sm:min-h-[420px] max-h-[50vh] sm:max-h-[70vh] overflow-auto p-2 sm:p-4 docx-wrapper contract-preview bg-white text-zinc-900"
              style={{ maxHeight: "70vh" }}
            />
            {verifyPreviewStatus === "loading" && (
              <p className="p-4 text-zinc-500 dark:text-zinc-400 text-sm">Se încarcă documentul…</p>
            )}
            {verifyPreviewStatus === "no-document" && (
              <p className="p-4 text-zinc-600 dark:text-zinc-400 text-sm">Documentul se generează. Poți continua la semnare mai jos.</p>
            )}
            {verifyPreviewStatus === "error" && (
              <p className="p-4 text-amber-600 dark:text-amber-400 text-sm">Nu s-a putut încărca previzualizarea. Poți continua la semnare.</p>
            )}
          </div>
          {signingLink ? (
            <div className="flex flex-wrap gap-3 items-center">
              <Link
                to="/contract/completeaza/$token"
                params={{ token }}
                search={{ step: "form" }}
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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-3 sm:p-6">
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
              const def = getVariableDefinition(variableDefinitions, name);
              const label = getVariableLabel(def, name);
              return (
                <div key={name} className="space-y-1">
                  <label htmlFor={`var-${name}`} className={labelClass}>
                    {label}
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
              <select id="signerRole" value={signerRole} onChange={(e) => setSignerRole(e.target.value as "student" | "teacher" | "guardian" | "school_music")} className={inputClass} disabled={status === "loading"}>
                <option value="student">Student</option>
                <option value="guardian">Părinte / Tutore legal</option>
                <option value="teacher">Profesor</option>
                <option value="school_music">Școală de muzică</option>
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
              to="/contract/completeaza/$token"
              params={{ token }}
              search={{ step: "read" }}
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
