import { describe, expect, it } from "vitest";
import { buildSignedDocumentPreviewMeta } from "./signed-preview-meta";

describe("buildSignedDocumentPreviewMeta", () => {
  it("extracts contract numbers and signature data URLs", () => {
    const list = [
      { key: "nrContract", value: "7" },
      { key: "sig", value: "data:image/png;base64,abc" },
    ];
    const defs = [
      { name: "nrContract", type: "contractNumber", label: "Nr." },
      { name: "sig", type: "signature", label: "Semnătură" },
    ];
    const m = buildSignedDocumentPreviewMeta(list, defs);
    expect(m.contractNumbers).toEqual([{ name: "nrContract", label: "Nr.", value: "7" }]);
    expect(m.signatures).toEqual([
      { name: "sig", label: "Semnătură", dataUrl: "data:image/png;base64,abc" },
    ]);
  });

  it("uses name as label when missing", () => {
    const m = buildSignedDocumentPreviewMeta([{ key: "x", value: "1" }], [{ name: "x", type: "contractNumber" }]);
    expect(m.contractNumbers[0]?.label).toBe("x");
  });

  it("ignores non-data-url signature values", () => {
    const m = buildSignedDocumentPreviewMeta([{ key: "s", value: "" }], [{ name: "s", type: "signature" }]);
    expect(m.signatures).toEqual([]);
  });

  it("handles empty defs", () => {
    expect(buildSignedDocumentPreviewMeta([], [])).toEqual({ contractNumbers: [], signatures: [] });
  });
});
