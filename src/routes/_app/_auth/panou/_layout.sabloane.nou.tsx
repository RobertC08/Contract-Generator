import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@cvx/_generated/api";
import type { Id } from "@cvx/_generated/dataModel";
import { templatesActions } from "@/lib/convex-actions";
import type { VariableDefinition, VariableDefinitions } from "@lib/contracts/variable-definitions";
import { validateVariableDefinitions } from "@lib/contracts/variable-definitions";
import { VariableDefinitionsEditor } from "@/components/variable-definitions-editor";

const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 text-sm";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";

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

export const Route = createFileRoute("/_app/_auth/panou/_layout/sabloane/nou")({
  component: SabloaneNouPage,
});

function SabloaneNouPage() {
  const generateUploadUrl = useMutation(api.templates.generateUploadUrl);
  const createTemplate = useMutation(api.templates.create);
  const extractVariablesFromFile = useAction(templatesActions.extractVariablesFromFile);

  const [name, setName] = useState("");
  const [variableDefinitions, setVariableDefinitions] = useState<VariableDefinitions>([]);
  const [file, setFile] = useState<File | null>(null);
  const [previewDocx, setPreviewDocx] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [extractStatus, setExtractStatus] = useState<"idle" | "loading" | "done">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = useCallback(
    async (selected: File | null) => {
      setFile(selected);
      if (!selected || selected.size === 0) {
        setExtractStatus("idle");
        return;
      }
      const isDocx =
        selected.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        selected.name.toLowerCase().endsWith(".docx");
      if (!isDocx) return;
      setExtractStatus("loading");
      try {
        const uploadUrl = await generateUploadUrl();
        const uploadRes = await fetch(uploadUrl, { method: "POST", body: selected });
        const { storageId } = (await uploadRes.json()) as { storageId: Id<"_storage"> };
        if (!storageId) throw new Error("Upload failed");
        const { variableNames } = await extractVariablesFromFile({ storageId });
        setVariableDefinitions((prev) => mergeVariableNamesIntoDefs(prev, variableNames));
        setExtractStatus("done");
      } catch {
        setExtractStatus("idle");
      }
    },
    [generateUploadUrl, extractVariablesFromFile]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateVariableDefinitions(variableDefinitions);
    if (!validation.success) {
      setErrorMessage(validation.message);
      setStatus("error");
      return;
    }
    if (!file || file.size === 0) {
      setErrorMessage("Încarcă un fișier .docx");
      setStatus("error");
      return;
    }
    setStatus("saving");
    setErrorMessage("");
    try {
      const uploadUrl = await generateUploadUrl();
      const uploadRes = await fetch(uploadUrl, { method: "POST", body: file });
      const { storageId: fileStorageId } = (await uploadRes.json()) as { storageId: Id<"_storage"> };
      if (!fileStorageId) {
        setErrorMessage("Încărcare fișier eșuată");
        setStatus("error");
        return;
      }
      let previewPdfStorageId: Id<"_storage"> | undefined;
      if (previewDocx && previewDocx.size > 0) {
        const prevUrl = await generateUploadUrl();
        const prevRes = await fetch(prevUrl, { method: "POST", body: previewDocx });
        const { storageId } = (await prevRes.json()) as { storageId: Id<"_storage"> };
        if (storageId) previewPdfStorageId = storageId;
      }
      const result = await createTemplate({
        name: name.trim(),
        fileStorageId,
        previewPdfStorageId,
        version: 1,
        variableDefinitions: validation.data,
      });
      setSavedId(result.id);
      setStatus("done");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Eroare la salvare");
      setStatus("error");
    }
  }

  if (status === "done" && savedId) {
    return (
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <p className="text-zinc-700 dark:text-zinc-300 mb-4">Template salvat.</p>
        <Link
          to="/panou/sabloane/$templateId/editeaza"
          params={{ templateId: savedId }}
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          Editează template
        </Link>
        {" · "}
        <Link to="/panou/sabloane" className="text-blue-600 dark:text-blue-400 hover:underline">
          Lista template-uri
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
        Template nou
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-6">
        Încarcă un fișier Word (.docx) cu placeholdere în format {"{numeVariabila}"}. Apoi definește variabilele.
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
          <label className={labelClass}>Fișier DOCX</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            className={inputClass}
          />
          {file && (
            <p className="mt-1 text-xs text-zinc-500">
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
              {extractStatus === "loading" && " · Se extrag variabilele…"}
              {extractStatus === "done" && " · Variabilele au fost adăugate în listă."}
            </p>
          )}
        </div>
        <div>
          <label className={labelClass}>DOCX pentru preview (opțional) – pentru pasul 1</label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Încarcă un DOCX (original, fără variabile) ca să se afișeze la „Citește contractul” cu locuri goale.</p>
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
            }}
            className={inputClass}
          />
          {previewDocx && (
            <p className="mt-1 text-xs text-zinc-500">{previewDocx.name} ({(previewDocx.size / 1024).toFixed(1)} KB)</p>
          )}
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
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
            {status === "saving" ? "Se salvează…" : "Salvează"}
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
