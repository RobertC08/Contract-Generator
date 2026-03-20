import { describe, it, expect, vi, afterEach } from "vitest";
import {
  CONTRACT_DATE_FIELD_NAME,
  mergeDefaultContractDataField,
  todayIsoDateEuropeBucharest,
} from "./contract-data-defaults";

describe("mergeDefaultContractDataField", () => {
  afterEach(() => vi.useRealTimers());

  it("fills empty Data with Bucharest today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-10T10:00:00Z"));
    const out = mergeDefaultContractDataField({ [CONTRACT_DATE_FIELD_NAME]: "" });
    expect(out[CONTRACT_DATE_FIELD_NAME]).toBe(todayIsoDateEuropeBucharest(new Date("2025-06-10T10:00:00Z")));
    expect(String(out[CONTRACT_DATE_FIELD_NAME])).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("replaces docx undefined placeholder", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-05T12:00:00Z"));
    const out = mergeDefaultContractDataField({ [CONTRACT_DATE_FIELD_NAME]: "......" });
    expect(out[CONTRACT_DATE_FIELD_NAME]).not.toBe("......");
  });

  it("does not overwrite non-empty Data", () => {
    const out = mergeDefaultContractDataField({ [CONTRACT_DATE_FIELD_NAME]: "2024-01-01" });
    expect(out[CONTRACT_DATE_FIELD_NAME]).toBe("2024-01-01");
  });
});
