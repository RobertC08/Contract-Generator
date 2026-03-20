import { describe, expect, it } from "vitest";
import { resolveClientFacingBaseUrl } from "./clientFacingBaseUrl";

describe("resolveClientFacingBaseUrl", () => {
  it("prefers PUBLIC_APP_URL over SITE_URL", () => {
    expect(
      resolveClientFacingBaseUrl("https://app.vercel.app/", "http://localhost:5173")
    ).toBe("https://app.vercel.app");
  });

  it("falls back to SITE_URL", () => {
    expect(resolveClientFacingBaseUrl(undefined, "http://localhost:5173")).toBe(
      "http://localhost:5173"
    );
  });

  it("strips trailing slash", () => {
    expect(resolveClientFacingBaseUrl("https://x.com/", null)).toBe("https://x.com");
  });

  it("returns empty when both missing", () => {
    expect(resolveClientFacingBaseUrl(undefined, undefined)).toBe("");
  });

  it("trims whitespace", () => {
    expect(resolveClientFacingBaseUrl("  https://a.com  ", undefined)).toBe("https://a.com");
  });
});
