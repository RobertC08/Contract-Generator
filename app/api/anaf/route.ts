import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  fetchCompanyByCui,
  isValidCuiFormat,
} from "@/lib/anaf/client";

export const runtime = "nodejs";

const anafRequestSchema = z.object({
  cui: z.string().min(1),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON" },
      { status: 400 }
    );
  }

  const parsed = anafRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.message },
      { status: 400 }
    );
  }

  const { cui, data } = parsed.data;
  if (!isValidCuiFormat(cui)) {
    return NextResponse.json(
      { message: "CUI invalid (6–10 cifre)" },
      { status: 400 }
    );
  }

  try {
    const company = await fetchCompanyByCui(cui, data);
    if (!company) {
      return NextResponse.json(
        { message: "CUI negăsit în ANAF" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      denumire: company.denumire,
      adresa: company.adresa,
      nrRegCom: company.nrRegCom,
      iban: company.iban,
      cui: company.cui,
      telefon: company.telefon,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Eroare la interogarea ANAF";
    return NextResponse.json({ message }, { status: 502 });
  }
}
