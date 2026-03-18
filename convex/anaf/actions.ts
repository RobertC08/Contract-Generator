"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

const ANAF_API_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";
const CUI_DIGITS_MIN = 6;
const CUI_DIGITS_MAX = 10;

function normalizeCui(cui: string): string {
  return cui.replace(/\s/g, "").replace(/^RO/i, "").replace(/\D/g, "");
}

function isValidCui(cui: string): boolean {
  const digits = normalizeCui(cui);
  return digits.length >= CUI_DIGITS_MIN && digits.length <= CUI_DIGITS_MAX;
}

type AnafDateGenerale = { cui?: string; data?: string; denumire?: string; adresa?: string; nrRegCom?: string; telefon?: string; iban?: string; [key: string]: unknown };
type AnafAdresaSediu = { sdenumire_Strada?: string; snumar_Strada?: string; sdenumire_Localitate?: string; sdenumire_Judet?: string; scod_Postal?: string; stara?: string; sdetalii_Adresa?: string; [key: string]: unknown };
type AnafFoundItem = { date_generale?: AnafDateGenerale; adresa_sediu_social?: AnafAdresaSediu; [key: string]: unknown };
type AnafResponse = { cod?: number | string; message?: string; mesaj?: string; found?: AnafFoundItem[]; notFound?: unknown[]; [key: string]: unknown };

function buildAddressFromSediu(sediu?: AnafAdresaSediu): string {
  if (!sediu) return "";
  const parts: string[] = [];
  if (sediu.sdenumire_Strada) parts.push([sediu.sdenumire_Strada, sediu.snumar_Strada].filter(Boolean).join(" "));
  if (sediu.sdenumire_Localitate) parts.push(sediu.sdenumire_Localitate);
  if (sediu.sdenumire_Judet) parts.push(`jud. ${sediu.sdenumire_Judet}`);
  if (sediu.scod_Postal) parts.push(sediu.scod_Postal);
  if (sediu.stara) parts.push(sediu.stara);
  if (sediu.sdetalii_Adresa) parts.push(sediu.sdetalii_Adresa);
  return parts.filter(Boolean).join(", ");
}

export const fetchCompanyByCui = action({
  args: {
    cui: v.string(),
    data: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ cui: string; denumire: string; adresa: string; nrRegCom: string; iban?: string; telefon?: string } | null> => {
    const digits = normalizeCui(args.cui);
    if (!isValidCui(digits)) return null;
    const cuiNum = parseInt(digits, 10);
    const dataStr = args.data && /^\d{4}-\d{2}-\d{2}$/.test(args.data) ? args.data : new Date().toISOString().slice(0, 10);
    const body = [{ cui: cuiNum, data: dataStr }];
    const res = await fetch(ANAF_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`ANAF request failed: ${res.status} ${res.statusText}`);
    let json: AnafResponse;
    try {
      json = (await res.json()) as AnafResponse;
    } catch {
      throw new Error("ANAF response is not valid JSON");
    }
    const code = json.cod;
    if (code != null && code !== 200 && code !== "200") {
      const msg = (json.message != null && String(json.message).trim()) || (json.mesaj != null && String(json.mesaj).trim()) || "";
      throw new Error(msg ? `ANAF: ${msg}` : "ANAF: răspuns invalid");
    }
    const found = json.found ?? [];
    const notFound = (json.notFound ?? []) as unknown[];
    if (notFound.some((n) => String(n) === digits)) return null;
    const first = found[0];
    if (!first) return null;
    const dg = first.date_generale ?? {};
    const sediu = first.adresa_sediu_social;
    const adresa = (dg.adresa && String(dg.adresa).trim()) || buildAddressFromSediu(sediu) || "";
    return {
      cui: dg.cui != null ? String(dg.cui) : "",
      denumire: dg.denumire != null ? String(dg.denumire) : "",
      adresa,
      nrRegCom: dg.nrRegCom != null ? String(dg.nrRegCom) : "",
      iban: dg.iban != null && String(dg.iban).trim() ? String(dg.iban) : undefined,
      telefon: dg.telefon != null && String(dg.telefon).trim() ? String(dg.telefon) : undefined,
    };
  },
});
