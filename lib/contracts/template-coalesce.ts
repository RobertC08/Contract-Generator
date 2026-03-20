/**
 * DOCX `{studentFullName | guardianFullName}` and `{studentAddress | guardianAddress}`:
 * if `hasGuardian` is true (integration metadata), use guardian then student; else student then guardian.
 */

/** Keys to collect in the fill form for a template placeholder (one field per segment if `|`). */
export function expandPlaceholderToInputVariableKeys(placeholderName: string): string[] {
  if (!placeholderName.includes("|")) return [placeholderName];
  return placeholderName
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export type StudentGuardianCompositeKind = "name" | "address";

/** Placeholder-ele elev|apărător se afișează ca un singur câmp în link-ul de completare. */
export function studentGuardianCompositeKind(
  placeholderName: string
): StudentGuardianCompositeKind | null {
  if (!placeholderName.includes("|")) return null;
  const parts = placeholderName
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length !== 2) return null;
  const set = new Set(parts);
  if (set.has("studentFullName") && set.has("guardianFullName")) return "name";
  if (set.has("studentAddress") && set.has("guardianAddress")) return "address";
  return null;
}

/** După completarea unui singur câmp pentru perechea elev|apărător, scrie valoarea în cheia atomică potrivită. */
export function applyStudentGuardianSingleFieldToPayload(
  data: Record<string, string>,
  templatePlaceholderNames: readonly string[],
  context: Record<string, unknown>
): Record<string, string> {
  const out = { ...data };
  const gp = guardianPrimary(context);
  for (const name of templatePlaceholderNames) {
    const kind = studentGuardianCompositeKind(name);
    if (!kind) continue;
    const raw = String(out[name] ?? "").trim();
    if (kind === "name") {
      out.studentFullName = gp ? "" : raw;
      out.guardianFullName = gp ? raw : "";
    } else {
      out.studentAddress = gp ? "" : raw;
      out.guardianAddress = gp ? raw : "";
    }
  }
  return out;
}

function guardianPrimary(data: Record<string, unknown>): boolean {
  const hg = String(data.hasGuardian ?? "").trim().toLowerCase();
  return hg === "true" || hg === "1" || hg === "yes";
}

export function coalesceFromCompositeName(
  compositePlaceholderName: string,
  data: Record<string, unknown>
): string {
  const parts = compositePlaceholderName
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (parts.length === 2) {
    const set = new Set(parts);
    if (set.has("studentFullName") && set.has("guardianFullName")) {
      const s = String(data.studentFullName ?? "").trim();
      const g = String(data.guardianFullName ?? "").trim();
      return guardianPrimary(data) ? g || s : s || g;
    }
    if (set.has("studentAddress") && set.has("guardianAddress")) {
      const s = String(data.studentAddress ?? "").trim();
      const g = String(data.guardianAddress ?? "").trim();
      return guardianPrimary(data) ? g || s : s || g;
    }
  }

  for (const p of parts) {
    const v = String(data[p] ?? "").trim();
    if (v) return v;
  }
  return "";
}

/** Fills composite keys for every template name that contains "|". */
export function mergeCoalesceCompositePlaceholders(
  data: Record<string, unknown>,
  templatePlaceholderNames: readonly string[],
  /** Merged into lookup only (e.g. hasGuardian from integrationMetadata); not copied into output. */
  contextForCoalesce?: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...data };
  const view: Record<string, unknown> = contextForCoalesce
    ? { ...contextForCoalesce, ...data }
    : out;
  for (const name of templatePlaceholderNames) {
    if (!name.includes("|")) continue;
    out[name] = coalesceFromCompositeName(name, view);
  }
  return out;
}
