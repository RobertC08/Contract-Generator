"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminHeader } from "@/app/components/admin-header";

type SignerWithLink = { id: string; fullName: string; email: string; signingLink: string };
type AddendumView = {
  id: string;
  status: string;
  createdAt: string;
  templateId: string;
  templateName: string;
  documentUrl: string | null;
  signers: SignerWithLink[];
};
type PendingAddendumTemplate = { id: string; name: string };
type ViewData = {
  contract: {
    id: string;
    status: string;
    createdAt: string;
    templateName: string;
    documentUrl: string | null;
    signers: SignerWithLink[];
  };
  addenda: AddendumView[];
  pendingAddendumTemplates: PendingAddendumTemplate[];
};

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return s;
  }
}

function copyLink(link: string): void {
  const full = link.startsWith("http") ? link : (typeof window !== "undefined" ? window.location.origin : "") + link;
  void navigator.clipboard.writeText(full);
}

export default function ContractViewPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [data, setData] = useState<ViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [linkModal, setLinkModal] = useState<{ templateId: string; templateName: string } | null>(null);
  const [linkModalStatus, setLinkModalStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [linkModalFillLink, setLinkModalFillLink] = useState<string | null>(null);
  const [linkModalError, setLinkModalError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!id) return;
    fetch(`/api/contracts/${encodeURIComponent(id)}/view`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Eroare"))))
      .then(setData)
      .catch(() => setError("Eroare la încărcare"));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/contracts/${encodeURIComponent(id)}/view`)
      .then((r) => {
        if (!r.ok) throw new Error("Eroare la încărcare");
        return r.json();
      })
      .then(setData)
      .catch(() => setError("Eroare la încărcare"))
      .finally(() => setLoading(false));
  }, [id]);

  const openLinkModal = useCallback((templateId: string, templateName: string) => {
    setLinkModal({ templateId, templateName });
    setLinkModalStatus("loading");
    setLinkModalFillLink(null);
    setLinkModalError(null);
  }, []);

  useEffect(() => {
    if (!linkModal || linkModalStatus !== "loading" || !id) return;
    const { templateId } = linkModal;
    fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, parentContractId: id, shareableLink: true }),
    })
      .then((r) => r.json())
      .then((data: { fillLink?: string; message?: string }) => {
        if (data.fillLink) {
          setLinkModalFillLink(data.fillLink);
          setLinkModalStatus("done");
        } else {
          setLinkModalError(data.message ?? "Eroare la generare link");
          setLinkModalStatus("error");
        }
      })
      .catch(() => {
        setLinkModalError("Eroare de rețea");
        setLinkModalStatus("error");
      });
  }, [linkModal, linkModalStatus, id]);

  const handleDeleteAddendum = useCallback(
    (addendumId: string) => {
      if (!confirm("Ștergi acest act adițional? Acțiunea nu poate fi anulată.")) return;
      setDeletingId(addendumId);
      fetch(`/api/contracts/${encodeURIComponent(addendumId)}`, { method: "DELETE" })
        .then((r) => {
          if (!r.ok) throw new Error("Eroare la ștergere");
          refetch();
        })
        .catch(() => setError("Eroare la ștergere"))
        .finally(() => setDeletingId(null));
    },
    [refetch]
  );

  const handleDeletePendingTemplate = useCallback(
    (templateId: string) => {
      if (!confirm("Ștergi template-ul de act adițional? Se vor șterge și eventualele draft-uri create din el. Acțiunea nu poate fi anulată.")) return;
      setDeletingTemplateId(templateId);
      fetch(`/api/templates/${encodeURIComponent(templateId)}`, { method: "DELETE" })
        .then((r) => {
          if (!r.ok) throw new Error("Eroare la ștergere");
          refetch();
        })
        .catch(() => setError("Eroare la ștergere template"))
        .finally(() => setDeletingTemplateId(null));
    },
    [refetch]
  );

  if (!id) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <AdminHeader />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <p className="text-zinc-600 dark:text-zinc-400">ID contract lipsă.</p>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <AdminHeader />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Se încarcă…</p>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <AdminHeader />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <p className="text-zinc-600 dark:text-zinc-400">{error ?? "Eroare"}</p>
          <Link href="/templates" className="mt-4 inline-block text-sm underline text-zinc-900 dark:text-zinc-100">← Template-uri</Link>
        </main>
      </div>
    );
  }

  const { contract, addenda, pendingAddendumTemplates = [] } = data;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminHeader />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
          Contract – {contract.templateName}
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400 text-sm mb-6">
          {formatDate(contract.createdAt)} · {contract.status}
        </p>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 mb-6">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Contract principal</h2>
          {contract.documentUrl && (
            <a
              href={contract.documentUrl}
              download={`contract-${contract.id}.docx`}
              className="inline-block rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 mb-3"
            >
              Descarcă DOCX
            </a>
          )}
          <Link
            href={`/audit?contractId=${encodeURIComponent(contract.id)}`}
            className="ml-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Vezi audit
          </Link>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Acte adiționale</h2>
          {addenda.length === 0 && pendingAddendumTemplates.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Nu există acte adiționale.</p>
          ) : (
            <ul className="space-y-4">
              {pendingAddendumTemplates.map((t) => (
                <li key={t.id} className="border-b border-zinc-200 dark:border-zinc-700 last:border-0 pb-4 last:pb-0">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Act adițional la acest contract</p>
                  <p className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">{t.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Template salvat – completează variabilele și generează contractul.</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Link
                      href={`/templates/${encodeURIComponent(t.id)}/edit`}
                      className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Editează template
                    </Link>
                    <button
                      type="button"
                      onClick={() => openLinkModal(t.id, t.name)}
                      className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
                    >
                      Generează contract
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePendingTemplate(t.id)}
                      disabled={deletingTemplateId === t.id}
                      className="rounded-lg border border-red-300 dark:border-red-700 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 disabled:opacity-50"
                    >
                      {deletingTemplateId === t.id ? "Se șterge…" : "Șterge template"}
                    </button>
                  </div>
                </li>
              ))}
              {addenda.map((a) => (
                <li key={a.id} className="border-b border-zinc-200 dark:border-zinc-700 last:border-0 pb-4 last:pb-0">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Act adițional la acest contract</p>
                  <p className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">{a.templateName}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {formatDate(a.createdAt)} · {a.status}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {a.status === "DRAFT" && (
                      <Link
                        href={`/contract/edit/${encodeURIComponent(a.id)}`}
                        className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        Editează draft
                      </Link>
                    )}
                    <Link
                      href={`/audit?contractId=${encodeURIComponent(a.id)}`}
                      className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Vezi audit
                    </Link>
                    <Link
                      href={`/templates/${encodeURIComponent(a.templateId)}/edit`}
                      className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Editează template
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteAddendum(a.id)}
                      disabled={deletingId === a.id}
                      className="rounded-lg border border-red-300 dark:border-red-700 px-2 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 disabled:opacity-50"
                    >
                      {deletingId === a.id ? "Se șterge…" : "Șterge"}
                    </button>
                    {a.documentUrl && (
                      <a
                        href={a.documentUrl}
                        download={`act-adițional-${a.id}.docx`}
                        className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        Descarcă DOCX
                      </a>
                    )}
                  </div>
                  {(a.status === "DRAFT" || a.status === "SENT") && a.signers.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Generează / Link semnare (trimite clientului):</p>
                      {a.signers.map((s) => (
                        <div key={s.id} className="flex items-center gap-2 mt-1">
                          <input
                            readOnly
                            value={s.signingLink.startsWith("http") ? s.signingLink : (typeof window !== "undefined" ? window.location.origin : "") + s.signingLink}
                            className="flex-1 min-w-0 rounded border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 px-2 py-1.5 text-xs text-zinc-700 dark:text-zinc-300"
                          />
                          <button
                            type="button"
                            onClick={() => copyLink(s.signingLink)}
                            className="rounded bg-zinc-200 dark:bg-zinc-600 px-2 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-500"
                          >
                            Copiază
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {contract.status === "SIGNED" && (
            <Link
              href={`/contract/addendum/new?parentContractId=${encodeURIComponent(contract.id)}`}
              className="mt-4 inline-block rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-2 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              Adaugă act adițional
            </Link>
          )}
        </section>

        <Link href="/templates" className="mt-6 inline-block text-sm text-zinc-600 dark:text-zinc-400 hover:underline">← Înapoi la template-uri</Link>
      </main>

      {linkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setLinkModal(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-md w-full p-5 border border-zinc-200 dark:border-zinc-700" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Link proces în pași</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">{linkModal.templateName}</p>
            {linkModalStatus === "loading" && (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">Se generează linkul…</p>
            )}
            {linkModalStatus === "error" && linkModalError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">{linkModalError}</p>
            )}
            {linkModalStatus === "done" && linkModalFillLink && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-600 dark:text-zinc-400">Deschide linkul pentru a completa variabilele și semnăturile în pași.</p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={linkModalFillLink.startsWith("http") ? linkModalFillLink : (typeof window !== "undefined" ? window.location.origin : "") + linkModalFillLink}
                    className="flex-1 min-w-0 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300"
                  />
                  <button
                    type="button"
                    onClick={() => copyLink(linkModalFillLink)}
                    className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-2 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
                  >
                    Copiază
                  </button>
                </div>
                <a
                  href={linkModalFillLink.startsWith("http") ? linkModalFillLink : (typeof window !== "undefined" ? window.location.origin : "") + linkModalFillLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-zinc-700 dark:text-zinc-300 hover:underline"
                >
                  Deschide linkul →
                </a>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => { setLinkModal(null); refetch(); }}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Închide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
