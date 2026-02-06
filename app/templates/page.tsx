"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Template = { id: string; name: string; version: number; createdAt: string };

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/templates")
      .then((res) => res.json())
      .then((data) => {
        setTemplates(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoading(false));
  }, []);

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
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{t.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Versiune {t.version}
                  </p>
                </div>
                <Link
                  href={`/contract?templateId=${encodeURIComponent(t.id)}`}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Generează contract
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
