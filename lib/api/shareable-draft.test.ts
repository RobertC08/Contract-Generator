import { describe, it, expect } from "vitest";
import { validateShareableDraftInput } from "./shareable-draft";

describe("validateShareableDraftInput", () => {
  it("accepts empty body", () => {
    const r = validateShareableDraftInput({});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.metadata).toEqual({});
      expect(r.webhookUrl).toBeUndefined();
    }
  });

  it("accepts https webhook", () => {
    const r = validateShareableDraftInput({
      webhookUrl: "https://api.example.com/hooks/contract",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.webhookUrl).toBe("https://api.example.com/hooks/contract");
  });

  it("rejects http webhook", () => {
    const r = validateShareableDraftInput({ webhookUrl: "http://x.com/h" });
    expect(r.ok).toBe(false);
  });

  it("accepts flat metadata", () => {
    const r = validateShareableDraftInput({
      metadata: { studentId: "s1", schoolId: "sch2", n: 1 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.metadata).toEqual({ studentId: "s1", schoolId: "sch2", n: "1" });
  });

  it("rejects nested metadata", () => {
    const r = validateShareableDraftInput({
      metadata: { a: { b: 1 } },
    });
    expect(r.ok).toBe(false);
  });
});
