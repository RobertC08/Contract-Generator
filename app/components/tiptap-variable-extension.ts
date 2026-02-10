import { Node, mergeAttributes } from "@tiptap/core";

function variableLabel(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z][a-z]*)/g, "$1 $2")
    .replace(/([a-z])([A-Z]+)(?=[A-Z][a-z]|\W|$)/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export const Variable = Node.create({
  name: "variable",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  inline: true,
  atom: true,
  group: "inline",

  addAttributes() {
    return {
      name: {
        default: "",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-variable") ?? "",
        renderHTML: (attrs) => ({ "data-variable": attrs.name }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-variable]",
        getAttrs: (dom) => {
          const name = (dom as HTMLElement).getAttribute("data-variable");
          return name ? { name } : false;
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = variableLabel(node.attrs.name);
    return [
      "span",
      mergeAttributes(
        { class: "variable-chip" },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      label,
    ];
  },

  addCommands() {
    return {
      insertVariable:
        (name: string) =>
        ({ chain }) =>
          chain().focus().insertContent({ type: this.name, attrs: { name } }).run(),
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    variable: {
      insertVariable: (name: string) => ReturnType;
    };
  }
}
