/**
 * Extracts variable names from text that contains placeholders.
 * Same rules as DOCX: {name}, {#dropdownName# label}, {@siblingName}, {%imageName}.
 * Use this in both Node (docx-generator) and client (edit page) to avoid wrong names like "#x# label" or "@y".
 * Simple {…} placeholders: numele = text între acolade.
 * Caractere permise: litere (incl. diacritice), cifre, _ / spațiu . , - ( ) : și | (ex. „studentFullName | guardianFullName”).
 */

const VALID_VAR_NAME = /^[\p{L}\p{N}_/\s.,():|-]+$/u;
const VALID_VAR_NAME_CHUNK = /[\p{L}\p{N}_/\s.,():|-]+/gu;

function normalizeCapturedName(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/[{}]/.test(trimmed)) return trimmed;
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
  const firstIndex = new Map<string, number>();
  function note(match: RegExpExecArray, nameIndex: number) {
    const name = normalizeCapturedName(match[nameIndex] ?? "");
    if (!name) return;
    const idx = match.index ?? 0;
    const prev = firstIndex.get(name);
    if (prev === undefined || idx < prev) firstIndex.set(name, idx);
  }
  let m: RegExpExecArray | null;
  const dropRe = new RegExp(DROPDOWN_PLACEHOLDER_REGEX.source, "g");
  while ((m = dropRe.exec(fullText)) !== null) note(m, 1);
  const sibRe = new RegExp(SIBLING_PLACEHOLDER_REGEX.source, "g");
  while ((m = sibRe.exec(fullText)) !== null) note(m, 1);
  const imageRe = new RegExp(IMAGE_PLACEHOLDER_REGEX.source, "g");
  while ((m = imageRe.exec(fullText)) !== null) note(m, 1);
  const simpleRe = new RegExp(SIMPLE_PLACEHOLDER_REGEX.source, "g");
  while ((m = simpleRe.exec(fullText)) !== null) note(m, 1);
  return [...firstIndex.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name);
}
