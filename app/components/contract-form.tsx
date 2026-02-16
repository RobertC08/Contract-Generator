"use client";

import { useState, useEffect, useMemo } from "react";
import { VariableInput } from "@/app/components/variable-input";

const TEMPLATE_ID = "contract-prestari-servicii";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPreview(templateHtml: string, variables: FormState): string {
  let out = templateHtml;
  for (const [key, value] of Object.entries(variables)) {
    const str = value != null ? String(value) : "";
    const replacement =
      typeof value === "string" && value.startsWith("data:image")
        ? `<img src="${value.replace(/"/g, "&quot;")}" alt="Semnătură" class="signature-img" style="max-width: 200px; max-height: 100px; width: auto; height: auto;" />`
        : escapeHtml(str);
    out = out.replace(new RegExp(`\\{\\{\\{\\s*${key}\\s*\\}\\}\\}`, "g"), replacement);
    out = out.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), replacement);
  }
  out = out.replace(/\{\{\{[^}]+\}\}\}/g, "");
  out = out.replace(/\{\{[^}]+\}\}/g, "");
  const previewStyles =
    "html { box-sizing: border-box; } body, body * { box-sizing: border-box; overflow-wrap: break-word; word-break: break-word; } body { width: 100%; max-width: 210mm; padding: 15mm; } p { margin: 2mm 0; } h1 { font-size: 14pt; text-align: center; margin: 4mm 0; } h2 { font-size: 12pt; margin: 4mm 0 2mm; } .signature-img { max-width: 200px; max-height: 100px; width: auto; height: auto; display: inline-block; vertical-align: middle; }";
  if (out.includes("</head>")) {
    out = out.replace("</head>", `<style>${previewStyles}</style></head>`);
  } else if (out.includes("<body")) {
    out = out.replace("<body", `<head><meta charset="utf-8"><title>Contract</title><style>${previewStyles}</style></head><body`);
  }
  return out;
}

type TipParte = "juridica" | "fizica";

type FormState = {
  contractNr: string;
  contractData: string;
  prestatorTip: TipParte;
  prestatorNume: string;
  prestatorSediu: string;
  prestatorRegCom: string;
  prestatorCUI: string;
  prestatorCNP: string;
  prestatorCont: string;
  prestatorBanca: string;
  prestatorReprezentant: string;
  beneficiarTip: TipParte;
  beneficiarNume: string;
  beneficiarSediu: string;
  beneficiarRegCom: string;
  beneficiarCUI: string;
  beneficiarCNP: string;
  beneficiarCont: string;
  beneficiarBanca: string;
  beneficiarReprezentant: string;
  prestatorSignature: string;
  beneficiarSignature: string;
  lunaInceput: string;
  anulInceput: string;
  dataIntrareVigoare: string;
  pretLunar: string;
};

const initial: FormState = {
  contractNr: "",
  contractData: "",
  prestatorTip: "juridica",
  prestatorNume: "",
  prestatorSediu: "",
  prestatorRegCom: "",
  prestatorCUI: "",
  prestatorCNP: "",
  prestatorCont: "",
  prestatorBanca: "",
  prestatorReprezentant: "",
  beneficiarTip: "juridica",
  beneficiarNume: "",
  beneficiarSediu: "",
  beneficiarRegCom: "",
  beneficiarCUI: "",
  beneficiarCNP: "",
  beneficiarCont: "",
  beneficiarBanca: "",
  beneficiarReprezentant: "",
  prestatorSignature: "",
  beneficiarSignature: "",
  lunaInceput: "",
  anulInceput: "",
  dataIntrareVigoare: "",
  pretLunar: "",
};

function buildPrestatorDescriere(f: FormState): string {
  if (f.prestatorTip === "juridica") {
    return `${f.prestatorNume}, cu sediul social în ${f.prestatorSediu}, înregistrată la Registrul Comerțului sub nr. ${f.prestatorRegCom}, CUI ${f.prestatorCUI}, cont nr. ${f.prestatorCont} deschis la ${f.prestatorBanca}, reprezentată prin dl. ${f.prestatorReprezentant}.`;
  }
  return `${f.prestatorNume} (persoană fizică), CNP ${f.prestatorCNP}, domiciliul în ${f.prestatorSediu}, cont nr. ${f.prestatorCont} deschis la ${f.prestatorBanca}.`;
}

