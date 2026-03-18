import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";

function formatDate(s: string | number): string {
  try {
    const d = new Date(s);
    return d.toLocaleDateString("ro-RO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(s);
  }
}

function statusLabel(s: string): string {
  if (s === "DRAFT") return "Ciornă";
  if (s === "SENT") return "Trimis";
  if (s === "SIGNED") return "Semnat";
  return s;
}

export const Route = createFileRoute("/_app/_auth/panou/_layout/")({
  component: PanouPage,
});

function PanouPage() {
  const data = useQuery(api.dashboard.get);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 sm:space-y-8">
      {data && (
        <>
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4">
              <p className="text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">Total contracte</p>
              <p className="text-2xl font-semibold text-stone-900 dark:text-stone-100 mt-0.5">{data.contractCounts.total}</p>
            </div>
            <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4">
              <p className="text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">Ciornă</p>
              <p className="text-2xl font-semibold text-amber-700 dark:text-amber-400 mt-0.5">{data.contractCounts.draft}</p>
            </div>
            <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4">
              <p className="text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">Trimise</p>
              <p className="text-2xl font-semibold text-blue-700 dark:text-blue-400 mt-0.5">{data.contractCounts.sent}</p>
            </div>
            <div className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4">
              <p className="text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">Semnate</p>
              <p className="text-2xl font-semibold text-green-700 dark:text-green-400 mt-0.5">{data.contractCounts.signed}</p>
            </div>
          </section>

          <section className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 overflow-hidden">
            <div className="px-3 sm:px-4 py-3 border-b border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="font-semibold text-stone-900 dark:text-stone-100">Template-uri</h2>
              <Link to="/panou/sabloane" className="text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100">
                Toate →
              </Link>
            </div>
            <div className="overflow-x-auto">
              {data.templates.length === 0 ? (
                <p className="p-4 text-stone-500 dark:text-stone-400 text-sm">Niciun template.</p>
              ) : (
                <table className="w-full text-sm min-w-[280px]">
                  <thead>
                    <tr className="text-left text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800">
                      <th className="px-3 sm:px-4 py-2 font-medium">Nume</th>
                      <th className="px-3 sm:px-4 py-2 font-medium">Versiune</th>
                      <th className="px-3 sm:px-4 py-2 font-medium">Contracte</th>
                      <th className="px-3 sm:px-4 py-2 font-medium w-0" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.templates.map((t) => (
                      <tr key={t.id} className="border-b border-stone-100 dark:border-stone-800/50">
                        <td className="px-3 sm:px-4 py-2 text-stone-900 dark:text-stone-100">{t.name}</td>
                        <td className="px-3 sm:px-4 py-2 text-stone-600 dark:text-stone-400">{t.version}</td>
                        <td className="px-3 sm:px-4 py-2 text-stone-600 dark:text-stone-400">{t.contractsCount}</td>
                        <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                          <Link
                            to="/panou/sabloane/$templateId/contracte"
                            params={{ templateId: t.id }}
                            className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                          >
                            Deschide
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 overflow-hidden">
            <div className="px-3 sm:px-4 py-3 border-b border-stone-200 dark:border-stone-800">
              <h2 className="font-semibold text-stone-900 dark:text-stone-100">Ultimele contracte</h2>
            </div>
            <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
              {data.recentContracts.length === 0 ? (
                <p className="p-4 text-stone-500 dark:text-stone-400 text-sm">Niciun contract.</p>
              ) : (
                <table className="w-full text-sm min-w-[320px]">
                  <thead>
                    <tr className="text-left text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800">
                      <th className="px-3 sm:px-4 py-2 font-medium">Template</th>
                      <th className="px-3 sm:px-4 py-2 font-medium">Status</th>
                      <th className="px-3 sm:px-4 py-2 font-medium">Semnatari</th>
                      <th className="px-3 sm:px-4 py-2 font-medium">Data</th>
                      <th className="px-3 sm:px-4 py-2 font-medium w-0" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentContracts.map((c) => (
                      <tr key={c.id} className="border-b border-stone-100 dark:border-stone-800/50">
                        <td className="px-3 sm:px-4 py-2 text-stone-900 dark:text-stone-100">{c.templateName}</td>
                        <td className="px-3 sm:px-4 py-2">
                          <span
                            className={
                              c.status === "SIGNED"
                                ? "text-green-600 dark:text-green-400"
                                : c.status === "SENT"
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-amber-600 dark:text-amber-400"
                            }
                          >
                            {statusLabel(c.status)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-2 text-stone-600 dark:text-stone-400">{c.signersCount}</td>
                        <td className="px-3 sm:px-4 py-2 text-stone-600 dark:text-stone-400">{formatDate(c.createdAt)}</td>
                        <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                          <Link
                            to="/panou/sabloane/$templateId/contracte"
                            params={{ templateId: c.templateId }}
                            className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                          >
                            Listă
                          </Link>
                          <span className="hidden sm:inline"> · </span>
                          <Link
                            to="/panou/audit"
                            search={{ contractId: c.id }}
                            className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 sm:ml-0 ml-1"
                          >
                            Audit
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 overflow-hidden">
            <div className="px-3 sm:px-4 py-3 border-b border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="font-semibold text-stone-900 dark:text-stone-100">Ultimele semnături (audit)</h2>
              <Link to="/panou/audit" className="text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100">
                Caută contract →
              </Link>
            </div>
            <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
              {data.recentAudits.length === 0 ? (
                <p className="p-4 text-stone-500 dark:text-stone-400 text-sm">Nicio semnătură înregistrată.</p>
              ) : (
                <table className="w-full text-sm min-w-[360px]">
                  <thead>
                    <tr className="text-left text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800">
                      <th className="px-3 sm:px-4 py-2 font-medium">Semnatar</th>
                      <th className="px-3 sm:px-4 py-2 font-medium">Dispozitiv</th>
                      <th className="px-3 sm:px-4 py-2 font-medium">Semn. dispozitiv</th>
                      <th className="px-3 sm:px-4 py-2 font-medium">Data</th>
                      <th className="px-3 sm:px-4 py-2 font-medium w-0" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentAudits.map((a) => (
                      <tr key={a.id} className="border-b border-stone-100 dark:border-stone-800/50">
                        <td className="px-3 sm:px-4 py-2 text-stone-900 dark:text-stone-100">
                          {a.signerName}
                          <span className="text-stone-500 dark:text-stone-400 font-normal"> · {a.signerEmail}</span>
                        </td>
                        <td className="px-3 sm:px-4 py-2 text-stone-600 dark:text-stone-400">{a.device ?? "—"}</td>
                        <td className="px-3 sm:px-4 py-2 text-stone-600 dark:text-stone-400 font-mono text-xs max-w-[120px] truncate" title={a.deviceSignature ?? undefined}>{a.deviceSignature ?? "—"}</td>
                        <td className="px-3 sm:px-4 py-2 text-stone-600 dark:text-stone-400">{formatDate(a.createdAt)}</td>
                        <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                          <Link
                            to="/panou/audit"
                            search={{ contractId: a.contractId }}
                            className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                          >
                            Vezi audit
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}

      {data === undefined && (
        <div className="flex items-center justify-center py-12">
          <p className="text-stone-500 dark:text-stone-400 text-sm">Se încarcă…</p>
        </div>
      )}
    </main>
  );
}
