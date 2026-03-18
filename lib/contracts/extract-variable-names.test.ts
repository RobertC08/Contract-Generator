import { describe, it, expect } from "vitest";
import { extractVariableNamesFromText } from "./extract-variable-names";

describe("extractVariableNamesFromText", () => {
  it("extracts simple placeholders", () => {
    expect(extractVariableNamesFromText("Hello {clientName}, date: {dataContract}")).toEqual([
      "clientName",
      "dataContract",
    ]);
  });

  it("extracts dropdown name once, not full option text", () => {
    const text = "Clientul {#Consimțământ imagine# de acord}{@exprimă acordul} / {#Consimțământ imagine# nu sunt de acord} {@nu îşi exprimă acordul}";
    expect(extractVariableNamesFromText(text)).toEqual([
      "Consimțământ imagine",
      "exprimă acordul",
      "nu îşi exprimă acordul",
    ]);
  });

  it("extracts sibling name without @ prefix", () => {
    expect(extractVariableNamesFromText("Option: {@pret}")).toEqual(["pret"]);
  });

  it("extracts image placeholder name", () => {
    expect(extractVariableNamesFromText("Sign: {%signature}")).toEqual(["signature"]);
  });

  it("preserves order of first appearance", () => {
    const text = "{b} and {#x# A} and {@b} and {a}";
    expect(extractVariableNamesFromText(text)).toEqual(["b", "x", "a"]);
  });

  it("keeps full placeholder label with colon and parentheses", () => {
    expect(
      extractVariableNamesFromText("{Eliberat de: } text {Perioada contract (in zile)}")
    ).toEqual(["Eliberat de:", "Perioada contract (in zile)"]);
  });
});
