import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { auth } from "./auth";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateRawKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return (
    "cgk_" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

async function requireOrgAdmin(ctx: QueryCtx | MutationCtx, orgId: Id<"organizations">) {
  const userId = await auth.getUserId(ctx);
  if (!userId) throw new Error("Neautentificat");
  const member = await ctx.db
    .query("members")
    .withIndex("by_orgId_userId", (q) => q.eq("orgId", orgId).eq("userId", userId))
    .unique();
  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    throw new Error("Fără permisiune");
  }
}

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOrgAdmin(ctx, args.orgId);
    const raw = generateRawKey();
    const keyHash = await sha256hex(raw);
    const existing = await ctx.db
      .query("integrationApiKeys")
      .withIndex("by_keyHash", (q) => q.eq("keyHash", keyHash))
      .first();
    if (existing) throw new Error("Reîncearcă");
    const now = Date.now();
    await ctx.db.insert("integrationApiKeys", {
      orgId: args.orgId,
      keyHash,
      keyPrefix: `${raw.slice(0, 12)}…`,
      name: args.name.trim() || "API key",
      createdAt: now,
    });
    return { rawKey: raw, message: "Copiază cheia acum — nu va mai fi afișată." };
  },
});

export const list = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrgAdmin(ctx, args.orgId);
    const keys = await ctx.db
      .query("integrationApiKeys")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();
    return keys
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((k) => ({
        id: k._id,
        keyPrefix: k.keyPrefix,
        name: k.name,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt,
        revokedAt: k.revokedAt,
      }));
  },
});

export const revoke = mutation({
  args: { keyId: v.id("integrationApiKeys") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.keyId);
    if (!row) throw new Error("Cheie negăsită");
    await requireOrgAdmin(ctx, row.orgId);
    if (row.revokedAt) throw new Error("Deja revocată");
    await ctx.db.patch(args.keyId, { revokedAt: Date.now() });
  },
});

export const getByKeyHash = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrationApiKeys")
      .withIndex("by_keyHash", (q) => q.eq("keyHash", args.keyHash))
      .first();
  },
});

export const markKeyUsed = internalMutation({
  args: { keyId: v.id("integrationApiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.keyId, { lastUsedAt: Date.now() });
  },
});
