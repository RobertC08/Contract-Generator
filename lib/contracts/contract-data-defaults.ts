/** DOCX / form field for „data contractului” (ziua curentă dacă e goală). */
export const CONTRACT_DATE_FIELD_NAME = "Data";

/** Calendar date in Europe/Bucharest as YYYY-MM-DD. */
export function todayIsoDateEuropeBucharest(now: Date = new Date()): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  if (!y || !m || !d) return "";
  return `${y}-${m}-${d}`;
}

function isEmptyDataValue(v: unknown): boolean {
  const s = typeof v === "string" ? v.trim() : String(v ?? "").trim();
  return s === "" || s === "......";
}

/** Sets `Data` to today (Bucharest) when missing or empty (incl. docx „......”). */
export function mergeDefaultContractDataField(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  if (!isEmptyDataValue(out[CONTRACT_DATE_FIELD_NAME])) return out;
  const today = todayIsoDateEuropeBucharest();
  if (today) out[CONTRACT_DATE_FIELD_NAME] = today;
  return out;
}
