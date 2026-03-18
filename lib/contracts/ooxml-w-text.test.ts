import { describe, it, expect } from "vitest";
import { concatenateOoxmlWTextRuns } from "./ooxml-w-text";

describe("concatenateOoxmlWTextRuns", () => {
  it("merges placeholder split across w:t runs", () => {
    const xml = `<w:r><w:t>{localit</w:t></w:r><w:r><w:t xml:space="preserve">atea}</w:t></w:r>`;
    expect(concatenateOoxmlWTextRuns(xml)).toBe("{localitatea}");
  });

  it("decodes basic entities", () => {
    expect(concatenateOoxmlWTextRuns(`<w:t>a &amp; b</w:t>`)).toBe("a & b");
  });

  it("returns empty when no w:t", () => {
    expect(concatenateOoxmlWTextRuns("<w:document></w:document>")).toBe("");
  });
});
