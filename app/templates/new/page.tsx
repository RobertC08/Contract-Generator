"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import type { VariableDefinition, VariableDefinitions } from "@/lib/contracts/variable-definitions";
import { validateVariableDefinitions } from "@/lib/contracts/variable-definitions";
import { VariableDefinitionsEditor } from "@/app/components/variable-definitions-editor";

const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 text-sm";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";

async function extractVariablesFromDocx(docxFile: File): Promise<string[]> {
  const formData = new FormData();
  formData.set("file", docxFile);
  const res = await fetch("/api/templates/extract-variables", { method: "POST", body: formData });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message ?? "Eroare la extragere");
  }
  const data = (await res.json()) as { variableNames?: string[] };
  return Array.isArray(data.variableNames) ? data.variableNames : [];
}

function mergeVariableNamesIntoDefs(
  current: VariableDefinitions,
  names: string[]
): VariableDefinitions {
  const existing = new Set(current.map((d) => d.name));
  const toAdd: VariableDefinition[] = names
    .filter((n) => !existing.has(n))
    .map((name) => ({ name, type: "text" }));
  return toAdd.length ? [...current, ...toAdd] : current;
}

export default function NewTemplatePage() {
  const [name, setName] = useState("");
  const [variableDefinitions, setVariableDefinitions] = useState<VariableDefinitions>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewDocx, setPreviewDocx] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [extractStatus, setExtractStatus] = useState<"idle" | "loading" | "done">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = useCallback(
    (selected: File | null) => {
      setFile(selected);
      if (!selected || selected.size === 0) {
        setExtractStatus("idle");
        return;
      }
      const isDocx =
        selected.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        selected.name.toLowerCase().endsWith(".docx");
      if (!isDocx) return;
      setExtractStatus("loading");
      extractVariablesFromDocx(selected)
        .then((names) => {
          setVariableDefinitions((prev) => mergeVariableNamesIntoDefs(prev, names));
          setExtractStatus("done");
        })
        .catch(() => setExtractStatus("idle"));
    },
    []
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateVariableDefinitions(variableDefinitions);
    if (!validation.success) {
      setErrorMessage(validation.message);
      setStatus("error");
      return;
    }
    if (!file || file.size === 0) {
      setErrorMessage("Încarcă un fișier .docx");
      setStatus("error");
      return;
    }
    setStatus("saving");
    setErrorMessage("");
    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("file", file);
    if (previewDocx && previewDocx.size > 0) formData.set("previewDocx", previewDocx);
    formData.set("variableDefinitions", JSON.stringify(variableDefinitions));
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        body: formData,
      });
      const text = await res.text();
      let data: { id?: string; message?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        if (!res.ok) {
          setErrorMessage(res.status === 413 ? "Fișierul este prea mare. Încercați un DOCX mai mic." : "Eroare la salvare.");
          setStatus("error");
          return;
        }
      }
      if (!res.ok) {
        setErrorMessage(data.message ?? (res.status === 413 ? "Fișierul este prea mare." : "Eroare la salvare"));
        setStatus("error");
        return;
      }
      setSavedId(data.id ?? null);
      setStatus("done");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Eroare de rețea");
      setStatus("error");
    }
  }

  if (status === "done" && savedId) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <main className="max-w-xl mx-auto">
          <p className="text-zinc-700 dark:text-zinc-300 mb-4">Template salvat.</p>
          <Link
            href={`/templates/${savedId}/edit`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Editează template
          </Link>
          {" · "}
          <Link href="/templates" className="text-blue-600 dark:text-blue-400 hover:underline">
            Lista template-uri
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <main className="max-w-2xl mx-auto">
        <Link
          href="/templates"
          className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-4 inline-block"
        >
          ← Template-uri
        </Link>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          Template nou
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6">
          Încarcă un fișier Word (.docx) cu placeholdere în format {"{numeVariabila}"}. Apoi definește variabilele.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className={labelClass}>Nume template</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="ex. Contract prestări servicii"
              required
            />
          </div>
          <div>
            <label className={labelClass}>Fișier DOCX</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
              className={inputClass}
            />
            {file && (
              <p className="mt-1 text-xs text-zinc-500">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
                {extractStatus === "loading" && " · Se extrag variabilele…"}
                {extractStatus === "done" && " · Variabilele au fost adăugate în listă."}
              </p>
            )}
          </div>
          <div>
            <label className={labelClass}>DOCX pentru preview (opțional) – pentru pasul 1</label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Încarcă un DOCX (original, fără variabile) ca să se afișeze la „Citește contractul” cu locuri goale.</p>
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) { setPreviewDocx(null); return; }
                const isDocx = f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || f.name.toLowerCase().endsWith(".docx");
                if (!isDocx) {
                  e.target.value = "";
                  setPreviewDocx(null);
                  setErrorMessage("Doar fișiere DOCX sunt acceptate la preview. Alegeți un .docx.");
                  return;
                }
                setErrorMessage("");
                setPreviewDocx(f);
              }}
              className={inputClass}
            />
            {previewDocx && (
              <p className="mt-1 text-xs text-zinc-500">{previewDocx.name} ({(previewDocx.size / 1024).toFixed(1)} KB)</p>
            )}
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
            <VariableDefinitionsEditor
              value={variableDefinitions}
              onChange={setVariableDefinitions}
              contentForDetect=""
              onVariableFocus={() => {}}
              onVariableRename={() => {}}
            />
          </div>
          {errorMessage && (
            <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={status === "saving"}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
            >
              {status === "saving" ? "Se salvează…" : "Salvează"}
            </button>
            <Link
              href="/templates"
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Anulare
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
