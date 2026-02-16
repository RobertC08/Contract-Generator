"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { VariableDefinition, VariableDefinitions } from "@/lib/contracts/variable-definitions";
import { validateVariableDefinitions } from "@/lib/contracts/variable-definitions";
import { VariableDefinitionsEditor } from "@/app/components/variable-definitions-editor";

const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 text-sm";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";

export default function EditTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [name, setName] = useState("");
  const [variableDefinitions, setVariableDefinitions] = useState<VariableDefinitions>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewDocx, setPreviewDocx] = useState<File | null>(null);
  const [clearPreviewDocx, setClearPreviewDocx] = useState(false);
  const [hasPreviewDocx, setHasPreviewDocx] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "done" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [extractLoading, setExtractLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleExtractFromDocx() {
    if (!id || extractLoading) return;
    setExtractLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(id)}/extract-variables`);
      const data = (await res.json()) as { variableNames?: string[]; message?: string };
      if (!res.ok) {
        setErrorMessage(data.message ?? "Eroare la extragere");
        return;
      }
      const names = Array.isArray(data.variableNames) ? data.variableNames : [];
      setVariableDefinitions((prev) => mergeVariableNamesIntoDefs(prev, names));
    } catch {
      setErrorMessage("Eroare de rețea");
    } finally {
      setExtractLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    fetch(`/api/templates/${encodeURIComponent(id)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setStatus("error");
          setErrorMessage(data.message ?? "Template negăsit");
          return;
        }
        setName(data.name ?? "");
        setVariableDefinitions(Array.isArray(data.variableDefinitions) ? data.variableDefinitions : []);
        setHasPreviewDocx(Boolean(data.hasPreviewDocx));
        setStatus("idle");
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage("Eroare la încărcare");
      });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateVariableDefinitions(variableDefinitions);
    if (!validation.success) {
      setErrorMessage(validation.message);
      setStatus("error");
      return;
    }
    setStatus("saving");
    setErrorMessage("");
    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("variableDefinitions", JSON.stringify(variableDefinitions));
    if (file && file.size > 0) formData.set("file", file);
    if (clearPreviewDocx) formData.set("clearPreviewDocx", "true");
    else if (previewDocx && previewDocx.size > 0) formData.set("previewDocx", previewDocx);
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: formData,
      });
      const text = await res.text();
      let data: { message?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        if (!res.ok) {
          setErrorMessage(res.status === 500 ? "Eroare pe server. Verificați consola." : `Eroare ${res.status}`);
          setStatus("error");
          return;
        }
      }
      if (!res.ok) {
        setErrorMessage(data.message ?? "Eroare la salvare");
        setStatus("error");
        return;
      }
      setStatus("done");
      router.push("/templates");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Eroare de rețea");
      setStatus("error");
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <main className="max-w-2xl mx-auto">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Se încarcă…</p>
        </main>
      </div>
    );
  }

  if (status === "error" && !name && variableDefinitions.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <main className="max-w-2xl mx-auto">
          <p className="text-zinc-600 dark:text-zinc-400">{errorMessage}</p>
          <Link href="/templates" className="mt-4 inline-block text-sm text-zinc-900 dark:text-zinc-100 underline">
            Înapoi la template-uri
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
          Editează template
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6">
          Modifică numele, variabilele și opțional înlocuiește fișierele. La fel ca la creare: DOCX cu placeholdere {"{numeVariabila}"} și opțional un al doilea DOCX pentru preview la pasul 1.
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
            <label className={labelClass}>Fișiere încărcate în template</label>
            <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1 list-disc list-inside">
              <li><strong>{name.trim() ? `${name.trim()}.docx` : "template.docx"}</strong> – document DOCX (întotdeauna prezent)</li>
              {hasPreviewDocx && (
                <li><strong>contract-preview.docx</strong> – DOCX pentru pasul 1 (preview)</li>
              )}
            </ul>
          </div>
          <div>
            <label className={labelClass}>Fișier DOCX (opțional – înlocuiește template-ul curent)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className={inputClass}
            />
            {file && (
              <p className="mt-1 text-xs text-zinc-500">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
            )}
          </div>
          <div>
            <label className={labelClass}>DOCX pentru preview (opțional) – pentru pasul 1</label>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">DOCX-ul original (fără variabile) se afișează la „Citește contractul” cu locuri goale.</p>
            {hasPreviewDocx && !previewDocx && (
              <p className="text-xs text-green-600 dark:text-green-400 mb-1">Un DOCX de preview este deja încărcat.</p>
            )}
            <label className="inline-flex items-center gap-2 mt-1">
              <input type="checkbox" checked={clearPreviewDocx} onChange={(e) => setClearPreviewDocx(e.target.checked)} className="rounded border-zinc-300" />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Șterge DOCX-ul de preview</span>
            </label>
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
                setClearPreviewDocx(false);
              }}
              className={inputClass + " mt-2"}
            />
            {previewDocx && (
              <p className="mt-1 text-xs text-zinc-500">{previewDocx.name} ({(previewDocx.size / 1024).toFixed(1)} KB)</p>
            )}
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExtractFromDocx}
                disabled={extractLoading || status === "loading"}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                {extractLoading ? "Se extrag…" : "Extrage variabile din DOCX"}
              </button>
            </div>
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
              {status === "saving" ? "Se salvează…" : "Salvează modificările"}
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
