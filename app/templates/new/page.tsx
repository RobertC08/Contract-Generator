"use client";

import { useState } from "react";
import Link from "next/link";
import { TemplateEditor, DEFAULT_TEMPLATE_HTML } from "@/app/components/template-editor";

const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 text-sm";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";

export default function NewTemplatePage() {
  const [name, setName] = useState("");
  const [content, setContent] = useState(DEFAULT_TEMPLATE_HTML);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [showVarDropdown, setShowVarDropdown] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMessage("");
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content }),
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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <main className="w-full max-w-4xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/templates"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Template-uri
          </Link>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
          Template nou
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400 text-sm mb-6">
          Scrie textul contractului cu formatare (bold, listă). Pentru câmpuri care se completează la generare, folosește „Inserare variabilă”.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
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
          <div>
            <label className={labelClass}>
              Conținut
            </label>
            <TemplateEditor
              initialContent={content}
              onContentChange={setContent}
              showVarDropdown={showVarDropdown}
              onToggleVarDropdown={() => setShowVarDropdown((v) => !v)}
              minHeight="320px"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Variabilele {"{{nume}}"} se completează la generarea PDF.
            </p>
          </div>
          {status === "error" && (
            <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
          )}
          <div className="flex gap-2">
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
        </form>
      </main>
    </div>
  );
}
