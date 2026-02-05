const ANAF_API_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";

const CUI_DIGITS_MIN = 6;
const CUI_DIGITS_MAX = 10;

export type AnafCompany = {
  cui: string;
  denumire: string;
  adresa: string;
  nrRegCom: string;
  iban?: string;
  telefon?: string;
};

type AnafDateGenerale = {
  cui?: string;
  data?: string;
  denumire?: string;
  adresa?: string;
  nrRegCom?: string;
  telefon?: string;
  fax?: string;
  codPostal?: string;
  iban?: string;
  [key: string]: unknown;
};

type AnafAdresaSediu = {
  sdenumire_Strada?: string;
  snumar_Strada?: string;
  sdenumire_Localitate?: string;
  scod_Localitate?: string;
  sdenumire_Judet?: string;
  scod_Judet?: string;
  scod_JudetAuto?: string;
  stara?: string;
  sdetalii_Adresa?: string;
  scod_Postal?: string;
  [key: string]: unknown;
};

type AnafFoundItem = {
  date_generale?: AnafDateGenerale;
  adresa_sediu_social?: AnafAdresaSediu;
  adresa_domiciliu_fiscal?: Record<string, unknown>;
  [key: string]: unknown;
};

type AnafResponse = {
  cod?: number | string;
  message?: string;
  found?: AnafFoundItem[];
  notFound?: unknown[];
  mesaj?: string;
  [key: string]: unknown;
};

function normalizeCui(cui: string): string {
  const digits = cui.replace(/\s/g, "").replace(/^RO/i, "").replace(/\D/g, "");
  return digits;
}

function isValidCui(cui: string): boolean {
  const digits = normalizeCui(cui);
  return digits.length >= CUI_DIGITS_MIN && digits.length <= CUI_DIGITS_MAX;
}

function buildAddressFromSediu(sediu?: AnafAdresaSediu): string {
  if (!sediu) return "";
  const parts: string[] = [];
  if (sediu.sdenumire_Strada) {
    parts.push(
      [sediu.sdenumire_Strada, sediu.snumar_Strada].filter(Boolean).join(" ")
    );
  }
  if (sediu.sdenumire_Localitate) parts.push(sediu.sdenumire_Localitate);
  if (sediu.sdenumire_Judet) parts.push(`jud. ${sediu.sdenumire_Judet}`);
  if (sediu.scod_Postal) parts.push(sediu.scod_Postal);
  if (sediu.stara) parts.push(sediu.stara);
  if (sediu.sdetalii_Adresa) parts.push(sediu.sdetalii_Adresa);
  return parts.filter(Boolean).join(", ");
}

function mapFoundToCompany(item: AnafFoundItem): AnafCompany {
  const dg = item.date_generale ?? {};
  const sediu = item.adresa_sediu_social;
  const adresa =
    (dg.adresa && String(dg.adresa).trim()) ||
    buildAddressFromSediu(sediu) ||
    "";
  return {
    cui: dg.cui != null ? String(dg.cui) : "",
    denumire: dg.denumire != null ? String(dg.denumire) : "",
    adresa,
    nrRegCom: dg.nrRegCom != null ? String(dg.nrRegCom) : "",
    iban: dg.iban != null && String(dg.iban).trim() ? String(dg.iban) : undefined,
    telefon:
      dg.telefon != null && String(dg.telefon).trim() ? String(dg.telefon) : undefined,
  };
}

export function isValidCuiFormat(cui: string): boolean {
  return isValidCui(cui);
}

export async function fetchCompanyByCui(
  cui: string,
  data?: string
): Promise<AnafCompany | null> {
  const digits = normalizeCui(cui);
  if (!isValidCui(digits)) {
    return null;
  }
  const cuiNum = parseInt(digits, 10);
  const dataStr =
    data && /^\d{4}-\d{2}-\d{2}$/.test(data)
      ? data
      : new Date().toISOString().slice(0, 10);

  const body = [{ cui: cuiNum, data: dataStr }];
  const res = await fetch(ANAF_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`ANAF request failed: ${res.status} ${res.statusText}`);
  }

  let json: AnafResponse;
  try {
    json = (await res.json()) as AnafResponse;
  } catch {
    throw new Error("ANAF response is not valid JSON");
  }

  const code = json.cod;
  if (code !== 200 && code !== "200") {
    const msg =
      (json.message != null && String(json.message).trim()) ||
      (json.mesaj != null && String(json.mesaj).trim()) ||
      "";
    const parts = msg ? [msg] : [];
    if (code != null) parts.push(`(cod: ${code})`);
    throw new Error(parts.length ? `ANAF: ${parts.join(" ")}` : "ANAF: răspuns invalid");
  }

  const found = json.found ?? [];
  const notFound = (json.notFound ?? []) as unknown[];
  const cuiStr = digits;

  if (notFound.some((n) => String(n) === cuiStr)) {
    return null;
  }
  const first = found[0];
  if (!first) {
    return null;
  }
  return mapFoundToCompany(first);
}
