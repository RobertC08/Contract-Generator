"use client";

import type { VariableDefinition } from "@/lib/contracts/variable-definitions";
import {
  LUNI,
  MONTH_CODES,
  getVariableLabel,
} from "@/lib/contracts/variable-utils";

const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 text-sm";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";

export type VariableInputProps = {
  name: string;
  type: "text" | "number" | "date" | "month" | "cui";
  definition?: VariableDefinition;
  value: string;
  onChange: (value: string) => void;
  onLinkedChange?: (vars: { denumire: string; sediu: string; regCom: string }) => void;
  anafStatus?: "idle" | "loading" | "error" | "success";
  anafError?: string | null;
  onAnafLookup?: () => void;
  disabled?: boolean;
};

function isValidCuiInput(cui: string): boolean {
  const digits = cui.replace(/\s/g, "").replace(/^RO/i, "").replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 10;
}

export function VariableInput({
  name,
  type,
  definition,
  value,
  onChange,
  onLinkedChange,
  anafStatus = "idle",
  anafError = null,
  onAnafLookup,
  disabled = false,
}: VariableInputProps) {
  const label = getVariableLabel(definition, name);
  const id = `var-${name}`;

  if (type === "number") {
    return (
      <div className="space-y-1">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        <input
          id={id}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          disabled={disabled}
        />
      </div>
    );
  }

  if (type === "date") {
    return (
      <div className="space-y-1">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        <input
          id={id}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          disabled={disabled}
        />
      </div>
    );
  }

  if (type === "month") {
    return (
      <div className="space-y-1">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          disabled={disabled}
        >
          <option value="">Selectați luna</option>
          {LUNI.map((luna, i) => (
            <option key={luna} value={MONTH_CODES[i]}>
              {luna}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (type === "cui") {
    const linked = definition?.linkedVariables;
    const canLookup = isValidCuiInput(value.trim()) && onAnafLookup;
    return (
      <div className="space-y-2">
        <div className="flex gap-2 items-end">
          <div className="flex-1 min-w-0 space-y-1">
            <label htmlFor={id} className={labelClass}>
              {label}
            </label>
            <input
              id={id}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className={inputClass}
              placeholder="ex. 12345678"
              disabled={disabled}
            />
          </div>
          {onAnafLookup && (
            <button
              type="button"
              onClick={onAnafLookup}
              disabled={!canLookup || anafStatus === "loading" || disabled}
              className="flex-shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {anafStatus === "loading" ? "Se caută…" : "Verifică CUI"}
            </button>
          )}
        </div>
        {anafStatus === "error" && anafError && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {anafError}
          </p>
        )}
        {anafStatus === "success" && (
          <p className="text-sm text-green-600 dark:text-green-400">
            Date completate automat (denumire, sediu, Reg. Com.).
          </p>
        )}
        {linked && onLinkedChange && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            La verificare CUI se completează: {linked.denumire}, {linked.sediu}, {linked.regCom}.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        placeholder={label}
        disabled={disabled}
      />
    </div>
  );
}
