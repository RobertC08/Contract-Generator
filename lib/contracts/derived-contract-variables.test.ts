import { describe, it, expect } from "vitest";
import {
  computeContractDurationDays,
  mergeDerivedContractVariables,
  DERIVED_NO_INPUT_VAR_NAMES,
} from "./derived-contract-variables";

describe("computeContractDurationDays", () => {
  it("returns end minus start in whole days (not inclusive)", () => {
    expect(computeContractDurationDays("2025-01-01", "2025-01-01")).toBe("0");
    expect(computeContractDurationDays("2025-01-01", "2025-01-03")).toBe("2");
    expect(computeContractDurationDays("2025-01-01", "2026-01-01")).toBe("365");
  });

  it("accepts DD.MM.YYYY", () => {
    expect(computeContractDurationDays("01.01.2025", "03.01.2025")).toBe("2");
  });

  it("returns empty when end before start or missing", () => {
    expect(computeContractDurationDays("2025-02-01", "2025-01-01")).toBe("");
    expect(computeContractDurationDays("2025-01-01", "")).toBe("");
    expect(computeContractDurationDays("", "2025-01-01")).toBe("");
  });
});

describe("mergeDerivedContractVariables", () => {
  it("sets both canonical and Romanian label keys", () => {
    const m = mergeDerivedContractVariables({
      contractStartDate: "2025-06-01",
      contractEndDate: "2025-06-10",
    });
    expect(m.contractDurationDays).toBe("9");
    expect(m["Perioada contract (in zile)"]).toBe("9");
  });

  it("clears duration keys when dates insufficient", () => {
    const m = mergeDerivedContractVariables({ contractStartDate: "2025-06-01" });
    expect(m.contractDurationDays).toBe("");
    expect(m["Perioada contract (in zile)"]).toBe("");
  });
});

describe("DERIVED_NO_INPUT_VAR_NAMES", () => {
  it("includes known derived placeholders", () => {
    expect(DERIVED_NO_INPUT_VAR_NAMES).toContain("Data_final_un_an");
    expect(DERIVED_NO_INPUT_VAR_NAMES).toContain("contractDurationDays");
  });
});
