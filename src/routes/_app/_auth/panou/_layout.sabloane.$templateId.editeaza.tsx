import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";
import { templatesActions } from "@/lib/convex-actions";
import type { VariableDefinition, VariableDefinitions } from "@lib/contracts/variable-definitions";
import { validateVariableDefinitions } from "@lib/contracts/variable-definitions";
import { VariableDefinitionsEditor } from "@/components/variable-definitions-editor";

const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 text-sm";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";

export const Route = createFileRoute("/_app/_auth/panou/_layout/sabloane/$templateId/editeaza")({
  component: SabloaneEditeazaPage,
});

function SabloaneEditeazaPage() {
  const { templateId } = Route.useParams();
  const navigate = useNavigate();
  const id = templateId as Id<"contractTemplates">;

  const template = useQuery(api.templates.get, id ? { templateId: id } : "skip");
  const updateTemplate = useMutation(api.templates.update);
  const generateUploadUrl = useMutation(api.templates.generateUploadUrl);
  const extractVariablesFromTemplate = useAction(templatesActions.extractVariablesFromTemplate);

  const [name, setName] = useState("");
  const [variableDefinitions, setVariableDefinitions] = useState<VariableDefinitions>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewDocx, setPreviewDocx] = useState<File | null>(null);
  const [clearPreviewDocx, setClearPreviewDocx] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "done" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [extractLoading, setExtractLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncedRef = useRef(false);

  useEffect(() => {
    if (template !== undefined && template !== null && !syncedRef.current) {
      syncedRef.current = true;
      setName(template.name ?? "");
      setVariableDefinitions(Array.isArray(template.variableDefinitions) ? template.variableDefinitions : []);
      setStatus("idle");
    }
  }, [template]);

  function mergeVariableNamesIntoDefs(
    current: VariableDefinitions,
    names: string[]
  ): VariableDefinitions {
    const existing = new Set(current.map((d) => d.name));
    const toAdd: VariableDefinition[] = names
      .filter((n) => !existing.has(n))
      .map((name) => ({ name, type: "text" }));
    return toAdd.length ? [...current, ...toAdd] : current;
  }

  async function handleExtractFromDocx() {
    if (!id || extractLoading) return;
    setExtractLoading(true);
    setErrorMessage("");
    try {
      const { variableNames } = await extractVariablesFromTemplate({ templateId: id });
      setVariableDefinitions((prev) => mergeVariableNamesIntoDefs(prev, variableNames));
    } catch {
      setErrorMessage("Eroare la extragere");
    } finally {
      setExtractLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateVariableDefinitions(variableDefinitions);
    if (!validation.success) {
      setErrorMessage(validation.message);
      setStatus("error");
      return;
    }
    setStatus("saving");
    setErrorMessage("");
    try {
      let fileStorageId: Id<"_storage"> | undefined;
      if (file && file.size > 0) {
        const uploadUrl = await generateUploadUrl();
        const uploadRes = await fetch(uploadUrl, { method: "POST", body: file });
        const { storageId } = (await uploadRes.json()) as { storageId: Id<"_storage"> };
        if (storageId) fileStorageId = storageId;
      }
      let previewPdfStorageId: Id<"_storage"> | null | undefined = undefined;
      if (clearPreviewDocx) previewPdfStorageId = null;
      else if (previewDocx && previewDocx.size > 0) {
        const prevUrl = await generateUploadUrl();
        const prevRes = await fetch(prevUrl, { method: "POST", body: previewDocx });
        const { storageId } = (await prevRes.json()) as { storageId: Id<"_storage"> };
        if (storageId) previewPdfStorageId = storageId;
      }
      await updateTemplate({
        templateId: id,
        name: name.trim(),
        fileStorageId,
        previewPdfStorageId,
        variableDefinitions: validation.data,
      });
      setStatus("done");
      navigate({ to: "/panou/sabloane" });
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Eroare la salvare");
      setStatus("error");
    }
  }

  const hasPreviewDocx = template?.hasPreviewDocx ?? false;

  if (template === undefined) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Se încarcă…</p>
      </main>
    );
  }

  if (template === null) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <p className="text-zinc-600 dark:text-zinc-400">{errorMessage}</p>
        <Link to="/panou/sabloane" className="mt-4 inline-block text-sm text-zinc-900 dark:text-zinc-100 underline">
          Înapoi la template-uri
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
        Editează template
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6">
        Modifică numele, variabilele și opțional înlocuiește fișierele. La fel ca la creare: DOCX cu placeholdere {"{numeVariabila}"} și opțional un al doilea DOCX pentru preview la pasul 1.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className={labelClass}>Nume template</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="ex. Contract prestări servicii"
            required
          />
        </div>
        <div>
          <label className={labelClass}>Fișiere încărcate în template</label>
          <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1 list-disc list-inside">
            <li><strong>{name.trim() ? `${name.trim()}.docx` : "template.docx"}</strong> – document DOCX (întotdeauna prezent)</li>
            {hasPreviewDocx && (
              <li><strong>contract-preview.docx</strong> – DOCX pentru pasul 1 (preview)</li>
            )}
          </ul>
        </div>
        <div>
          <label className={labelClass}>Fișier DOCX (opțional – înlocuiește template-ul curent)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className={inputClass}
          />
          {file && (
            <p className="mt-1 text-xs text-zinc-500">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
          )}
        </div>
        <div>
          <label className={labelClass}>DOCX pentru preview (opțional) – pentru pasul 1</label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">DOCX-ul original (fără variabile) se afișează la „Citește contractul” cu locuri goale.</p>
          {hasPreviewDocx && !previewDocx && (
            <p className="text-xs text-green-600 dark:text-green-400 mb-1">Un DOCX de preview este deja încărcat.</p>
          )}
          <label className="inline-flex items-center gap-2 mt-1">
            <input type="checkbox" checked={clearPreviewDocx} onChange={(e) => setClearPreviewDocx(e.target.checked)} className="rounded border-zinc-300" />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Șterge DOCX-ul de preview</span>
          </label>
          <input
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) { setPreviewDocx(null); return; }
              const isDocx = f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || f.name.toLowerCase().endsWith(".docx");
              if (!isDocx) {
                e.target.value = "";
                setPreviewDocx(null);
                setErrorMessage("Doar fișiere DOCX sunt acceptate la preview. Alegeți un .docx.");
                return;
              }
              setErrorMessage("");
              setPreviewDocx(f);
              setClearPreviewDocx(false);
              }}
            className={inputClass + " mt-2"}
          />
          {previewDocx && (
            <p className="mt-1 text-xs text-zinc-500">{previewDocx.name} ({(previewDocx.size / 1024).toFixed(1)} KB)</p>
          )}
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExtractFromDocx}
              disabled={extractLoading || status === "saving"}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              {extractLoading ? "Se extrag…" : "Extrage variabile din DOCX"}
            </button>
          </div>
          <VariableDefinitionsEditor
            value={variableDefinitions}
            onChange={setVariableDefinitions}
            contentForDetect=""
            onVariableFocus={() => {}}
            onVariableRename={() => {}}
          />
        </div>
        {errorMessage && (
          <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={status === "saving"}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
          >
            {status === "saving" ? "Se salvează…" : "Salvează modificările"}
          </button>
          <Link
            to="/panou/sabloane"
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Anulare
          </Link>
        </div>
      </form>
    </main>
  );
}
