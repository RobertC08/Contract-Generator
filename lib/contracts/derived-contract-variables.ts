import { parseDateToIso } from "./variable-utils";

/** DOCX placeholders filled automatically (not shown as inputs on /contract/completeaza). */
export const DERIVED_NO_INPUT_VAR_NAMES: readonly string[] = [
  "Data_final_un_an",
  "contractDurationDays",
  "Perioada contract (in zile)",
];

const DURATION_CANONICAL = "contractDurationDays";
const DURATION_LABEL_RO = "Perioada contract (in zile)";

function normalizeDateValue(v: unknown): string {
  return parseDateToIso(String(v ?? "").trim());
}

/**
 * Inclusive calendar days from start through end (both ends count), UTC date arithmetic.
 * Returns "" if either date invalid or end before start.
 */
export function computeContractDurationDays(startRaw: unknown, endRaw: unknown): string {
  const start = normalizeDateValue(startRaw);
  const end = normalizeDateValue(endRaw);
  if (!start || !end) return "";
  const ps = start.split("-");
  const pe = end.split("-");
  if (ps.length !== 3 || pe.length !== 3) return "";
  const ys = Number(ps[0]);
  const ms = Number(ps[1]);
  const ds = Number(ps[2]);
  const ye = Number(pe[0]);
  const me = Number(pe[1]);
  const de = Number(pe[2]);
  if (![ys, ms, ds, ye, me, de].every((n) => Number.isFinite(n))) return "";
  const s = Date.UTC(ys, ms - 1, ds);
  const e = Date.UTC(ye, me - 1, de);
  if (e < s) return "";
  const inclusive = Math.floor((e - s) / 86400000) + 1;
  return String(inclusive);
}

/** Injects computed contract fields before docxtemplater.render. */
export function mergeDerivedContractVariables(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  const duration = computeContractDurationDays(out.contractStartDate, out.contractEndDate);
  if (duration !== "") {
    out[DURATION_CANONICAL] = duration;
    out[DURATION_LABEL_RO] = duration;
  } else {
    if (out[DURATION_CANONICAL] === undefined || out[DURATION_CANONICAL] === null) {
      out[DURATION_CANONICAL] = "";
    }
    if (out[DURATION_LABEL_RO] === undefined || out[DURATION_LABEL_RO] === null) {
      out[DURATION_LABEL_RO] = "";
    }
  }
  return out;
}
