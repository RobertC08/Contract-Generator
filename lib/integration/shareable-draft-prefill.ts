export const WEBHOOK_METADATA_KEYS = [
  "studentId",
  "schoolId",
  "guardianId",
  "contractFor",
  "hasGuardian",
] as const;

/** Keeps only integration keys sent for the signed webhook payload. */
export function pickWebhookMetadata(meta: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of WEBHOOK_METADATA_KEYS) {
    if (Object.prototype.hasOwnProperty.call(meta, k)) {
      out[k] = meta[k] ?? "";
    }
  }
  return out;
}

/** Prefill entries whose keys exist in the template variable name set. */
export function buildPrefillVariablesList(
  meta: Record<string, string>,
  allowedNames: Set<string>
): Array<{ key: string; value: string }> {
  const list: Array<{ key: string; value: string }> = [];
  for (const [k, v] of Object.entries(meta)) {
    if (allowedNames.has(k)) {
      list.push({ key: k, value: v });
    }
  }
  list.sort((a, b) => a.key.localeCompare(b.key));
  return list;
}

/** Union of DOCX placeholders and variableDefinitions[].name. */
export function collectTemplateVariableNames(
  fromDocx: string[],
  variableDefinitions: unknown
): Set<string> {
  const set = new Set<string>();
  for (const n of fromDocx) {
    if (n) set.add(n);
  }
  const defs = Array.isArray(variableDefinitions) ? variableDefinitions : [];
  for (const d of defs) {
    if (d && typeof d === "object" && "name" in d) {
      const name = (d as { name?: unknown }).name;
      if (typeof name === "string" && name.length > 0) set.add(name);
    }
  }
  return set;
}
