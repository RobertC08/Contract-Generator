import { describe, it, expect } from "vitest";
import { createHash } from "crypto";

describe("integration API key hashing", () => {
  it("matches Convex mutation (Web Crypto SHA-256 hex)", async () => {
    const raw = "cgk_" + "ab".repeat(32);
    const nodeHex = createHash("sha256").update(raw).digest("hex");
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    const subtleHex = Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(nodeHex).toBe(subtleHex);
    expect(nodeHex.length).toBe(64);
  });
});
