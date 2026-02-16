"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type AuditData = {
  contract: {
    id: string;
    status: string;
    documentHash: string | null;
    templateVersion: number | null;
    documentUrl: string | null;
    createdAt: string;
  };
  signers: Array<{
    fullName: string;
    email: string;
    role: string;
    signingOrder: number;
    signedAt: string | null;
  }>;
  auditLogs: Array<{
    createdAt: string;
    signerName: string;
    signerEmail: string;
    signerRole: string;
    ip: string | null;
    device: string | null;
    deviceSignature: string | null;
    authMethod: string;
    documentHash: string | null;
  }>;
};

function formatDate(s: string): string {
  try {
    return new Date(s).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch {
    return s;
  }
}

function AuditPageInner() {
  const searchParams = useSearchParams();
  const qId = searchParams.get("contractId");
  const [contractId, setContractId] = useState(qId ?? "");
  const [data, setData] = useState<AuditData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (qId && qId.trim()) {
      setContractId(qId);
      setError(null);
      setData(null);
      setLoading(true);
      fetch(`/api/contracts/${encodeURIComponent(qId.trim())}/audit`)
        .then((r) => {
          if (!r.ok) throw new Error(r.status === 404 ? "Contract negăsit" : "Eroare la încărcare");
          return r.json();
        })
        .then(setData)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [qId]);

  const fetchAudit = () => {
    if (!contractId.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/contracts/${encodeURIComponent(contractId.trim())}/audit`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Contract negăsit" : "Eroare la încărcare");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const reportUrl = data
    ? `/api/contracts/${encodeURIComponent(data.contract.id)}/audit-report`
    : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <main className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
            ← Înapoi
          </Link>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          Verificare log-uri de audit
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6">
          Introdu ID-ul contractului pentru a vedea jurnalul de semnare (semnatari, IP, dispozitiv, autentificare). Poți descărca un raport tipăribil ca probă.
        </p>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchAudit()}
            placeholder="ID contract (ex: cmlj9565k0001f4ooxumvcjf5)"
            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 text-sm"
          />
          <button
            type="button"
            onClick={fetchAudit}
            disabled={loading}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
          >
            {loading ? "Se încarcă…" : "Verifică"}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
        )}

        {data && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {data.contract.documentUrl && (
                <a
                  href={data.contract.documentUrl}
                  download={`contract-${data.contract.id}.docx`}
                  className="inline-block rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Descarcă DOCX contract
                </a>
              )}
              {reportUrl && (
                <a
                  href={reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded bg-green-700 text-white dark:bg-green-600 px-3 py-1.5 text-sm font-medium hover:bg-green-800 dark:hover:bg-green-500"
                >
                  Deschide raport audit (HTML)
                </a>
              )}
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Contract</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Status: {data.contract.status} · Hash: {data.contract.documentHash ?? "—"} · Creat: {formatDate(data.contract.createdAt)}
                </p>
              </div>
              <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">Semnatari</h2>
                <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1">
                  {data.signers.map((s, i) => (
                    <li key={i}>
                      {s.fullName} ({s.email}) · {s.role}
                      {s.signedAt && ` · Semnat: ${formatDate(s.signedAt)}`}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="px-4 py-3">
                <h2 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">Jurnal evenimente</h2>
                {data.auditLogs.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Niciun eveniment încă.</p>
                ) : (
                  <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-2">
                    {data.auditLogs.map((log, i) => (
                      <li key={i} className="border-l-2 border-zinc-300 dark:border-zinc-600 pl-3 py-1">
                        <span className="font-medium">{log.signerName}</span> · {formatDate(log.createdAt)}<br />
                        <span className="text-xs text-zinc-500">IP: {log.ip ?? "—"} · {log.device ?? "—"} · Semnătură dispozitiv: {log.deviceSignature ?? "—"} · Autentificare: {log.authMethod}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6"><p className="text-zinc-500 text-sm">Se încarcă…</p></div>}>
      <AuditPageInner />
    </Suspense>
  );
}
