import { describe, it, expect } from "vitest";
import {
  validateVariableDefinitions,
  variableDefinitionsSchema,
  variableDefinitionSchema,
} from "./variable-definitions";

describe("variableDefinitionSchema", () => {
  it("accepts valid text definition", () => {
    const result = variableDefinitionSchema.safeParse({ name: "clientName", type: "text" });
    expect(result.success).toBe(true);
  });

  it("accepts valid definition with label", () => {
    const result = variableDefinitionSchema.safeParse({
      name: "data_contract",
      type: "date",
      label: "Data contract",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid name (spaces)", () => {
    const result = variableDefinitionSchema.safeParse({ name: "client name", type: "text" });
    expect(result.success).toBe(false);
  });

  it("rejects CUI without linkedVariables", () => {
    const result = variableDefinitionSchema.safeParse({
      name: "prestatorCUI",
      type: "cui",
    });
    expect(result.success).toBe(false);
  });

  it("accepts CUI with linkedVariables", () => {
    const result = variableDefinitionSchema.safeParse({
      name: "prestatorCUI",
      type: "cui",
      linkedVariables: {
        denumire: "prestatorNume",
        sediu: "prestatorSediu",
        regCom: "prestatorRegCom",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects CUI with empty linked variable names", () => {
    const result = variableDefinitionSchema.safeParse({
      name: "prestatorCUI",
      type: "cui",
      linkedVariables: {
        denumire: "",
        sediu: "prestatorSediu",
        regCom: "prestatorRegCom",
      },
    });
    expect(result.success).toBe(false);
  });
});

describe("variableDefinitionsSchema", () => {
  it("rejects duplicate names", () => {
    const result = variableDefinitionsSchema.safeParse([
      { name: "a", type: "text" },
      { name: "a", type: "number" },
    ]);
    expect(result.success).toBe(false);
  });

  it("accepts unique names", () => {
    const result = variableDefinitionsSchema.safeParse([
      { name: "a", type: "text" },
      { name: "b", type: "number" },
    ]);
    expect(result.success).toBe(true);
  });
});

describe("validateVariableDefinitions", () => {
  it("returns success for valid array", () => {
    const result = validateVariableDefinitions([
      { name: "x", type: "text" },
      { name: "y", type: "date" },
    ]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
    }
  });

  it("returns success for empty array", () => {
    const result = validateVariableDefinitions([]);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual([]);
  });

  it("returns failure with message for CUI without linkedVariables", () => {
    const result = validateVariableDefinitions([
      { name: "cui1", type: "cui" },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain("CUI");
    }
  });

  it("returns failure with message for duplicate names", () => {
    const result = validateVariableDefinitions([
      { name: "a", type: "text" },
      { name: "a", type: "number" },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toMatch(/unic|unique/i);
    }
  });

  it("returns failure for null", () => {
    const result = validateVariableDefinitions(null);
    expect(result.success).toBe(false);
  });
});
