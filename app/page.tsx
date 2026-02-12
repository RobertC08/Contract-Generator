"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Dashboard = {
  templates: Array<{
    id: string;
    name: string;
    version: number;
    createdAt: string;
    contractsCount: number;
  }>;
  contractCounts: { draft: number; sent: number; signed: number; total: number };
  recentContracts: Array<{
    id: string;
    status: string;
    createdAt: string;
    templateId: string;
    templateName: string;
    signersCount: number;
  }>;
  recentAudits: Array<{
    id: string;
    createdAt: string;
    signerName: string;
    signerEmail: string;
    device: string | null;
    deviceSignature: string | null;
    authMethod: string;
    contractId: string;
  }>;
};

function formatDate(s: string): string {
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
    return s;
  }
}

function statusLabel(s: string): string {
  if (s === "DRAFT") return "Ciornă";
  if (s === "SENT") return "Trimis";
  if (s === "SIGNED") return "Semnat";
  return s;
}

export default function Home() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => {
        if (!r.ok) throw new Error("Eroare la încărcare");
        return r.json();
      })
      .then(setData)
      .catch(() => setError("Nu s-au putut încărca datele."));
  }, []);

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950">
      <header className="border-b border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <span className="text-lg font-semibold text-stone-900 dark:text-stone-100 tracking-tight">
            Consolă admin
          </span>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/contract"
              className="text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
            >
              Contract nou
            </Link>
            <Link
              href="/templates"
              className="text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
            >
              Template-uri
            </Link>
            <Link
              href="/audit"
              className="text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
            >
              Audit
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {error && (
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        )}

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
              <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                <h2 className="font-semibold text-stone-900 dark:text-stone-100">Template-uri</h2>
                <Link href="/templates" className="text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100">
                  Toate →
                </Link>
              </div>
              <div className="overflow-x-auto">
                {data.templates.length === 0 ? (
                  <p className="p-4 text-stone-500 dark:text-stone-400 text-sm">Niciun template.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800">
                        <th className="px-4 py-2 font-medium">Nume</th>
                        <th className="px-4 py-2 font-medium">Versiune</th>
                        <th className="px-4 py-2 font-medium">Contracte</th>
                        <th className="px-4 py-2 font-medium w-0" />
                      </tr>
                    </thead>
                    <tbody>
                      {data.templates.map((t) => (
                        <tr key={t.id} className="border-b border-stone-100 dark:border-stone-800/50">
                          <td className="px-4 py-2 text-stone-900 dark:text-stone-100">{t.name}</td>
                          <td className="px-4 py-2 text-stone-600 dark:text-stone-400">{t.version}</td>
                          <td className="px-4 py-2 text-stone-600 dark:text-stone-400">{t.contractsCount}</td>
                          <td className="px-4 py-2">
                            <Link
                              href={`/templates/${t.id}/contracts`}
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
              <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-800">
                <h2 className="font-semibold text-stone-900 dark:text-stone-100">Ultimele contracte</h2>
              </div>
              <div className="overflow-x-auto">
                {data.recentContracts.length === 0 ? (
                  <p className="p-4 text-stone-500 dark:text-stone-400 text-sm">Niciun contract.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800">
                        <th className="px-4 py-2 font-medium">Template</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 font-medium">Semnatari</th>
                        <th className="px-4 py-2 font-medium">Data</th>
                        <th className="px-4 py-2 font-medium w-0" />
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentContracts.map((c) => (
                        <tr key={c.id} className="border-b border-stone-100 dark:border-stone-800/50">
                          <td className="px-4 py-2 text-stone-900 dark:text-stone-100">{c.templateName}</td>
                          <td className="px-4 py-2">
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
                          <td className="px-4 py-2 text-stone-600 dark:text-stone-400">{c.signersCount}</td>
                          <td className="px-4 py-2 text-stone-600 dark:text-stone-400">{formatDate(c.createdAt)}</td>
                          <td className="px-4 py-2">
                            <Link
                              href={`/templates/${c.templateId}/contracts`}
                              className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                            >
                              Listă
                            </Link>
                            {" · "}
                            <Link
                              href={`/audit?contractId=${c.id}`}
                              className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
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
              <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                <h2 className="font-semibold text-stone-900 dark:text-stone-100">Ultimele semnături (audit)</h2>
                <Link href="/audit" className="text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100">
                  Caută contract →
                </Link>
              </div>
              <div className="overflow-x-auto">
                {data.recentAudits.length === 0 ? (
                  <p className="p-4 text-stone-500 dark:text-stone-400 text-sm">Nicio semnătură înregistrată.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800">
                        <th className="px-4 py-2 font-medium">Semnatar</th>
                        <th className="px-4 py-2 font-medium">Dispozitiv</th>
                        <th className="px-4 py-2 font-medium">Semn. dispozitiv</th>
                        <th className="px-4 py-2 font-medium">Data</th>
                        <th className="px-4 py-2 font-medium w-0" />
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentAudits.map((a) => (
                        <tr key={a.id} className="border-b border-stone-100 dark:border-stone-800/50">
                          <td className="px-4 py-2 text-stone-900 dark:text-stone-100">
                            {a.signerName}
                            <span className="text-stone-500 dark:text-stone-400 font-normal"> · {a.signerEmail}</span>
                          </td>
                          <td className="px-4 py-2 text-stone-600 dark:text-stone-400">{a.device ?? "—"}</td>
                          <td className="px-4 py-2 text-stone-600 dark:text-stone-400 font-mono text-xs">{a.deviceSignature ?? "—"}</td>
                          <td className="px-4 py-2 text-stone-600 dark:text-stone-400">{formatDate(a.createdAt)}</td>
                          <td className="px-4 py-2">
                            <Link
                              href={`/audit?contractId=${a.contractId}`}
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

        {!data && !error && (
          <div className="flex items-center justify-center py-12">
            <p className="text-stone-500 dark:text-stone-400 text-sm">Se încarcă…</p>
          </div>
        )}
      </main>
    </div>
  );
}
