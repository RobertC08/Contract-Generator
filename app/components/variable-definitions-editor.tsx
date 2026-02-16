"use client";

import type { VariableDefinition, VariableType } from "@/lib/contracts/variable-definitions";
import { VARIABLE_TYPES } from "@/lib/contracts/variable-definitions";

const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500";
const labelClass = "block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-0.5";

const TYPE_LABELS: Record<VariableType, string> = {
  text: "Text",
  number: "Număr",
  date: "Dată",
  month: "Lună",
  cui: "CUI",
  signature: "Semnătură",
};

function defaultLinkedForCui(name: string): { denumire: string; sediu: string; regCom: string } {
  const lower = name.toLowerCase();
  if (lower === "cui")
    return { denumire: "denumireFirma", sediu: "sediuSoc", regCom: "nrRegCom" };
  const base = name.replace(/CUI$/i, "") || name;
  return {
    denumire: `${base}Nume`,
    sediu: `${base}Sediu`,
    regCom: `${base}RegCom`,
  };
}

function extractVariableNamesFromContent(html: string): string[] {
  const names = new Set<string>();
  const re = /\{\{(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) names.add(m[1]);
  return Array.from(names);
}

type VariableDefinitionsEditorProps = {
  value: VariableDefinition[];
  onChange: (value: VariableDefinition[]) => void;
  contentForDetect?: string;
  onVariableFocus?: (varName: string) => void;
  onVariableRename?: (oldName: string, newName: string) => void;
};

export function VariableDefinitionsEditor({
  value,
  onChange,
  contentForDetect,
  onVariableFocus,
  onVariableRename,
}: VariableDefinitionsEditorProps) {
  const updateAt = (index: number, patch: Partial<VariableDefinition>) => {
    const next = [...value];
    next[index] = { ...next[index]!, ...patch };
    onChange(next);
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const addVariable = () => {
    const name = `var${value.length + 1}`;
    onChange([...value, { name, type: "text" }]);
  };

  const setType = (index: number, type: VariableType) => {
    const def = value[index]!;
    const patch: Partial<VariableDefinition> = { type };
    if (type === "cui" && !def.linkedVariables) {
      patch.linkedVariables = defaultLinkedForCui(def.name);
    }
    if (type !== "cui") {
      patch.linkedVariables = undefined;
    }
    updateAt(index, patch);
  };

  const detectFromContent = () => {
    if (!contentForDetect) return;
    const names = extractVariableNamesFromContent(contentForDetect);
    const existing = new Set(value.map((d) => d.name));
    const toAdd = names.filter((n) => !existing.has(n));
    if (toAdd.length === 0) return;
    const newDefs: VariableDefinition[] = toAdd.map((name) => ({ name, type: "text" }));
    onChange([...value, ...newDefs]);
  };

  const existingNames = new Set(value.map((d) => d.name));
  const canAddDetected =
    contentForDetect &&
    extractVariableNamesFromContent(contentForDetect).some((n) => !existingNames.has(n));

  return (
    <div className="flex flex-col min-h-0 flex-1 gap-3">
      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Variabile template
        </h3>
        <div className="flex gap-1">
          {canAddDetected && (
            <button
              type="button"
              onClick={detectFromContent}
              className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Detectează din text
            </button>
          )}
          <button
            type="button"
            onClick={addVariable}
            className="rounded-lg bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 px-2 py-1.5 text-xs font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300"
          >
            Adaugă variabilă
          </button>
        </div>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0">
        La tip CUI, denumirea, sediul și nr. Reg. Com. se completează automat la verificare.
      </p>
      <ul className="space-y-2 flex-1 min-h-0 overflow-auto">
        {value.map((def, index) => (
          <li
            key={index}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-2 bg-zinc-50 dark:bg-zinc-800/50 space-y-2"
          >
            <div className="flex gap-2 items-start">
              <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>Nume</label>
                  <input
                    type="text"
                    value={def.name}
                    onFocus={() => onVariableFocus?.(def.name)}
                    onChange={(e) => {
                      const newName = e.target.value.replace(/\s/g, "_");
                      if (newName !== def.name) onVariableRename?.(def.name, newName);
                      updateAt(index, { name: newName });
                    }}
                    className={inputClass}
                    placeholder="ex. prestatorCUI"
                    pattern="[a-zA-Z0-9_]+"
                    title="Doar litere, cifre și _"
                  />
                </div>
                <div>
                  <label className={labelClass}>Tip</label>
                  <select
                    value={def.type}
                    onFocus={() => onVariableFocus?.(def.name)}
                    onChange={(e) => setType(index, e.target.value as VariableType)}
                    className={inputClass}
                  >
                    {VARIABLE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeAt(index)}
                className="rounded p-1 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                aria-label="Șterge variabilă"
              >
                ×
              </button>
            </div>
            {def.type === "signature" && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-200 dark:border-zinc-700">
                În DOCX pune <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">{"%{"}{def.name}{"}"}</code> (cu % în față) ca să apară semnătura ca imagine.
              </p>
            )}
            {def.type === "cui" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-700">
                <div>
                  <label className={labelClass}>Variabilă denumire</label>
                  <input
                    type="text"
                    value={def.linkedVariables?.denumire ?? ""}
                    onFocus={() => onVariableFocus?.(def.name)}
                    onChange={(e) =>
                      updateAt(index, {
                        linkedVariables: {
                          ...def.linkedVariables,
                          denumire: e.target.value,
                          sediu: def.linkedVariables?.sediu ?? "",
                          regCom: def.linkedVariables?.regCom ?? "",
                        },
                      })
                    }
                    className={inputClass}
                    placeholder="ex. prestatorNume"
                  />
                </div>
                <div>
                  <label className={labelClass}>Variabilă sediu</label>
                  <input
                    type="text"
                    value={def.linkedVariables?.sediu ?? ""}
                    onFocus={() => onVariableFocus?.(def.name)}
                    onChange={(e) =>
                      updateAt(index, {
                        linkedVariables: {
                          ...def.linkedVariables,
                          denumire: def.linkedVariables?.denumire ?? "",
                          sediu: e.target.value,
                          regCom: def.linkedVariables?.regCom ?? "",
                        },
                      })
                    }
                    className={inputClass}
                    placeholder="ex. prestatorSediu"
                  />
                </div>
                <div>
                  <label className={labelClass}>Variabilă Reg. Com.</label>
                  <input
                    type="text"
                    value={def.linkedVariables?.regCom ?? ""}
                    onFocus={() => onVariableFocus?.(def.name)}
                    onChange={(e) =>
                      updateAt(index, {
                        linkedVariables: {
                          ...def.linkedVariables,
                          denumire: def.linkedVariables?.denumire ?? "",
                          sediu: def.linkedVariables?.sediu ?? "",
                          regCom: e.target.value,
                        },
                      })
                    }
                    className={inputClass}
                    placeholder="ex. prestatorRegCom"
                  />
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
