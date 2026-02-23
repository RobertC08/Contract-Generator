"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminHeader } from "@/app/components/admin-header";

type ContractItem = {
  id: string;
  status: string;
  documentUrl: string | null;
  createdAt: string;
  signersCount: number;
  parentContractId: string | null;
  addendaCount: number;
};

type Data = {
  template: { id: string; name: string };
  contracts: ContractItem[];
};

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleString("ro-RO", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return s;
  }
}

export default function TemplateContractsPage() {
  const params = useParams();
  const templateId = typeof params.id === "string" ? params.id : "";
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!templateId) return;
    fetch(`/api/templates/${encodeURIComponent(templateId)}/contracts`)
      .then((r) => {
        if (!r.ok) throw new Error("Eroare la încărcare");
        return r.json();
      })
      .then(setData)
      .catch(() => setError("Eroare la încărcare"))
      .finally(() => setLoading(false));
  }, [templateId]);

  if (!templateId) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <AdminHeader />
        <main className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <p className="text-zinc-600 dark:text-zinc-400">ID template lipsă.</p>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <AdminHeader />
        <main className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Se încarcă…</p>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <AdminHeader />
        <main className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <p className="text-zinc-600 dark:text-zinc-400">{error ?? "Eroare"}</p>
          <Link href="/templates" className="mt-4 inline-block text-sm underline text-zinc-900 dark:text-zinc-100">
            ← Template-uri
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminHeader />
      <main className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
          Contracte – {data.template.name}
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400 text-sm mb-6">
          Contracte generate din acest template.
        </p>

        {data.contracts.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
            <p className="text-zinc-600 dark:text-zinc-400 text-sm">
              Nu există contracte generate din acest template.
            </p>
            <Link
              href={`/contract?templateId=${encodeURIComponent(templateId)}`}
              className="mt-4 inline-block rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              Generează contract
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.contracts.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm text-zinc-700 dark:text-zinc-300 truncate" title={c.id}>
                    {c.id}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDate(c.createdAt)} · {c.status} · {c.signersCount} semnatar(i)
                    {c.addendaCount > 0 && ` · ${c.addendaCount} act(e) adițional(e)`}
                    {c.parentContractId && " · act adițional"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                  {c.status === "DRAFT" && (
                    <Link
                      href={`/contract/edit/${encodeURIComponent(c.id)}`}
                      className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Deschide
                    </Link>
                  )}
                  <Link
                    href={`/contract/${encodeURIComponent(c.id)}`}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Vezi
                  </Link>
                  {c.documentUrl && (
                    <a
                      href={c.documentUrl}
                      download={`contract-${c.id}.docx`}
                      className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Descarcă DOCX
                    </a>
                  )}
                  {c.status === "SIGNED" && (
                    <Link
                      href={`/contract/addendum/new?parentContractId=${encodeURIComponent(c.id)}`}
                      className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
                    >
                      Adaugă act adițional
                    </Link>
                  )}
                  <Link
                    href={`/audit?contractId=${encodeURIComponent(c.id)}`}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Vezi audit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
