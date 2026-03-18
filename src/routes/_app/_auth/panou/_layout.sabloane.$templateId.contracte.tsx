import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";
import { contractsActions } from "@/lib/convex-actions";

function formatDate(ms: number): string {
  try {
    return new Date(ms).toLocaleString("ro-RO", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return String(ms);
  }
}

export const Route = createFileRoute("/_app/_auth/panou/_layout/sabloane/$templateId/contracte")({
  component: SabloaneContractePage,
});

function SabloaneContractePage() {
  const { templateId } = Route.useParams();
  const id = templateId as Id<"contractTemplates">;
  const data = useQuery(api.templates.getContracts, id ? { templateId: id } : "skip");
  const getDocumentUrl = useAction(contractsActions.getDocumentUrl);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownload(contractId: Id<"contracts">) {
    setDownloadingId(contractId);
    try {
      const url = await getDocumentUrl({ contractId });
      if (url) window.open(url, "_blank");
    } finally {
      setDownloadingId(null);
    }
  }

  if (!id) {
    return (
      <main className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <p className="text-zinc-600 dark:text-zinc-400">ID template lipsă.</p>
      </main>
    );
  }

  if (data === undefined) {
    return (
      <main className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Se încarcă…</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <p className="text-zinc-600 dark:text-zinc-400">Eroare la încărcare</p>
        <Link to="/panou/sabloane" className="mt-4 inline-block text-sm underline text-zinc-900 dark:text-zinc-100">
          ← Template-uri
        </Link>
      </main>
    );
  }

  return (
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
            to="/panou/contracte/nou"
            search={{ templateId: id }}
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
                    to="/panou/contracte/$contractId/editeaza"
                    params={{ contractId: c.id }}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Deschide
                  </Link>
                )}
                <Link
                  to="/panou/contracte/$contractId"
                  params={{ contractId: c.id }}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Vezi
                </Link>
                {c.documentStorageId && (
                  <button
                    type="button"
                    onClick={() => handleDownload(c.id)}
                    disabled={downloadingId === c.id}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {downloadingId === c.id ? "Se încarcă…" : "Descarcă DOCX"}
                  </button>
                )}
                {c.status === "SIGNED" && (
                  <Link
                    to="/panou/contracte/act-aditional/nou"
                    search={{ parentContractId: c.id }}
                    className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
                  >
                    Adaugă act adițional
                  </Link>
                )}
                <Link
                  to="/panou/audit"
                  search={{ contractId: c.id }}
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
  );
}
