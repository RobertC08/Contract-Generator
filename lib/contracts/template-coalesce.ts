/**
 * DOCX placeholders like {studentFullName | guardianFullName}: first non-empty part wins.
 * Parts are split on "|"; each segment is trimmed and used as a key into `data`.
 */
export function coalesceFromCompositeName(
  compositePlaceholderName: string,
  data: Record<string, unknown>
): string {
  const parts = compositePlaceholderName
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const p of parts) {
    const v = String(data[p] ?? "").trim();
    if (v) return v;
  }
  return "";
}

/** Fills composite keys for every template name that contains "|". */
export function mergeCoalesceCompositePlaceholders(
  data: Record<string, unknown>,
  templatePlaceholderNames: readonly string[]
): Record<string, unknown> {
  const out = { ...data };
  for (const name of templatePlaceholderNames) {
    if (!name.includes("|")) continue;
    out[name] = coalesceFromCompositeName(name, out);
  }
  return out;
}
