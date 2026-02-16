"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Template = { id: string; name: string; version: number; createdAt: string };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  function loadTemplates() {
    fetch("/api/templates")
      .then((res) => res.json())
      .then((data) => {
        setTemplates(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  async function handleDelete(t: Template) {
    if (!confirm(`Ștergi template-ul „${t.name}"? Contractele generate cu el vor fi șterse.`)) return;
    setDeletingId(t.id);
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(t.id)}`, { method: "DELETE" });
      if (res.ok) {
        setTemplates((prev) => prev.filter((x) => x.id !== t.id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function handleGenerateContract(t: Template) {
    setGeneratingId(t.id);
    setGeneratedLink(null);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: t.id, shareableLink: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.fillLink) {
        const full = data.fillLink.startsWith("http") ? data.fillLink : `${typeof window !== "undefined" ? window.location.origin : ""}${data.fillLink}`;
        setGeneratedLink(full);
        try {
          await navigator.clipboard.writeText(full);
        } catch {
          // ignore
        }
      }
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <main className="w-full max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Acasă
          </Link>
          <Link
            href="/templates/new"
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
          >
            Template nou
          </Link>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
          Template-uri
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400 text-sm mb-6">
          Creează un template de la zero sau generează contracte din template-uri existente.
        </p>

        {loading ? (
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Se încarcă…</p>
        ) : templates.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
            <p className="text-zinc-600 dark:text-zinc-400 text-sm">
              Nu există template-uri. Creează primul.
            </p>
            <Link
              href="/templates/new"
              className="mt-4 inline-block rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              Template nou
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{t.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Versiune {t.version}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href={`/templates/${encodeURIComponent(t.id)}/contracts`}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Contracte
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleGenerateContract(t)}
                    disabled={generatingId !== null}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {generatingId === t.id ? "Se creează…" : "Generează contract"}
                  </button>
                  <Link
                    href={`/templates/${encodeURIComponent(t.id)}/edit`}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Editează
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(t)}
                    disabled={deletingId === t.id}
                    className="rounded-lg border border-red-200 dark:border-red-900 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"
                  >
                    {deletingId === t.id ? "Se șterge…" : "Șterge"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {generatedLink && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setGeneratedLink(null)}>
            <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Link pentru client</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                Trimite acest link clientului. Va citi contractul, completa datele, apoi va semna electronic.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedLink}
                  className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(generatedLink)}
                  className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium"
                >
                  Copiază
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Linkul a fost copiat în clipboard.</p>
              <button
                type="button"
                onClick={() => setGeneratedLink(null)}
                className="mt-4 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Închide
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
