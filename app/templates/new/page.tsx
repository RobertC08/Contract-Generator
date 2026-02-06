"use client";

import { useState, useRef } from "react";
import Link from "next/link";

const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 text-sm";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";

const VARIABILE_COMUNE = [
  "contractNr",
  "contractData",
  "prestatorNume",
  "prestatorSediu",
  "prestatorCUI",
  "prestatorDescriere",
  "beneficiarNume",
  "beneficiarSediu",
  "beneficiarCUI",
  "beneficiarDescriere",
  "lunaInceput",
  "anulInceput",
  "dataIntrareVigoare",
  "pretLunar",
  "continut",
];

const DEFAULT_TEXT = `CONTRACT

Nr. {{contractNr}} / Data {{contractData}}

Părțile contractante: {{prestatorDescriere}} și {{beneficiarDescriere}}.

Obiect: servicii contabile începând cu luna {{lunaInceput}}, anul {{anulInceput}}.

Preț lunar: {{pretLunar}}. Intrare în vigoare: {{dataIntrareVigoare}}.`;

export default function NewTemplatePage() {
  const [name, setName] = useState("");
  const [content, setContent] = useState(DEFAULT_TEXT);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [showVarDropdown, setShowVarDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(varName: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const insert = `{{${varName}}}`;
    const next = content.slice(0, start) + insert + content.slice(end);
    setContent(next);
    setShowVarDropdown(false);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + insert.length, start + insert.length);
    }, 0);
  }

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
          Scrie textul contractului. Pentru câmpuri care se completează la generare (nr. contract, date, părți), folosește butonul „Inserare variabilă”.
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
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="content" className={labelClass}>
                Conținut
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowVarDropdown((v) => !v)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Inserare variabilă
                </button>
                {showVarDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      aria-hidden
                      onClick={() => setShowVarDropdown(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1 max-h-48 overflow-auto min-w-[180px]">
                      {VARIABILE_COMUNE.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => insertVariable(v)}
                          className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <textarea
              ref={textareaRef}
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className={`${inputClass} min-h-[320px] whitespace-pre-wrap`}
              placeholder="Scrie aici textul contractului. Folosește „Inserare variabilă” pentru câmpuri dinamice."
              required
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Paragrafe separate prin linie goală. Variabilele apar ca {"{{nume}}"} și se completează la generarea PDF.
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
