import { describe, it, expect } from "vitest";
import {
  applyStudentGuardianSingleFieldToPayload,
  coalesceFromCompositeName,
  expandPlaceholderToInputVariableKeys,
  mergeCoalesceCompositePlaceholders,
  studentGuardianCompositeKind,
} from "./template-coalesce";

describe("expandPlaceholderToInputVariableKeys", () => {
  it("splits on pipe or returns single key", () => {
    expect(expandPlaceholderToInputVariableKeys("x")).toEqual(["x"]);
    expect(expandPlaceholderToInputVariableKeys("a | b")).toEqual(["a", "b"]);
    expect(expandPlaceholderToInputVariableKeys(" a | b ")).toEqual(["a", "b"]);
  });
});

describe("coalesceFromCompositeName", () => {
  it("returns first non-empty part for generic keys", () => {
    expect(coalesceFromCompositeName("a | b", { a: "x", b: "y" })).toBe("x");
    expect(coalesceFromCompositeName("a | b", { a: "", b: "y" })).toBe("y");
  });

  it("name: no guardian flag prefers student then guardian", () => {
    expect(
      coalesceFromCompositeName("studentFullName | guardianFullName", {
        studentFullName: "Ana",
        guardianFullName: "Ion",
      })
    ).toBe("Ana");
    expect(
      coalesceFromCompositeName("guardianFullName | studentFullName", {
        studentFullName: "Ana",
        guardianFullName: "Ion",
      })
    ).toBe("Ana");
    expect(
      coalesceFromCompositeName("studentFullName | guardianFullName", {
        hasGuardian: "false",
        studentFullName: "",
        guardianFullName: "Ion",
      })
    ).toBe("Ion");
  });

  it("name: hasGuardian true prefers guardian then student", () => {
    expect(
      coalesceFromCompositeName("studentFullName | guardianFullName", {
        hasGuardian: "true",
        studentFullName: "Ana",
        guardianFullName: "Ion",
      })
    ).toBe("Ion");
    expect(
      coalesceFromCompositeName("guardianFullName | studentFullName", {
        hasGuardian: "true",
        studentFullName: "Ana",
        guardianFullName: "Ion",
      })
    ).toBe("Ion");
    expect(
      coalesceFromCompositeName("studentFullName | guardianFullName", {
        hasGuardian: "true",
        studentFullName: "Ana",
        guardianFullName: "",
      })
    ).toBe("Ana");
  });

  it("address: no guardian flag prefers student then guardian", () => {
    expect(
      coalesceFromCompositeName("studentAddress | guardianAddress", {
        studentAddress: "Str. Elev",
        guardianAddress: "Str. Tutore",
      })
    ).toBe("Str. Elev");
  });

  it("address: hasGuardian true prefers guardian then student", () => {
    expect(
      coalesceFromCompositeName("studentAddress | guardianAddress", {
        hasGuardian: "true",
        studentAddress: "Str. Elev",
        guardianAddress: "Str. Tutore",
      })
    ).toBe("Str. Tutore");
    expect(
      coalesceFromCompositeName("guardianAddress | studentAddress", {
        hasGuardian: "true",
        studentAddress: "Str. Elev",
        guardianAddress: "Str. Tutore",
      })
    ).toBe("Str. Tutore");
  });

  it("address: hasGuardian false keeps student first", () => {
    expect(
      coalesceFromCompositeName("studentAddress | guardianAddress", {
        hasGuardian: "false",
        studentAddress: "Str. Elev",
        guardianAddress: "Str. Tutore",
      })
    ).toBe("Str. Elev");
  });

  it("handles whitespace-only studentAddress", () => {
    expect(
      coalesceFromCompositeName("studentAddress | guardianAddress", {
        studentAddress: "  ",
        guardianAddress: "Str. X",
      })
    ).toBe("Str. X");
  });

  it("returns empty when all empty", () => {
    expect(coalesceFromCompositeName("a | b", { a: "", b: "" })).toBe("");
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

  it("uses contextForCoalesce hasGuardian without polluting output keys", () => {
    const out = mergeCoalesceCompositePlaceholders(
      {
        studentAddress: "S1",
        guardianAddress: "G1",
      },
      ["studentAddress | guardianAddress"],
      { hasGuardian: "true" }
    );
    expect(out["studentAddress | guardianAddress"]).toBe("G1");
    expect(out.hasGuardian).toBeUndefined();
  });
});

describe("studentGuardianCompositeKind", () => {
  it("detects name and address pairs regardless of pipe order", () => {
    expect(studentGuardianCompositeKind("studentFullName | guardianFullName")).toBe("name");
    expect(studentGuardianCompositeKind("guardianFullName | studentFullName")).toBe("name");
    expect(studentGuardianCompositeKind("studentAddress | guardianAddress")).toBe("address");
    expect(studentGuardianCompositeKind("x | y")).toBeNull();
    expect(studentGuardianCompositeKind("studentFullName")).toBeNull();
  });
});

describe("applyStudentGuardianSingleFieldToPayload", () => {
  it("writes single field value to student or guardian atoms", () => {
    const names = ["studentFullName | guardianFullName"] as const;
    const noG = applyStudentGuardianSingleFieldToPayload(
      { "studentFullName | guardianFullName": "Unu" },
      names,
      { hasGuardian: "false" }
    );
    expect(noG.studentFullName).toBe("Unu");
    expect(noG.guardianFullName).toBe("");
    const yesG = applyStudentGuardianSingleFieldToPayload(
      { "studentFullName | guardianFullName": "Doi" },
      names,
      { hasGuardian: "true" }
    );
    expect(yesG.studentFullName).toBe("");
    expect(yesG.guardianFullName).toBe("Doi");
  });
});
