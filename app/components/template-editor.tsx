"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";

const VARIABILE_COMUNE = [
  "contractNr",
  "contractData",
  "prestatorNume",
  "prestatorSediu",
  "prestatorCUI",
  "prestatorDescriere",
  "beneficiarNume",
  "beneficiarSediu",
  "beneficiarCUI",
  "beneficiarDescriere",
  "lunaInceput",
  "anulInceput",
  "dataIntrareVigoare",
  "pretLunar",
  "continut",
];

const DEFAULT_HTML =
  "<p><strong>CONTRACT</strong></p><p>Nr. {{contractNr}} / Data {{contractData}}</p><p>Părțile contractante: {{prestatorDescriere}} și {{beneficiarDescriere}}.</p><p>Obiect: servicii contabile începând cu luna {{lunaInceput}}, anul {{anulInceput}}.</p><p>Preț lunar: {{pretLunar}}. Intrare în vigoare: {{dataIntrareVigoare}}.</p>";

type TemplateEditorProps = {
  initialContent: string;
  onContentChange: (html: string) => void;
  showVarDropdown: boolean;
  onToggleVarDropdown: () => void;
  minHeight?: string;
};

export function TemplateEditor({
  initialContent,
  onContentChange,
  showVarDropdown,
  onToggleVarDropdown,
  minHeight = "320px",
}: TemplateEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent || DEFAULT_HTML,
    editorProps: {
      attributes: {
        class:
          "focus:outline-none min-h-[200px] px-3 py-2 text-zinc-900 dark:text-zinc-100 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_strong]:font-bold",
      },
    },
    onUpdate: ({ editor }) => {
      onContentChange(editor.getHTML());
    },
  });

  const initialContentRef = useRef(initialContent);
  useEffect(() => {
    if (editor && initialContent && initialContentRef.current !== initialContent) {
      initialContentRef.current = initialContent;
      editor.commands.setContent(initialContent, { emitUpdate: false });
    }
  }, [editor, initialContent]);

  useEffect(() => {
    return () => editor?.destroy();
  }, [editor]);

  function insertVariable(varName: string) {
    editor?.chain().focus().insertContent(`{{${varName}}}`).run();
    onToggleVarDropdown();
  }

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-1">
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
            className="rounded px-2 py-1 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
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
              <div className="absolute left-0 top-full mt-1 z-20 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1 max-h-48 overflow-auto min-w-[180px]">
                {VARIABILE_COMUNE.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export const DEFAULT_TEMPLATE_HTML = DEFAULT_HTML;
