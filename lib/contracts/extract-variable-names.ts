/**
 * Extracts variable names from text that contains placeholders.
 * Same rules as DOCX: {name}, {#dropdownName# label}, {@siblingName}, {%imageName}.
 * Use this in both Node (docx-generator) and client (edit page) to avoid wrong names like "#x# label" or "@y".
 * Only returns names that match the variable name pattern (letters, digits, space, _, /, ., -) to avoid XML/HTML garbage.
 */

const VALID_VAR_NAME = /^[a-zA-Z0-9_/\s.-]+$/;
const VALID_VAR_NAME_CHUNK = /[a-zA-Z0-9_/\s.-]+/g;

function normalizeCapturedName(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (VALID_VAR_NAME.test(trimmed)) return trimmed;
  const chunks = trimmed.match(VALID_VAR_NAME_CHUNK);
  if (!chunks || chunks.length === 0) return null;
  let best = chunks[0]!;
  for (let i = 1; i < chunks.length; i++) {
    const c = chunks[i]!;
    if (c.length >= best.length) best = c;
  }
  return best.trim() || null;
}

const DROPDOWN_PLACEHOLDER_REGEX = /\{#([^{}#]+)#\s*([^}]*)\}/g;
const SIBLING_PLACEHOLDER_REGEX = /\{@([^{}]+)\}/g;
const IMAGE_PLACEHOLDER_REGEX = /\{%([^{}]+)\}/g;
const SIMPLE_PLACEHOLDER_REGEX = /\{(?!%)(?!#)(?!@)([^{}]+)\}/g;

export function extractVariableNamesFromText(fullText: string): string[] {
  const seen = new Set<string>();
  const order: { index: number; name: string }[] = [];
  function add(match: RegExpExecArray, nameIndex: number) {
    const name = normalizeCapturedName(match[nameIndex] ?? "");
    if (!name || seen.has(name)) return;
    seen.add(name);
    order.push({ index: match.index ?? 0, name });
  }
  let m: RegExpExecArray | null;
  const dropRe = new RegExp(DROPDOWN_PLACEHOLDER_REGEX.source, "g");
  while ((m = dropRe.exec(fullText)) !== null) add(m, 1);
  const sibRe = new RegExp(SIBLING_PLACEHOLDER_REGEX.source, "g");
  while ((m = sibRe.exec(fullText)) !== null) add(m, 1);
  const imageRe = new RegExp(IMAGE_PLACEHOLDER_REGEX.source, "g");
  while ((m = imageRe.exec(fullText)) !== null) add(m, 1);
  const simpleRe = new RegExp(SIMPLE_PLACEHOLDER_REGEX.source, "g");
  while ((m = simpleRe.exec(fullText)) !== null) add(m, 1);
  order.sort((a, b) => a.index - b.index);
  return order.map((o) => o.name);
}
