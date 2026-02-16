import { describe, it, expect } from "vitest";
import { detectPlaceholderFields } from "./detect-placeholders";

describe("detectPlaceholderFields", () => {
  it("replaces dots and underscores with camp1, camp2, ...", () => {
    const content = "<p>Nr. ....... din ............</p>";
    const { content: out, newDefs } = detectPlaceholderFields(content, []);
    expect(out).toBe("<p>Nr. {{camp1}} din {{camp2}}</p>");
    expect(newDefs).toHaveLength(2);
    expect(newDefs[0]).toEqual({ name: "camp1", type: "text", label: "Camp 1" });
    expect(newDefs[1]).toEqual({ name: "camp2", type: "text", label: "Camp 2" });
  });

  it("replaces underscores", () => {
    const content = "Nume: ______";
    const { content: out, newDefs } = detectPlaceholderFields(content, []);
    expect(out).toBe("Nume: {{camp1}}");
    expect(newDefs).toHaveLength(1);
  });

  it("does not add duplicate defs for existing names", () => {
    const content = ".......";
    const existing = [{ name: "camp1", type: "text" as const }];
    const { content: out, newDefs } = detectPlaceholderFields(content, existing);
    expect(out).toBe("{{camp1}}");
    expect(newDefs).toHaveLength(0);
  });

  it("requires at least 2 consecutive dots or underscores", () => {
    const content = "a.b_c";
    const { content: out, newDefs } = detectPlaceholderFields(content, []);
    expect(out).toBe("a.b_c");
    expect(newDefs).toHaveLength(0);
  });

  it("merges adjacent runs separated only by whitespace into one variable", () => {
    const content = "....... ______";
    const { content: out, newDefs } = detectPlaceholderFields(content, []);
    expect(out).toBe("{{camp1}}");
    expect(newDefs).toHaveLength(1);
  });

  it("merges runs split by adjacent inline tags into one variable", () => {
    const content = "sediul...........</span><span>...........";
    const { content: out, newDefs } = detectPlaceholderFields(content, []);
    expect(out).toBe("sediul{{camp1}}");
    expect(newDefs).toHaveLength(1);
  });

  it("matches middle dot (·) as dot", () => {
    const content = "nr. ········";
    const { content: out, newDefs } = detectPlaceholderFields(content, []);
    expect(out).toBe("nr. {{camp1}}");
    expect(newDefs).toHaveLength(1);
  });

  it("treats trailing comma as part of one field and preserves it", () => {
    const content = "adresă............., telefon...............,";
    const { content: out, newDefs } = detectPlaceholderFields(content, []);
    expect(out).toBe("adresă{{camp1}}, telefon{{camp2}},");
    expect(newDefs).toHaveLength(2);
  });

  it("treats trailing comma as part of one field and preserves it", () => {
    const content = "telefon/fax……………..,";
    const { content: out, newDefs } = detectPlaceholderFields(content, []);
    expect(out).toBe("telefon/fax{{camp1}},");
    expect(newDefs).toHaveLength(1);
  });

  it("treats trailing period as part of one field and preserves it", () => {
    const content = "email ..............,";
    const { content: out, newDefs } = detectPlaceholderFields(content, []);
    expect(out).toBe("email {{camp1}},");
    expect(newDefs).toHaveLength(1);
  });
});