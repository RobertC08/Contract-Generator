import type { VariableDefinition, VariableDefinitions } from "./variable-definitions";

export const PREDEFINED_VAR_TYPES: Record<string, VariableDefinition["type"]> = {
  luna: "month",
  data: "date",
  cui: "cui",
};

export const DEFAULT_CUI_LINKED = {
  denumire: "denumireFirma",
  sediu: "sediuSoc",
  regCom: "nrRegCom",
} as const;

export const LUNI = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
] as const;

export const MONTH_CODES = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"] as const;

export function humanizeVariableName(name: string): string {
  const words = name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z][a-z]*)/g, "$1 $2")
    .replace(/([a-z])([A-Z]+)(?=[A-Z][a-z]|\W|$)/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim()
    .split(/\s+/);
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function getVariableDefinition(
  defs: VariableDefinitions | null | undefined,
  name: string
): VariableDefinition | undefined {
  const fromDefs = defs?.find((d) => d.name === name);
  if (fromDefs) return fromDefs;
  const predefinedType = PREDEFINED_VAR_TYPES[name];
  if (predefinedType === "cui")
    return { name, type: "cui", linkedVariables: { ...DEFAULT_CUI_LINKED } };
  if (predefinedType) return { name, type: predefinedType };
  return undefined;
}

export function getVariableType(
  defs: VariableDefinitions | null | undefined,
  name: string
): "text" | "number" | "date" | "month" | "cui" | "signature" {
  const def = getVariableDefinition(defs, name);
  return def?.type ?? "text";
}

export function getVariableLabel(
  def: VariableDefinition | undefined,
  name: string
): string {
  if (def?.label) return def.label;
  return humanizeVariableName(name);
}

export function formatDateToDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Parses YYYY-MM-DD or DD.MM.YYYY to ISO (YYYY-MM-DD). Returns "" if invalid. */
export function parseDateToIso(s: string): string {
  const t = (s ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const dmY = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmY) {
    const [, d, m, y] = dmY;
    const dd = d!.padStart(2, "0");
    const mm = m!.padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  return "";
}

/** Adds days to a date string (ISO or DD.MM.YYYY). Returns ISO (YYYY-MM-DD) or "". */
export function addDays(dateStr: string, days: number): string {
  const iso = parseDateToIso(dateStr);
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthCodeToName(code: string): string {
  const i = MONTH_CODES.indexOf(code as (typeof MONTH_CODES)[number]);
  return i >= 0 ? LUNI[i] : code;
}
