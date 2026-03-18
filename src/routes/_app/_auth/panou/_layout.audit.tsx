import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";
import { contractsActions } from "@/lib/convex-actions";

function formatDate(s: string | number): string {
  try {
    const d = typeof s === "number" ? new Date(s) : new Date(s);
    return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch {
    return String(s);
  }
}

export const Route = createFileRoute("/_app/_auth/panou/_layout/audit")({
  validateSearch: (search: Record<string, unknown>) => ({
    contractId: typeof search.contractId === "string" && search.contractId.trim()
      ? (search.contractId.trim() as Id<"contracts">)
      : undefined,
  }),
  component: AuditPage,
});

function AuditPage() {
  const search = Route.useSearch({ strict: false });
  const [contractIdInput, setContractIdInput] = useState(search.contractId ?? "");
  const [submittedId, setSubmittedId] = useState<Id<"contracts"> | null>(search.contractId ?? null);
  const [downloadingDoc, setDownloadingDoc] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const report = useQuery(
    api.contracts.getAuditReport,
    submittedId ? { contractId: submittedId } : "skip"
  );
  const signers = useQuery(
    api.contracts.getSigners,
    submittedId ? { contractId: submittedId } : "skip"
  );
  const getDocumentUrl = useAction(contractsActions.getDocumentUrl);
  const getAuditReportHtml = useAction(contractsActions.getAuditReportHtml);

  const handleVerify = () => {
    const id = contractIdInput.trim();
    if (id) setSubmittedId(id as Id<"contracts">);
  };

  const handleDownloadDoc = async () => {
    if (!submittedId) return;
    setDownloadingDoc(true);
    try {
      const url = await getDocumentUrl({ contractId: submittedId });
      if (url) window.open(url, "_blank");
    } finally {
      setDownloadingDoc(false);
    }
  };

  const handleOpenReport = async () => {
    if (!submittedId) return;
    setReportLoading(true);
    try {
      const html = await getAuditReportHtml({ contractId: submittedId });
      const blob = new Blob([html], { type: "text/html; charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally {
      setReportLoading(false);
    }
  };

  const loading = submittedId !== null && (report === undefined || signers === undefined);
  const notFound = submittedId !== null && report === null;
  const data =
    report && signers
      ? {
          contract: {
            id: report.contract._id,
            status: report.contract.status,
            documentHash: report.contract.documentHash ?? null,
            templateVersion: report.contract.templateVersion ?? null,
            documentStorageId: report.contract.documentStorageId,
            createdAt: report.contract.createdAt,
          },
          signers: signers.map((s) => ({
            fullName: s.fullName,
            email: s.email,
            role: s.role,
            signingOrder: s.signingOrder,
            signedAt: s.signedAt != null ? formatDate(s.signedAt) : null,
          })),
          auditLogs: report.auditLogs.map((log) => ({
            createdAt: formatDate(log.createdAt),
            signerName: log.signerName ?? "—",
            signerEmail: log.signerEmail ?? "—",
            signerRole: log.signerRole ?? "—",
            ip: log.ip ?? null,
            device: log.device ?? null,
            deviceSignature: log.deviceSignature ?? null,
            authMethod: log.authMethod,
            documentHash: log.documentHash ?? null,
          })),
        }
      : null;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
        Verificare log-uri de audit
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6">
        Introdu ID-ul contractului pentru a vedea jurnalul de semnare (semnatari, IP, dispozitiv, autentificare). Poți descărca un raport tipăribil ca probă.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <input
          type="text"
          value={contractIdInput}
          onChange={(e) => setContractIdInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          placeholder="ID contract (ex: cmlj9565k0001f4ooxumvcjf5)"
          className="flex-1 min-w-0 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 text-sm"
        />
        <button
          type="button"
          onClick={handleVerify}
          disabled={loading}
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 shrink-0"
        >
          {loading ? "Se încarcă…" : "Verifică"}
        </button>
      </div>

      {notFound && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">Contract negăsit.</p>
      )}

      {data && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {data.contract.documentStorageId && (
              <button
                type="button"
                onClick={handleDownloadDoc}
                disabled={downloadingDoc}
                className="inline-block rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                {downloadingDoc ? "Se încarcă…" : "Descarcă DOCX contract"}
              </button>
            )}
            <button
              type="button"
              onClick={handleOpenReport}
              disabled={reportLoading}
              className="inline-block rounded bg-green-700 text-white dark:bg-green-600 px-3 py-1.5 text-sm font-medium hover:bg-green-800 dark:hover:bg-green-500 disabled:opacity-50"
            >
              {reportLoading ? "Se încarcă…" : "Deschide raport audit (HTML)"}
            </button>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="px-3 sm:px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Contract</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 break-words">
                Status: {data.contract.status} · Hash: {data.contract.documentHash ?? "—"} · Creat: {formatDate(data.contract.createdAt)}
              </p>
            </div>
            <div className="px-3 sm:px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">Semnatari</h2>
              <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1">
                {data.signers.map((s, i) => (
                  <li key={i}>
                    {s.fullName} ({s.email}) · {s.role}
                    {s.signedAt && ` · Semnat: ${s.signedAt}`}
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-3 sm:px-4 py-3">
              <h2 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">Jurnal evenimente</h2>
              {data.auditLogs.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Niciun eveniment încă.</p>
              ) : (
                <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-2">
                  {data.auditLogs.map((log, i) => (
                    <li key={i} className="border-l-2 border-zinc-300 dark:border-zinc-600 pl-3 py-1">
                      <span className="font-medium">{log.signerName}</span> · {log.createdAt}<br />
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
  );
}
