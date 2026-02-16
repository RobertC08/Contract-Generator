import type { VariableDefinition } from "./variable-definitions";

// Collapse adjacent inline tags so ".........</span><span>........." becomes one run for matching
const INLINE_TAG_COLLAPSE_RE = /<\/(?:span|strong|em|b|i|u)(?:\s[^>]*)?>\s*<(?:span|strong|em|b|i|u)(?:\s[^>]*)?>/gi;

// Dot-like: . · (U+00B7) • (U+2022) … (U+2026 horizontal ellipsis). Underscore-like: _ – — 
// One or more runs (2+ chars), with only optional whitespace between = one field.
// Optional trailing (space + comma/period/paren) belongs to the same field: ".....," → one variable.
const PLACEHOLDER_RE = /((?:[.\u00B7\u2022\u2026]{2,}|[\u005F\u2013\u2014]{2,})(?:\s*(?:[.\u00B7\u2022\u2026]{2,}|[\u005F\u2013\u2014]{2,}))*)(\s*[,.)])?/g;

function normalizeForPlaceholders(html: string): string {
  let out = html;
  let prev = "";
  while (out !== prev) {
    prev = out;
    out = out.replace(INLINE_TAG_COLLAPSE_RE, "");
  }
  return out;
}

/**
 * Replaces ......... / ______ with {{camp1}}, {{camp2}}, ...
 * ".....," or "_____," counts as one field (comma preserved after variable).
 * Returns variable definitions to add (only for new names, type "text").
 */
export function detectPlaceholderFields(
  content: string,
  existingDefs: VariableDefinition[]
): { content: string; newDefs: VariableDefinition[] } {
  const existingNames = new Set(existingDefs.map((d) => d.name));
  const normalized = normalizeForPlaceholders(content);
  let counter = 0;
  const newContent = normalized.replace(PLACEHOLDER_RE, (_match, _run, trailing: string | undefined) => {
    counter++;
    return `{{camp${counter}}}${trailing ?? ""}`;
  });
  const newDefs: VariableDefinition[] = [];
  for (let i = 1; i <= counter; i++) {
    const name = `camp${i}`;
    if (!existingNames.has(name)) {
      existingNames.add(name);
      newDefs.push({ name, type: "text", label: `Camp ${i}` });
    }
  }
  return { content: newContent, newDefs };
}
