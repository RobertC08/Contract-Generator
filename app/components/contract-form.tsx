"use client";

import { useState, useEffect, useMemo } from "react";

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
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), escapeHtml(String(value ?? "")));
  }
  out = out.replace(/\{\{[^}]+\}\}/g, "");
  out = out.replace(
    "</head>",
    "<style>body { padding: 25mm; }</style></head>"
  );
  return out;
}

type FormState = {
  contractNr: string;
  contractData: string;
  prestatorNume: string;
  prestatorSediu: string;
  prestatorRegCom: string;
  prestatorCUI: string;
  prestatorCont: string;
  prestatorBanca: string;
  prestatorReprezentant: string;
  beneficiarNume: string;
  beneficiarSediu: string;
  beneficiarRegCom: string;
  beneficiarCUI: string;
  beneficiarCont: string;
  beneficiarBanca: string;
  beneficiarReprezentant: string;
  lunaInceput: string;
  anulInceput: string;
  dataIntrareVigoare: string;
  pretLunar: string;
};

const initial: FormState = {
  contractNr: "",
  contractData: "",
  prestatorNume: "",
  prestatorSediu: "",
  prestatorRegCom: "",
  prestatorCUI: "",
  prestatorCont: "",
  prestatorBanca: "",
  prestatorReprezentant: "",
  beneficiarNume: "",
  beneficiarSediu: "",
  beneficiarRegCom: "",
  beneficiarCUI: "",
  beneficiarCont: "",
  beneficiarBanca: "",
  beneficiarReprezentant: "",
  lunaInceput: "",
  anulInceput: "",
  dataIntrareVigoare: "",
  pretLunar: "",
};

const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 text-sm";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

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

export function ContractForm() {
  const [form, setForm] = useState<FormState>(initial);
  const [templateContent, setTemplateContent] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/contracts?templateId=${encodeURIComponent(TEMPLATE_ID)}`)
      .then((r) => r.json())
      .then((data) => data.content != null && setTemplateContent(data.content))
      .catch(() => setTemplateContent(""));
  }, []);

  const previewHtml = useMemo(
    () => (templateContent ? renderPreview(templateContent, form) : null),
    [templateContent, form]
  );

  const update = (key: keyof FormState, value: string) =>
    setForm((p) => ({ ...p, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: TEMPLATE_ID,
          variables: form,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.message ?? res.statusText ?? "Failed to generate PDF");
        setStatus("error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "contract-prestari-servicii.pdf";
      a.click();
      URL.revokeObjectURL(url);
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
          <Field
            id="contractData"
            label="Data contract"
            value={form.contractData}
            onChange={(v) => update("contractData", v)}
            placeholder="01.01.2025"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-700 pb-1">
          Prestator
        </h3>
        <div className="grid gap-3">
          <Field id="prestatorNume" label="Denumire" value={form.prestatorNume} onChange={(v) => update("prestatorNume", v)} placeholder="SC Exemplu SRL" />
          <Field id="prestatorSediu" label="Sediul social" value={form.prestatorSediu} onChange={(v) => update("prestatorSediu", v)} placeholder="Adresa completă" />
          <div className="grid grid-cols-2 gap-3">
            <Field id="prestatorRegCom" label="Reg. Comerțului nr." value={form.prestatorRegCom} onChange={(v) => update("prestatorRegCom", v)} />
            <Field id="prestatorCUI" label="CUI" value={form.prestatorCUI} onChange={(v) => update("prestatorCUI", v)} />
          </div>
          <Field id="prestatorCont" label="Cont bancar" value={form.prestatorCont} onChange={(v) => update("prestatorCont", v)} placeholder="RO00XXXX..." />
          <Field id="prestatorBanca" label="Banca" value={form.prestatorBanca} onChange={(v) => update("prestatorBanca", v)} placeholder="ING Bank" />
          <Field id="prestatorReprezentant" label="Reprezentant" value={form.prestatorReprezentant} onChange={(v) => update("prestatorReprezentant", v)} placeholder="Nume Prenume" />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-700 pb-1">
          Beneficiar
        </h3>
        <div className="grid gap-3">
          <Field id="beneficiarNume" label="Denumire" value={form.beneficiarNume} onChange={(v) => update("beneficiarNume", v)} placeholder="SC Client SRL" />
          <Field id="beneficiarSediu" label="Sediul social" value={form.beneficiarSediu} onChange={(v) => update("beneficiarSediu", v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field id="beneficiarRegCom" label="Reg. Comerțului nr." value={form.beneficiarRegCom} onChange={(v) => update("beneficiarRegCom", v)} />
            <Field id="beneficiarCUI" label="CUI" value={form.beneficiarCUI} onChange={(v) => update("beneficiarCUI", v)} />
          </div>
          <Field id="beneficiarCont" label="Cont bancar" value={form.beneficiarCont} onChange={(v) => update("beneficiarCont", v)} />
          <Field id="beneficiarBanca" label="Banca" value={form.beneficiarBanca} onChange={(v) => update("beneficiarBanca", v)} />
          <Field id="beneficiarReprezentant" label="Reprezentant" value={form.beneficiarReprezentant} onChange={(v) => update("beneficiarReprezentant", v)} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-700 pb-1">
          Servicii și preț
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Field id="lunaInceput" label="Luna început servicii" value={form.lunaInceput} onChange={(v) => update("lunaInceput", v)} placeholder="ianuarie" />
          <Field id="anulInceput" label="Anul început" value={form.anulInceput} onChange={(v) => update("anulInceput", v)} placeholder="2025" />
          <Field id="dataIntrareVigoare" label="Data intrării în vigoare" value={form.dataIntrareVigoare} onChange={(v) => update("dataIntrareVigoare", v)} placeholder="01.01.2025" />
          <Field id="pretLunar" label="Preț lunar (lei)" value={form.pretLunar} onChange={(v) => update("pretLunar", v)} placeholder="500" />
        </div>
      </section>

      {status === "error" && errorMessage && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {errorMessage}
        </p>
      )}
      {status === "success" && (
        <p className="text-sm text-green-600 dark:text-green-400">PDF descărcat.</p>
      )}
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2.5 font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {status === "loading" ? "Se generează PDF…" : "Generează PDF"}
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
