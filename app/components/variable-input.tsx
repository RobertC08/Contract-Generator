"use client";

import { useRef, useEffect, useState } from "react";
import type { VariableDefinition } from "@/lib/contracts/variable-definitions";
import {
  LUNI,
  MONTH_CODES,
  getVariableLabel,
} from "@/lib/contracts/variable-utils";
import SignaturePad from "signature_pad";

const SIGNATURE_WIDTH = 400;
const SIGNATURE_HEIGHT = 200;

const inputClass =
  "w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500 text-sm";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";

export type VariableInputProps = {
  name: string;
  type: "text" | "number" | "date" | "month" | "cui" | "signature";
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

function SignaturePadInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio ?? 1, 1);
    canvas.width = SIGNATURE_WIDTH * ratio;
    canvas.height = SIGNATURE_HEIGHT * ratio;
    canvas.style.width = `${SIGNATURE_WIDTH}px`;
    canvas.style.height = `${SIGNATURE_HEIGHT}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(ratio, ratio);
    const pad = new SignaturePad(canvas, { penColor: "rgb(0, 0, 0)" });
    padRef.current = pad;
    const onEnd = () => {
      if (!pad.isEmpty()) {
        setIsDrawing(true);
        onChangeRef.current(pad.toDataURL("image/png"));
      }
    };
    pad.addEventListener("endStroke", onEnd);
    return () => {
      pad.removeEventListener("endStroke", onEnd);
      pad.off();
      padRef.current = null;
    };
  }, []);

  const handleResign = () => {
    onChange("");
    setIsDrawing(false);
  };

  const showSavedImage = value && !isDrawing;

  if (showSavedImage) {
    return (
      <div className="relative">
        <img
          src={value}
          alt={label}
          className="max-h-[200px] w-full object-contain bg-white dark:bg-zinc-900"
        />
        {!disabled && (
          <button
            type="button"
            onClick={handleResign}
            className="absolute top-1 right-1 rounded bg-zinc-200 dark:bg-zinc-600 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-500"
          >
            Resemnare
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className="block w-full bg-white dark:bg-zinc-900 touch-none"
        style={{ width: SIGNATURE_WIDTH, height: SIGNATURE_HEIGHT }}
      />
      <p className="text-xs text-zinc-500 dark:text-zinc-400 px-2 py-1">
        Semnați în casetă (puteți desena mai multe linii)
      </p>
      {!disabled && (
        <div className="px-2 py-1 border-t border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => {
              padRef.current?.clear();
            }}
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Șterge semnătura
          </button>
        </div>
      )}
    </>
  );
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

  if (type === "signature") {
    return (
      <div className="space-y-1">
        <label className={labelClass}>{label}</label>
        <div className="rounded-lg border border-zinc-300 dark:border-zinc-600 overflow-hidden bg-white dark:bg-zinc-900">
          <SignaturePadInput
            label={label}
            value={value}
            onChange={onChange}
            disabled={disabled}
          />
        </div>
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
