"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import type { VariableDefinition } from "@/lib/contracts/variable-definitions";
import { Variable } from "@/app/components/tiptap-variable-extension";

const VAR_PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

function htmlWithVariablesToChips(html: string): string {
  return html.replace(VAR_PLACEHOLDER_RE, (_, name) => {
    const label = name
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z][a-z]*)/g, "$1 $2")
      .trim()
      .split(/\s+/)
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    return `<span data-variable="${name}" class="variable-chip">${escapeHtmlAttr(label)}</span>`;
  });
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function chipsHtmlToPlaceholders(html: string): string {
  const regex = /<span[^>]*data-variable="(\w+)"[^>]*>[\s\S]*?<\/span>/gi;
  return html.replace(regex, (_, name) => `{{${name}}}`);
}

const TYPE_LABELS: Record<VariableDefinition["type"], string> = {
  text: "Text",
  number: "Număr",
  date: "Dată",
  month: "Lună",
  cui: "CUI",
};

const PREDEFINED_VARS: { name: string; label: string }[] = [
  { name: "cui", label: "CUI" },
  { name: "data", label: "Data" },
  { name: "sediuSoc", label: "Sediu social" },
  { name: "denumireFirma", label: "Denumire firmă" },
  { name: "nrRegCom", label: "Nr. Reg. Com." },
  { name: "luna", label: "Luna" },
];

const DEFAULT_HTML =
  "<p><strong>CONTRACT</strong></p><p>Nr. {{contractNr}} / Data {{contractData}}</p><p>Părțile contractante: {{prestatorDescriere}} și {{beneficiarDescriere}}.</p><p>Obiect: servicii contabile începând cu luna {{lunaInceput}}, anul {{anulInceput}}.</p><p>Preț lunar: {{pretLunar}}. Intrare în vigoare: {{dataIntrareVigoare}}.</p>";

type TemplateEditorProps = {
  initialContent: string;
  onContentChange: (html: string) => void;
  variableDefinitions: VariableDefinition[];
  showVarDropdown: boolean;
  onToggleVarDropdown: () => void;
  minHeight?: string;
  highlightVariableName?: string | null;
};

export function TemplateEditor({
  initialContent,
  onContentChange,
  variableDefinitions,
  showVarDropdown,
  onToggleVarDropdown,
  minHeight = "min(70vh, 720px)",
  highlightVariableName = null,
}: TemplateEditorProps) {
  const lastSentContentRef = useRef<string | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Variable],
    content: htmlWithVariablesToChips(initialContent || DEFAULT_HTML),
    editorProps: {
      attributes: {
        class:
          "focus:outline-none min-h-[400px] px-3 py-2 text-zinc-900 dark:text-zinc-100 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_strong]:font-bold [&_.variable-chip]:inline-flex [&_.variable-chip]:items-center [&_.variable-chip]:rounded [&_.variable-chip]:bg-zinc-200 [&_.variable-chip]:dark:bg-zinc-600 [&_.variable-chip]:px-1.5 [&_.variable-chip]:py-0.5 [&_.variable-chip]:text-sm [&_.variable-chip]:font-medium [&_.variable-chip]:text-zinc-700 [&_.variable-chip]:dark:text-zinc-200 [&_.variable-chip]:border [&_.variable-chip]:border-zinc-300 [&_.variable-chip]:dark:border-zinc-500",
      },
    },
    onUpdate: ({ editor }) => {
      const html = chipsHtmlToPlaceholders(editor.getHTML());
      lastSentContentRef.current = html;
      onContentChange(html);
    },
  });

  const initialContentRef = useRef(initialContent);
  useEffect(() => {
    if (!editor || !initialContent) return;
    if (initialContent === lastSentContentRef.current) return;
    initialContentRef.current = initialContent;
    lastSentContentRef.current = initialContent;
    editor.commands.setContent(htmlWithVariablesToChips(initialContent), { emitUpdate: false });
  }, [editor, initialContent]);

  useEffect(() => {
    return () => editor?.destroy();
  }, [editor]);

  function insertVariable(varName: string) {
    onToggleVarDropdown();
    editor?.chain().focus().insertVariable(varName).run();
    requestAnimationFrame(() => editor?.commands.focus());
  }

  if (!editor) return null;

  const fillHeight = minHeight === "100%";

  return (
    <div className={`rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 overflow-hidden flex flex-col ${fillHeight ? "flex-1 min-h-0" : ""}`}>
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-1 flex-shrink-0">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded px-2 py-1 text-sm font-medium ${
            editor.isActive("bold")
              ? "bg-zinc-300 dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`rounded px-2 py-1 text-sm font-medium ${
            editor.isActive("italic")
              ? "bg-zinc-300 dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`rounded px-2 py-1 text-sm ${
            editor.isActive("bulletList")
              ? "bg-zinc-300 dark:bg-zinc-600 text-zinc-900 dark:text-zinc-100"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          Listă
        </button>
        <div className="ml-2 border-l border-zinc-300 dark:border-zinc-600 pl-2 relative">
          <button
            type="button"
            onClick={onToggleVarDropdown}
            className="rounded-md px-3 py-1.5 text-sm font-semibold bg-white dark:bg-zinc-100 text-zinc-900 dark:text-zinc-900 border border-zinc-300 dark:border-zinc-400 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
          >
            Inserare variabilă
          </button>
          {showVarDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                aria-hidden
                onClick={onToggleVarDropdown}
              />
              <div className="absolute left-0 top-full mt-1 z-20 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1 max-h-64 overflow-auto min-w-[220px]">
                {PREDEFINED_VARS.length > 0 && (
                  <div className="px-2 pt-1 pb-0.5">
                    <p className="px-2 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Variabile frecvente
                    </p>
                    {PREDEFINED_VARS.map((v) => (
                      <button
                        key={v.name}
                        type="button"
                        onClick={() => insertVariable(v.name)}
                        className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded flex justify-between gap-2"
                      >
                        <span>{v.label}</span>
                        <span className="text-zinc-400 dark:text-zinc-500 text-xs shrink-0 font-mono">
                          {`{{${v.name}}}`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {variableDefinitions.length > 0 && (
                  <div className={PREDEFINED_VARS.length > 0 ? "border-t border-zinc-200 dark:border-zinc-700 pt-1" : ""}>
                    {PREDEFINED_VARS.length > 0 && (
                      <p className="px-2 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                        Variabile template
                      </p>
                    )}
                    {variableDefinitions.map((v) => (
                      <button
                        key={v.name}
                        type="button"
                        onClick={() => insertVariable(v.name)}
                        className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex justify-between gap-2"
                      >
                        <span>{v.name}</span>
                        <span className="text-zinc-400 dark:text-zinc-500 text-xs shrink-0">
                          {TYPE_LABELS[v.type]}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {variableDefinitions.length === 0 && PREDEFINED_VARS.length > 0 && (
                  <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-200 dark:border-zinc-700">
                    Poți adăuga și variabile custom în „Variabile template”.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <div
        className={fillHeight ? "flex-1 min-h-0 overflow-auto" : ""}
        style={fillHeight ? undefined : { minHeight }}
        data-highlight-var={highlightVariableName ?? undefined}
      >
        {highlightVariableName && (
          <style>{`[data-highlight-var="${highlightVariableName}"] span.variable-chip[data-variable="${highlightVariableName}"] {
            outline: 2px solid rgb(59 130 246);
            outline-offset: 2px;
            box-shadow: 0 0 0 2px rgb(59 130 246 / 0.3);
          }`}</style>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export const DEFAULT_TEMPLATE_HTML = DEFAULT_HTML;