function buildBeneficiarDescriere(f: FormState): string {
  if (f.beneficiarTip === "juridica") {
    return `${f.beneficiarNume}, cu sediul social în ${f.beneficiarSediu}, înregistrată la Registrul Comerțului sub nr. ${f.beneficiarRegCom}, CUI ${f.beneficiarCUI}, cont nr. ${f.beneficiarCont} deschis la ${f.beneficiarBanca}, reprezentată prin ${f.beneficiarReprezentant}.`;
  }
  return `${f.beneficiarNume} (persoană fizică), CNP ${f.beneficiarCNP}, domiciliul în ${f.beneficiarSediu}, cont nr. ${f.beneficiarCont} deschis la ${f.beneficiarBanca}.`;
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 text-sm";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

const LUNI = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

function isValidCuiInput(cui: string): boolean {
  const digits = cui.replace(/\s/g, "").replace(/^RO/i, "").replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 10;
}

type AnafLookupResponse = {
  denumire: string;
  adresa: string;
  nrRegCom: string;
  iban?: string;
  cui: string;
  telefon?: string;
};

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  required = true,
}: {
  id: keyof FormState;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={inputClass}
        placeholder={placeholder}
      />
    </div>
  );
}

function formatDateToDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function DateField({
  id,
  label,
  value,
  onChange,
  required = true,
}: {
  id: keyof FormState;
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key.length === 1) e.preventDefault(); }}
        required={required}
        className={inputClass}
      />
    </div>
  );
}

type AnafSectionStatus = "idle" | "loading" | "error" | "success";

