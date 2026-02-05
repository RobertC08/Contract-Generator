import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { fetchCompanyByCui, isValidCuiFormat } from "@/lib/anaf/client";
import { POST } from "./route";

vi.mock("@/lib/anaf/client", () => ({
  fetchCompanyByCui: vi.fn(),
  isValidCuiFormat: vi.fn(),
}));

function request(body: unknown): NextRequest {
  return new Request("http://localhost/api/anaf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

describe("POST /api/anaf", () => {
  beforeEach(() => {
    vi.mocked(isValidCuiFormat).mockReturnValue(true);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/api/anaf", {
      method: "POST",
      body: "invalid",
    }) as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("JSON");
  });

  it("returns 400 when cui is missing", async () => {
    const res = await POST(request({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid CUI format", async () => {
    vi.mocked(isValidCuiFormat).mockReturnValue(false);
    const res = await POST(request({ cui: "123" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("CUI");
  });

  it("returns 200 and normalized company when found", async () => {
    vi.mocked(fetchCompanyByCui).mockResolvedValue({
      cui: "123456",
      denumire: "SC Test SRL",
      adresa: "Str. Exemplu 1",
      nrRegCom: "J40/1",
      iban: "RO49XXXX",
      telefon: "0211234567",
    });
    const res = await POST(request({ cui: "123456" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      denumire: "SC Test SRL",
      adresa: "Str. Exemplu 1",
      nrRegCom: "J40/1",
      iban: "RO49XXXX",
      cui: "123456",
      telefon: "0211234567",
    });
  });

  it("returns 404 when CUI not found in ANAF", async () => {
    vi.mocked(fetchCompanyByCui).mockResolvedValue(null);
    const res = await POST(request({ cui: "999999" }));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.message).toContain("negăsit");
  });

  it("returns 502 when fetchCompanyByCui throws", async () => {
    vi.mocked(fetchCompanyByCui).mockRejectedValue(new Error("Network error"));
    const res = await POST(request({ cui: "123456" }));
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.message).toBeDefined();
  });

  it("accepts optional data in YYYY-MM-DD format", async () => {
    vi.mocked(fetchCompanyByCui).mockResolvedValue({
      cui: "123456",
      denumire: "SC Test",
      adresa: "",
      nrRegCom: "",
    });
    const res = await POST(
      request({ cui: "123456", data: "2024-01-15" })
    );
    expect(res.status).toBe(200);
    expect(fetchCompanyByCui).toHaveBeenCalledWith("123456", "2024-01-15");
  });
});
