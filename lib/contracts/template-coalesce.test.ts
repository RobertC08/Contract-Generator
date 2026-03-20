import { describe, it, expect } from "vitest";
import {
  coalesceFromCompositeName,
  mergeCoalesceCompositePlaceholders,
} from "./template-coalesce";

describe("coalesceFromCompositeName", () => {
  it("returns first non-empty part", () => {
    expect(
      coalesceFromCompositeName("studentFullName | guardianFullName", {
        studentFullName: "Ana",
        guardianFullName: "Ion",
      })
    ).toBe("Ana");
    expect(
      coalesceFromCompositeName("studentFullName | guardianFullName", {
        studentFullName: "",
        guardianFullName: "Ion",
      })
    ).toBe("Ion");
  });

  it("handles studentAddress | guardianAddress", () => {
    expect(
      coalesceFromCompositeName("studentAddress | guardianAddress", {
        studentAddress: "  ",
        guardianAddress: "Str. X",
      })
    ).toBe("Str. X");
  });

  it("returns empty when all empty", () => {
    expect(
      coalesceFromCompositeName("a | b", { a: "", b: "" })
    ).toBe("");
  });
});

describe("mergeCoalesceCompositePlaceholders", () => {
  it("only updates names that contain pipe", () => {
    const out = mergeCoalesceCompositePlaceholders(
      { studentFullName: "", guardianFullName: "G", x: "1" },
      ["studentFullName | guardianFullName", "x"]
    );
    expect(out["studentFullName | guardianFullName"]).toBe("G");
    expect(out.x).toBe("1");
  });
});
