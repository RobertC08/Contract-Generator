"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type { VariableDefinitions } from "@/lib/contracts/variable-definitions";
import { validateVariableDefinitions } from "@/lib/contracts/variable-definitions";
import { TemplateEditor, DEFAULT_TEMPLATE_HTML } from "@/app/components/template-editor";
import { VariableDefinitionsEditor } from "@/app/components/variable-definitions-editor";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 text-sm";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";

export default function NewTemplatePage() {
  const [name, setName] = useState("");
  const [content, setContent] = useState(DEFAULT_TEMPLATE_HTML);
  const [variableDefinitions, setVariableDefinitions] = useState<VariableDefinitions>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [showVarDropdown, setShowVarDropdown] = useState(false);
  const [highlightVariableName, setHighlightVariableName] = useState<string | null>(null);

  const handleVariableRename = useCallback((oldName: string, newName: string) => {
    setContent((prev) =>
      prev.replace(new RegExp(`\\{\\{${escapeRegExp(oldName)}\\}\\}`, "g"), `{{${newName}}}`)
    );
    setHighlightVariableName(newName);
  }, []);

  const handleVariableFocus = useCallback((varName: string) => {
    setHighlightVariableName(varName);
  }, []);

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
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content, variableDefinitions }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message ?? "Eroare la salvare");
        setStatus("error");
        return;
      }
      setSavedId(data.id);
      setStatus("done");
    } catch {
      setErrorMessage("Eroare de rețea");
      setStatus("error");
    }
  }

  if (status === "done" && savedId) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <main className="w-full max-w-2xl mx-auto">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Template salvat
            </h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400 text-sm">
              Poți genera contracte din acest template.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/contract?templateId=${encodeURIComponent(savedId)}`}
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
              >
                Generează contract din acest template
              </Link>
              <Link
                href="/templates"
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Înapoi la lista de template-uri
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      <main className="flex-1 min-h-0 flex flex-col w-full px-4 py-3">
        <div className="flex items-center gap-4 flex-shrink-0 mb-2">
          <Link
            href="/templates"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Template-uri
          </Link>
        </div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight flex-shrink-0">
          Template nou
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm flex-shrink-0 mb-3">
          Scrie textul contractului cu formatare (bold, listă). Pentru câmpuri care se completează la generare, folosește „Inserare variabilă”.
        </p>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 lg:gap-4">
          <aside className="lg:w-1/3 lg:max-w-md flex-shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 flex flex-col min-h-[240px] lg:min-h-0 lg:h-full overflow-hidden">
            <VariableDefinitionsEditor
              value={variableDefinitions}
              onChange={setVariableDefinitions}
              contentForDetect={content}
              onVariableFocus={handleVariableFocus}
              onVariableRename={handleVariableRename}
            />
          </aside>
          <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-3 lg:w-2/3">
            <div className="flex-shrink-0">
              <label htmlFor="name" className={labelClass}>
                Nume template
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="ex. Contract de prestări servicii"
                required
              />
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <label className={labelClass}>
                Conținut
              </label>
              <TemplateEditor
                initialContent={content}
                onContentChange={setContent}
                variableDefinitions={variableDefinitions}
                showVarDropdown={showVarDropdown}
                onToggleVarDropdown={() => setShowVarDropdown((v) => !v)}
                minHeight="100%"
                highlightVariableName={highlightVariableName}
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                Variabilele {"{{nume}}"} se completează la generarea PDF.
              </p>
            </div>
            {status === "error" && (
              <p className="text-sm text-red-600 dark:text-red-400 flex-shrink-0">{errorMessage}</p>
            )}
            <div className="flex gap-2 flex-shrink-0">
              <button
                type="submit"
                disabled={status === "saving"}
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
              >
                {status === "saving" ? "Se salvează…" : "Salvează template"}
              </button>
              <Link
                href="/templates"
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Anulare
              </Link>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
