import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";
import { contractsActions } from "@/lib/convex-actions";

const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

function formatDate(ms: number): string {
  try {
    return new Date(ms).toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return String(ms);
  }
}

function copyLink(link: string): void {
  const full = link.startsWith("http") ? link : baseUrl + link;
  void navigator.clipboard.writeText(full);
}

export const Route = createFileRoute("/_app/_auth/panou/_layout/contracte/$contractId")({
  component: ContracteViewPage,
});

function ContracteViewPage() {
  const { contractId } = Route.useParams();
  const id = contractId as Id<"contracts">;
  const view = useQuery(api.contracts.getView, id ? { contractId: id } : "skip");
  const deleteContract = useMutation(api.contracts.deleteContract);
  const removeTemplate = useMutation(api.templates.remove);
  const createShareableDraft = useAction(contractsActions.createShareableDraft);
  const getDocumentUrl = useAction(contractsActions.getDocumentUrl);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [linkModal, setLinkModal] = useState<{ templateId: Id<"contractTemplates">; templateName: string } | null>(null);
  const [linkModalStatus, setLinkModalStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [linkModalFillLink, setLinkModalFillLink] = useState<string | null>(null);
  const [linkModalError, setLinkModalError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const openLinkModal = useCallback((templateId: Id<"contractTemplates">, templateName: string) => {
    setLinkModal({ templateId, templateName });
    setLinkModalStatus("loading");
    setLinkModalFillLink(null);
    setLinkModalError(null);
    createShareableDraft({ templateId, parentContractId: id })
      .then((r) => {
        setLinkModalFillLink(r.fillLink.startsWith("http") ? r.fillLink : baseUrl + r.fillLink);
        setLinkModalStatus("done");
      })
      .catch((e) => {
        setLinkModalError(e instanceof Error ? e.message : "Eroare la generare link");
        setLinkModalStatus("error");
      });
  }, [id, createShareableDraft]);

  const handleDeleteAddendum = useCallback(
    (addendumId: Id<"contracts">) => {
      if (!confirm("Ștergi acest act adițional? Acțiunea nu poate fi anulată.")) return;
      setDeletingId(addendumId);
      deleteContract({ contractId: addendumId }).finally(() => setDeletingId(null));
    },
    [deleteContract]
  );

  const handleDeletePendingTemplate = useCallback(
    (templateId: Id<"contractTemplates">) => {
      if (!confirm("Ștergi template-ul de act adițional? Se vor șterge și eventualele draft-uri create din el. Acțiunea nu poate fi anulată.")) return;
      setDeletingTemplateId(templateId);
      removeTemplate({ templateId }).finally(() => setDeletingTemplateId(null));
    },
    [removeTemplate]
  );

  const handleDownloadDoc = useCallback(
    async (cId: Id<"contracts">) => {
      setDownloadingId(cId);
      try {
        const url = await getDocumentUrl({ contractId: cId });
        if (url) window.open(url, "_blank");
      } finally {
        setDownloadingId(null);
      }
    },
    [getDocumentUrl]
  );

  const data = view
    ? {
        contract: {
          id: view.contract._id,
          status: view.contract.status,
          createdAt: view.contract.createdAt,
          templateName: view.contract.template?.name ?? "—",
          documentStorageId: view.contract.documentStorageId,
          signers: view.signers.map((s) => ({
            id: s._id,
            fullName: s.fullName,
            email: s.email,
            signingLink: `/semneaza/${s.token}`,
          })),
        },
        addenda: view.addenda.map((a) => ({
          id: a.contract._id,
          status: a.contract.status,
          createdAt: a.contract.createdAt,
          templateId: a.contract.templateId,
          templateName: a.template?.name ?? "—",
          documentStorageId: a.contract.documentStorageId,
          signers: a.signers.map((s) => ({
            id: s._id,
            fullName: s.fullName,
            email: s.email,
            signingLink: `/semneaza/${s.token}`,
          })),
        })),
        pendingAddendumTemplates: view.pendingAddendumTemplates,
      }
    : null;

  if (!id) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <p className="text-zinc-600 dark:text-zinc-400">ID contract lipsă.</p>
      </main>
    );
  }

  if (view === undefined) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Se încarcă…</p>
      </main>
    );
  }

  if (!view || !data) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <p className="text-zinc-600 dark:text-zinc-400">Eroare la încărcare</p>
        <Link to="/panou/sabloane" className="mt-4 inline-block text-sm underline text-zinc-900 dark:text-zinc-100">← Template-uri</Link>
      </main>
    );
  }

  const { contract, addenda, pendingAddendumTemplates = [] } = data;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
        Contract – {contract.templateName}
      </h1>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400 text-sm mb-6">
        {formatDate(contract.createdAt)} · {contract.status}
      </p>

      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 mb-6">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Contract principal</h2>
        {contract.documentStorageId && (
          <button
            type="button"
            onClick={() => handleDownloadDoc(contract.id)}
            disabled={downloadingId === contract.id}
            className="inline-block rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 mb-3 disabled:opacity-50"
          >
            {downloadingId === contract.id ? "Se încarcă…" : "Descarcă DOCX"}
          </button>
        )}
        <Link
          to="/panou/audit"
          search={{ contractId: contract.id }}
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
                    to="/panou/sabloane/$templateId/editeaza"
                    params={{ templateId: t.id }}
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
                      to="/panou/contracte/$contractId/editeaza"
                      params={{ contractId: a.id }}
                      className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Editează draft
                    </Link>
                  )}
                  <Link
                    to="/panou/audit"
                    search={{ contractId: a.id }}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Vezi audit
                  </Link>
                  <Link
                    to="/panou/sabloane/$templateId/editeaza"
                    params={{ templateId: a.templateId }}
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
                  {a.documentStorageId && (
                    <button
                      type="button"
                      onClick={() => handleDownloadDoc(a.id)}
                      disabled={downloadingId === a.id}
                      className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {downloadingId === a.id ? "Se încarcă…" : "Descarcă DOCX"}
                    </button>
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
            to="/panou/contracte/act-aditional/nou"
            search={{ parentContractId: contract.id }}
            className="mt-4 inline-block rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-2 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200"
          >
            Adaugă act adițional
          </Link>
        )}
      </section>

      <Link to="/panou/sabloane" className="mt-6 inline-block text-sm text-zinc-600 dark:text-zinc-400 hover:underline">← Înapoi la template-uri</Link>

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
                onClick={() => setLinkModal(null)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Închide
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
