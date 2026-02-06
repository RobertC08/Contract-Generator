"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { isHtmlContent, sourceToHtml } from "@/lib/contracts/source-to-html";
import { TemplateEditor } from "@/app/components/template-editor";

const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 text-sm";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";

export default function EditTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "done" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [showVarDropdown, setShowVarDropdown] = useState(false);

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
        setStatus("idle");
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage("Eroare la încărcare");
      });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMessage("");
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content }),
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
          Editează template
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400 text-sm mb-6">
          Modifică textul și formatarea. Folosește „Inserare variabilă” pentru câmpuri dinamice.
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
              {status === "saving" ? "Se salvează…" : "Salvează modificările"}
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
