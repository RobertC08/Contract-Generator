import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchCompanyByCui, isValidCuiFormat } from "./client";

describe("isValidCuiFormat", () => {
  it("returns true for 6 digits", () => {
    expect(isValidCuiFormat("123456")).toBe(true);
  });
  it("returns true for 10 digits", () => {
    expect(isValidCuiFormat("1234567890")).toBe(true);
  });
  it("returns true for CUI with RO prefix", () => {
    expect(isValidCuiFormat("RO123456")).toBe(true);
    expect(isValidCuiFormat("ro123456")).toBe(true);
  });
  it("returns true for CUI with spaces", () => {
    expect(isValidCuiFormat("12 34 56")).toBe(true);
  });
  it("returns false for fewer than 6 digits", () => {
    expect(isValidCuiFormat("12345")).toBe(false);
    expect(isValidCuiFormat("")).toBe(false);
  });
  it("returns false for more than 10 digits", () => {
    expect(isValidCuiFormat("12345678901")).toBe(false);
  });
  it("returns false when only letters", () => {
    expect(isValidCuiFormat("abcdef")).toBe(false);
  });
});

describe("fetchCompanyByCui", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response()))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null for invalid CUI", async () => {
    expect(await fetchCompanyByCui("123")).toBeNull();
    expect(await fetchCompanyByCui("")).toBeNull();
    expect(await fetchCompanyByCui("12345678901")).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("maps found[0] to AnafCompany and returns it", async () => {
    const mockCompany = {
      date_generale: {
        cui: "123456",
        denumire: "SC Test SRL",
        adresa: "Str. Exemplu nr. 1, București",
        nrRegCom: "J40/123/2020",
        iban: "RO49AAAA1B31007593840000",
        telefon: "0211234567",
      },
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          cod: 200,
          message: "SUCCESS",
          found: [mockCompany],
          notFound: [],
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await fetchCompanyByCui("123456");
    expect(result).not.toBeNull();
    expect(result).toEqual({
      cui: "123456",
      denumire: "SC Test SRL",
      adresa: "Str. Exemplu nr. 1, București",
      nrRegCom: "J40/123/2020",
      iban: "RO49AAAA1B31007593840000",
      telefon: "0211234567",
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("returns null when CUI is in notFound", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          cod: 200,
          message: "SUCCESS",
          found: [],
          notFound: [123456],
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    );
    expect(await fetchCompanyByCui("123456")).toBeNull();
  });

  it("accepts response without cod when found is present (ANAF variant)", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          found: [
            {
              date_generale: {
                cui: 39066744,
                denumire: "FRUIT CREATIVE S.R.L.",
                adresa: "JUD. ILFOV, SAT MOARA VLĂSIEI...",
                nrRegCom: "J23/5512/2020",
                iban: "",
              },
            },
          ],
          notFound: [],
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    );
    const result = await fetchCompanyByCui("39066744");
    expect(result).not.toBeNull();
    expect(result?.denumire).toBe("FRUIT CREATIVE S.R.L.");
    expect(result?.nrRegCom).toBe("J23/5512/2020");
  });

  it("returns null when found is empty and notFound does not contain CUI", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          cod: 200,
          message: "SUCCESS",
          found: [],
          notFound: [],
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    );
    expect(await fetchCompanyByCui("123456")).toBeNull();
  });

  it("throws when response is not ok", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response("Error", { status: 500 })
    );
    await expect(fetchCompanyByCui("123456")).rejects.toThrow(
      "ANAF request failed"
    );
  });

  it("throws when response body is not JSON", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response("not json", { status: 200 })
    );
    await expect(fetchCompanyByCui("123456")).rejects.toThrow(
      "ANAF response is not valid JSON"
    );
  });

  it("throws when cod is not 200", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ cod: 400, message: "Bad request" }),
        { headers: { "Content-Type": "application/json" } }
      )
    );
    await expect(fetchCompanyByCui("123456")).rejects.toThrow("ANAF:");
  });

  it("builds address from adresa_sediu_social when date_generale.adresa is empty", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          cod: 200,
          message: "SUCCESS",
          found: [
            {
              date_generale: {
                cui: "123456",
                denumire: "SC SRL",
                adresa: "",
                nrRegCom: "J40/1",
              },
              adresa_sediu_social: {
                sdenumire_Strada: "Str. Test",
                snumar_Strada: "5",
                sdenumire_Localitate: "București",
                sdenumire_Judet: "București",
                scod_Postal: "010101",
                stara: "România",
              },
            },
          ],
          notFound: [],
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    );
    const result = await fetchCompanyByCui("123456");
    expect(result?.adresa).toBe(
      "Str. Test 5, București, jud. București, 010101, România"
    );
  });
});

describe("fetchCompanyByCui (integration – real ANAF API)", () => {
  it("calls ANAF API with CUI 342414 and returns company or null", async () => {
    let result: Awaited<ReturnType<typeof fetchCompanyByCui>>;
    try {
      result = await fetchCompanyByCui("342414");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("404") || msg.includes("ANAF request failed")) {
        expect(msg).toContain("404");
        return;
      }
      throw err;
    }
    if (result === null) {
      expect(result).toBeNull();
      return;
    }
    expect(result).toMatchObject({
      cui: expect.any(String),
      denumire: expect.any(String),
      adresa: expect.any(String),
      nrRegCom: expect.any(String),
    });
    expect(typeof result.denumire).toBe("string");
    expect(result.denumire.length).toBeGreaterThan(0);
  }, 15000);
});
