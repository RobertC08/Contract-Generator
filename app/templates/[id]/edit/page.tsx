"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { isHtmlContent, sourceToHtml } from "@/lib/contracts/source-to-html";
import type { VariableDefinitions } from "@/lib/contracts/variable-definitions";
import { validateVariableDefinitions } from "@/lib/contracts/variable-definitions";
import { TemplateEditor } from "@/app/components/template-editor";
import { VariableDefinitionsEditor } from "@/app/components/variable-definitions-editor";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 text-sm";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";

export default function EditTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [variableDefinitions, setVariableDefinitions] = useState<VariableDefinitions>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "done" | "error">("loading");
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

  useEffect(() => {
    if (!id) return;
    fetch(`/api/templates/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setStatus("error");
          setErrorMessage(data.message ?? "Template negăsit");
          return;
        }
        setName(data.name ?? "");
        const raw = data.content ?? "";
        const bodyInner = (html: string) =>
          html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]?.trim() ?? html;
        setContent(
          isHtmlContent(raw)
            ? bodyInner(raw)
            : bodyInner(sourceToHtml(raw))
        );
        setVariableDefinitions(Array.isArray(data.variableDefinitions) ? data.variableDefinitions : []);
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
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content, variableDefinitions }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message ?? "Eroare la salvare");
        setStatus("error");
        return;
      }
      setStatus("done");
      router.push("/templates");
    } catch {
      setErrorMessage("Eroare de rețea");
      setStatus("error");
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <main className="w-full max-w-2xl mx-auto">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Se încarcă…</p>
        </main>
      </div>
    );
  }

  if (status === "error" && !name && !content) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
        <main className="w-full max-w-2xl mx-auto">
          <p className="text-zinc-600 dark:text-zinc-400">{errorMessage}</p>
          <Link href="/templates" className="mt-4 inline-block text-sm text-zinc-900 dark:text-zinc-100 underline">
            Înapoi la template-uri
          </Link>
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
          Editează template
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm flex-shrink-0 mb-3">
          Modifică textul și formatarea. Folosește „Inserare variabilă” pentru câmpuri dinamice.
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
                {status === "saving" ? "Se salvează…" : "Salvează modificările"}
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
