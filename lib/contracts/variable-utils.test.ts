import { describe, it, expect } from "vitest";
import {
  humanizeVariableName,
  getVariableDefinition,
  getVariableType,
  getVariableLabel,
  formatDateToDisplay,
  monthCodeToName,
  LUNI,
  MONTH_CODES,
} from "./variable-utils";
import type { VariableDefinition } from "./variable-definitions";

const defs: VariableDefinition[] = [
  { name: "prestatorCUI", type: "cui", linkedVariables: { denumire: "prestatorNume", sediu: "prestatorSediu", regCom: "prestatorRegCom" } },
  { name: "dataIntrareVigoare", type: "date" },
  { name: "lunaInceput", type: "month", label: "Luna început" },
];

describe("humanizeVariableName", () => {
  it("splits camelCase and capitalizes", () => {
    expect(humanizeVariableName("prestatorCUI")).toBe("Prestator Cui");
  });

  it("replaces underscores with spaces", () => {
    expect(humanizeVariableName("data_contract")).toBe("Data Contract");
  });

  it("returns single word capitalized", () => {
    expect(humanizeVariableName("contractNr")).toBe("Contract Nr");
  });
});

describe("getVariableDefinition", () => {
  it("returns definition when found", () => {
    expect(getVariableDefinition(defs, "prestatorCUI")).toEqual(defs[0]);
  });

  it("returns undefined when not found", () => {
    expect(getVariableDefinition(defs, "missing")).toBeUndefined();
  });

  it("returns undefined for null or empty defs", () => {
    expect(getVariableDefinition(null, "x")).toBeUndefined();
    expect(getVariableDefinition(undefined, "x")).toBeUndefined();
    expect(getVariableDefinition([], "x")).toBeUndefined();
  });
});

describe("getVariableType", () => {
  it("returns type from definition", () => {
    expect(getVariableType(defs, "prestatorCUI")).toBe("cui");
    expect(getVariableType(defs, "dataIntrareVigoare")).toBe("date");
    expect(getVariableType(defs, "lunaInceput")).toBe("month");
  });

  it("returns text for unknown variable", () => {
    expect(getVariableType(defs, "unknown")).toBe("text");
  });

  it("returns text when defs is null", () => {
    expect(getVariableType(null, "x")).toBe("text");
  });
});

describe("getVariableLabel", () => {
  it("returns label when set", () => {
    expect(getVariableLabel(defs[2], "lunaInceput")).toBe("Luna început");
  });

  it("returns humanized name when label not set", () => {
    expect(getVariableLabel(defs[0], "prestatorCUI")).toBe("Prestator Cui");
  });

  it("returns humanized name when def is undefined", () => {
    expect(getVariableLabel(undefined, "someVar")).toBe("Some Var");
  });
});

describe("formatDateToDisplay", () => {
  it("formats ISO date to dd.MM.yyyy", () => {
    expect(formatDateToDisplay("2025-02-10")).toBe("10.02.2025");
  });

  it("returns original for invalid or empty", () => {
    expect(formatDateToDisplay("")).toBe("");
    expect(formatDateToDisplay("not-a-date")).toBe("not-a-date");
    expect(formatDateToDisplay("10-02-2025")).toBe("10-02-2025");
  });
});

describe("monthCodeToName", () => {
  it("maps 01 to ianuarie", () => {
    expect(monthCodeToName("01")).toBe("ianuarie");
  });

  it("maps 12 to decembrie", () => {
    expect(monthCodeToName("12")).toBe("decembrie");
  });

  it("returns code when not found", () => {
    expect(monthCodeToName("99")).toBe("99");
  });

  it("matches LUNI and MONTH_CODES length", () => {
    expect(LUNI.length).toBe(12);
    expect(MONTH_CODES.length).toBe(12);
  });
});
