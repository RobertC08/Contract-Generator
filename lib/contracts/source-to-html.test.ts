import { describe, it, expect } from "vitest";
import { sourceToHtml, htmlToSource, isHtmlContent } from "./source-to-html";

describe("sourceToHtml", () => {
  it("wraps plain text in HTML with paragraphs", () => {
    const out = sourceToHtml("Line one\n\nLine two");
    expect(out).toContain("<body>");
    expect(out).toContain("<p>Line one</p>");
    expect(out).toContain("<p>Line two</p>");
  });

  it("preserves {{variables}} in output", () => {
    const out = sourceToHtml("Nr. {{contractNr}}");
    expect(out).toContain("{{contractNr}}");
  });

  it("escapes HTML in text", () => {
    const out = sourceToHtml("a <b> c");
    expect(out).toContain("&lt;b&gt;");
  });
});

describe("htmlToSource", () => {
  it("extracts body text and converts to plain text", () => {
    const html = "<body><p>Hello</p><p>World</p></body>";
    expect(htmlToSource(html)).toContain("Hello");
    expect(htmlToSource(html)).toContain("World");
  });

  it("preserves {{variables}}", () => {
    const html = "<p>Nr. {{contractNr}}</p>";
    expect(htmlToSource(html)).toContain("{{contractNr}}");
  });
});

describe("isHtmlContent", () => {
  it("returns true for content starting with <", () => {
    expect(isHtmlContent("<!DOCTYPE html>")).toBe(true);
    expect(isHtmlContent("<p>")).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(isHtmlContent("CONTRACT")).toBe(false);
    expect(isHtmlContent("  \n{{var}}")).toBe(false);
  });
});