export function ContractForm() {
  const [form, setForm] = useState<FormState>(initial);
  const [templateContent, setTemplateContent] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [anafPrestator, setAnafPrestator] = useState<AnafSectionStatus>("idle");
  const [anafPrestatorError, setAnafPrestatorError] = useState<string | null>(null);
  const [anafBeneficiar, setAnafBeneficiar] = useState<AnafSectionStatus>("idle");
  const [anafBeneficiarError, setAnafBeneficiarError] = useState<string | null>(null);
  const [createdDocumentUrl, setCreatedDocumentUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/contracts?templateId=${encodeURIComponent(TEMPLATE_ID)}`)
      .then((r) => r.json())
      .then((data) => data.content != null && setTemplateContent(data.content))
      .catch(() => setTemplateContent(""));
  }, []);

  const previewVariables = useMemo(
    () => ({
      ...form,
      contractData: formatDateToDisplay(form.contractData) || form.contractData,
      dataIntrareVigoare: formatDateToDisplay(form.dataIntrareVigoare) || form.dataIntrareVigoare,
      prestatorDescriere: buildPrestatorDescriere(form),
      beneficiarDescriere: buildBeneficiarDescriere(form),
    }),
    [form]
  );

  const previewHtml = useMemo(
    () => (templateContent ? renderPreview(templateContent, previewVariables) : null),
    [templateContent, previewVariables]
  );

  const update = (key: keyof FormState, value: string | TipParte) =>
    setForm((p) => ({ ...p, [key]: value }));

  async function fetchAnafPrestator() {
    const cui = form.prestatorCUI.trim();
    if (!isValidCuiInput(cui)) return;
    setAnafPrestator("loading");
    setAnafPrestatorError(null);
    try {
      const res = await fetch("/api/anaf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cui }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string } & AnafLookupResponse;
      if (!res.ok) {
        setAnafPrestatorError(data.message ?? "Eroare la căutare");
        setAnafPrestator("error");
        return;
      }
      setForm((p) => ({
        ...p,
        prestatorNume: data.denumire ?? p.prestatorNume,
        prestatorSediu: data.adresa ?? p.prestatorSediu,
        prestatorRegCom: data.nrRegCom ?? p.prestatorRegCom,
        prestatorCont: data.iban ?? p.prestatorCont,
      }));
      setAnafPrestator("success");
    } catch {
      setAnafPrestatorError("Eroare rețea");
      setAnafPrestator("error");
    }
  }

  async function fetchAnafBeneficiar() {
    const cui = form.beneficiarCUI.trim();
    if (!isValidCuiInput(cui)) return;
    setAnafBeneficiar("loading");
    setAnafBeneficiarError(null);
    try {
      const res = await fetch("/api/anaf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cui }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string } & AnafLookupResponse;
      if (!res.ok) {
        setAnafBeneficiarError(data.message ?? "Eroare la căutare");
        setAnafBeneficiar("error");
        return;
      }
      setForm((p) => ({
        ...p,
        beneficiarNume: data.denumire ?? p.beneficiarNume,
        beneficiarSediu: data.adresa ?? p.beneficiarSediu,
        beneficiarRegCom: data.nrRegCom ?? p.beneficiarRegCom,
        beneficiarCont: data.iban ?? p.beneficiarCont,
      }));
      setAnafBeneficiar("success");
    } catch {
      setAnafBeneficiarError("Eroare rețea");
      setAnafBeneficiar("error");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage(null);
    setCreatedDocumentUrl(null);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: TEMPLATE_ID,
          variables: {
            ...form,
            contractData: formatDateToDisplay(form.contractData) || form.contractData,
            dataIntrareVigoare: formatDateToDisplay(form.dataIntrareVigoare) || form.dataIntrareVigoare,
            prestatorDescriere: buildPrestatorDescriere(form),
            beneficiarDescriere: buildBeneficiarDescriere(form),
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = (data as { message?: string; error?: string }).message ?? (data as { message?: string; error?: string }).error ?? res.statusText ?? "Failed to generate document";
        setErrorMessage(errMsg);
        setStatus("error");
        return;
      }
      if (data.success && data.documentUrl) {
        setCreatedDocumentUrl(data.documentUrl);
      }
      setStatus("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Network error");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 flex-shrink-0 w-full lg:max-w-md lg:sticky lg:top-4 lg:self-start rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-700 pb-1">
          Contract
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Field
            id="contractNr"
            label="Nr. contract"
            value={form.contractNr}
            onChange={(v) => update("contractNr", v)}
            placeholder="1"
          />
          <DateField
            id="contractData"
            label="Data contract"
            value={form.contractData}
            onChange={(v) => update("contractData", v)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-700 pb-1">
          Prestator
        </h3>
        <div className="space-y-2">
          <span className={labelClass}>Tip</span>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="prestatorTip"
                checked={form.prestatorTip === "juridica"}
                onChange={() => update("prestatorTip", "juridica")}
                className="rounded border-zinc-400 text-zinc-900 focus:ring-zinc-500"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Persoană juridică</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="prestatorTip"
                checked={form.prestatorTip === "fizica"}
                onChange={() => update("prestatorTip", "fizica")}
                className="rounded border-zinc-400 text-zinc-900 focus:ring-zinc-500"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Persoană fizică</span>
            </label>
          </div>
        </div>
        <div className="grid gap-3">
          {form.prestatorTip === "juridica" ? (
            <>
              <div className="flex gap-2 items-end">
                <div className="flex-1 min-w-0">
                  <Field id="prestatorCUI" label="CUI" value={form.prestatorCUI} onChange={(v) => update("prestatorCUI", v)} placeholder="123456" />
                </div>
                <button
                  type="button"
                  onClick={fetchAnafPrestator}
                  disabled={!isValidCuiInput(form.prestatorCUI.trim()) || anafPrestator === "loading"}
                  className="flex-shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {anafPrestator === "loading" ? "Se caută…" : "Caută după CUI"}
                </button>
              </div>
              {anafPrestator === "error" && anafPrestatorError && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">{anafPrestatorError}</p>
              )}
              {anafPrestator === "success" && (
                <p className="text-sm text-green-600 dark:text-green-400">Date completate din ANAF.</p>
              )}
              <Field id="prestatorNume" label="Denumire" value={form.prestatorNume} onChange={(v) => update("prestatorNume", v)} placeholder="SC Exemplu SRL" />
              <Field id="prestatorSediu" label="Sediul social" value={form.prestatorSediu} onChange={(v) => update("prestatorSediu", v)} placeholder="Adresa completă" />
              <Field id="prestatorRegCom" label="Reg. Comerțului nr." value={form.prestatorRegCom} onChange={(v) => update("prestatorRegCom", v)} />
              <Field id="prestatorReprezentant" label="Reprezentant" value={form.prestatorReprezentant} onChange={(v) => update("prestatorReprezentant", v)} placeholder="Nume Prenume" />
            </>
          ) : (
            <>
              <Field id="prestatorNume" label="Nume complet" value={form.prestatorNume} onChange={(v) => update("prestatorNume", v)} placeholder="Nume Prenume" />
              <Field id="prestatorSediu" label="Adresa" value={form.prestatorSediu} onChange={(v) => update("prestatorSediu", v)} placeholder="Adresa completă" />
              <Field id="prestatorCNP" label="CNP" value={form.prestatorCNP} onChange={(v) => update("prestatorCNP", v)} placeholder="1234567890123" />
            </>
          )}
          <Field id="prestatorCont" label="Cont bancar" value={form.prestatorCont} onChange={(v) => update("prestatorCont", v)} placeholder="RO00XXXX..." />
          <Field id="prestatorBanca" label="Banca" value={form.prestatorBanca} onChange={(v) => update("prestatorBanca", v)} placeholder="ING Bank" />
          <VariableInput
            name="prestatorSignature"
            type="signature"
            value={form.prestatorSignature}
            onChange={(v) => update("prestatorSignature", v)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-700 pb-1">
          Beneficiar
        </h3>
        <div className="space-y-2">
          <span className={labelClass}>Tip</span>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="beneficiarTip"
                checked={form.beneficiarTip === "juridica"}
                onChange={() => update("beneficiarTip", "juridica")}
                className="rounded border-zinc-400 text-zinc-900 focus:ring-zinc-500"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Persoană juridică</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="beneficiarTip"
                checked={form.beneficiarTip === "fizica"}
                onChange={() => update("beneficiarTip", "fizica")}
                className="rounded border-zinc-400 text-zinc-900 focus:ring-zinc-500"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Persoană fizică</span>
            </label>
          </div>
        </div>
        <div className="grid gap-3">
          {form.beneficiarTip === "juridica" ? (
            <>
              <div className="flex gap-2 items-end">
                <div className="flex-1 min-w-0">
                  <Field id="beneficiarCUI" label="CUI" value={form.beneficiarCUI} onChange={(v) => update("beneficiarCUI", v)} placeholder="123456" />
                </div>
                <button
                  type="button"
                  onClick={fetchAnafBeneficiar}
                  disabled={!isValidCuiInput(form.beneficiarCUI.trim()) || anafBeneficiar === "loading"}
                  className="flex-shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {anafBeneficiar === "loading" ? "Se caută…" : "Caută după CUI"}
                </button>
              </div>
              {anafBeneficiar === "error" && anafBeneficiarError && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">{anafBeneficiarError}</p>
              )}
              {anafBeneficiar === "success" && (
                <p className="text-sm text-green-600 dark:text-green-400">Date completate din ANAF.</p>
              )}
              <Field id="beneficiarNume" label="Denumire" value={form.beneficiarNume} onChange={(v) => update("beneficiarNume", v)} placeholder="SC Client SRL" />
              <Field id="beneficiarSediu" label="Sediul social" value={form.beneficiarSediu} onChange={(v) => update("beneficiarSediu", v)} />
              <Field id="beneficiarRegCom" label="Reg. Comerțului nr." value={form.beneficiarRegCom} onChange={(v) => update("beneficiarRegCom", v)} />
              <Field id="beneficiarReprezentant" label="Reprezentant" value={form.beneficiarReprezentant} onChange={(v) => update("beneficiarReprezentant", v)} />
            </>
          ) : (
            <>
              <Field id="beneficiarNume" label="Nume complet" value={form.beneficiarNume} onChange={(v) => update("beneficiarNume", v)} placeholder="Nume Prenume" />
              <Field id="beneficiarSediu" label="Adresa" value={form.beneficiarSediu} onChange={(v) => update("beneficiarSediu", v)} />
              <Field id="beneficiarCNP" label="CNP" value={form.beneficiarCNP} onChange={(v) => update("beneficiarCNP", v)} placeholder="1234567890123" />
            </>
          )}
          <Field id="beneficiarCont" label="Cont bancar" value={form.beneficiarCont} onChange={(v) => update("beneficiarCont", v)} />
          <Field id="beneficiarBanca" label="Banca" value={form.beneficiarBanca} onChange={(v) => update("beneficiarBanca", v)} />
          <VariableInput
            name="beneficiarSignature"
            type="signature"
            value={form.beneficiarSignature}
            onChange={(v) => update("beneficiarSignature", v)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-700 pb-1">
          Servicii și preț
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="lunaInceput" className={labelClass}>
              Luna început servicii
            </label>
            <select
              id="lunaInceput"
              value={form.lunaInceput}
              onChange={(e) => update("lunaInceput", e.target.value)}
              required
              className={inputClass}
            >
              <option value="">Selectați luna</option>
              {LUNI.map((luna) => (
                <option key={luna} value={luna}>{luna}</option>
              ))}
            </select>
          </div>
          <Field id="anulInceput" label="Anul început" value={form.anulInceput} onChange={(v) => update("anulInceput", v)} placeholder="2025" />
          <DateField id="dataIntrareVigoare" label="Data intrării în vigoare" value={form.dataIntrareVigoare} onChange={(v) => update("dataIntrareVigoare", v)} />
          <Field id="pretLunar" label="Preț lunar (lei)" value={form.pretLunar} onChange={(v) => update("pretLunar", v)} placeholder="500" />
        </div>
      </section>

      {status === "error" && errorMessage && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-3" role="alert">
          <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">Eroare</p>
          <p className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap break-words">{errorMessage}</p>
        </div>
      )}
      {status === "success" && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Contract creat.
          {createdDocumentUrl && (
            <a href={createdDocumentUrl} download="contract-prestari-servicii.docx" className="ml-1 underline">Descarcă DOCX</a>
          )}
        </p>
      )}
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {status === "loading" ? "Se generează document…" : "Generează DOCX"}
      </button>
    </form>
      <div className="flex-1 min-w-0 lg:sticky lg:top-6 lg:self-start lg:h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-3rem)] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm flex flex-col">
        <div className="flex-shrink-0 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          Previzualizare contract (se actualizează în timp real)
        </div>
        <div className="flex-1 min-h-[300px] overflow-auto">
          {previewHtml ? (
            <iframe
              title="Previzualizare contract"
              srcDoc={previewHtml}
              className="w-full h-full min-h-[600px] border-0 bg-white"
              sandbox="allow-same-origin"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-500 dark:text-zinc-400 text-sm">
              Se încarcă template-ul…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
