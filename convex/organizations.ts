import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const orgRole = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member")
);

const inviteRole = v.union(v.literal("admin"), v.literal("member"));

export async function getActiveOrgId(
  ctx: QueryCtx
): Promise<Id<"organizations"> | null> {
  const userId = await auth.getUserId(ctx);
  if (!userId) return null;
  const member = await ctx.db
    .query("members")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  return member?.orgId ?? null;
}

export const getActiveOrgIdQuery = query({
  args: {},
  handler: async (ctx) => getActiveOrgId(ctx),
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    const memberships = await ctx.db
      .query("members")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const orgs = await Promise.all(
      memberships.map((m) => ctx.db.get(m.orgId))
    );
    return orgs.filter(Boolean);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Neautentificat");

    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) throw new Error("Slug-ul există deja");

    const now = Date.now();
    const orgId = await ctx.db.insert("organizations", {
      name: args.name,
      slug: args.slug,
      ownerId: userId,
      createdAt: now,
    });
    await ctx.db.insert("members", {
      orgId,
      userId,
      role: "owner",
      joinedAt: now,
    });
    return orgId;
  },
});

export const get = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;
    const member = await ctx.db
      .query("members")
      .withIndex("by_orgId_userId", (q) =>
        q.eq("orgId", args.orgId).eq("userId", userId)
      )
      .unique();
    if (!member) return null;
    return ctx.db.get(args.orgId);
  },
});

export const getMembers = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    const member = await ctx.db
      .query("members")
      .withIndex("by_orgId_userId", (q) =>
        q.eq("orgId", args.orgId).eq("userId", userId)
      )
      .unique();
    if (!member) return [];
    const members = await ctx.db
      .query("members")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .collect();
    const users = await Promise.all(members.map((m) => ctx.db.get(m.userId)));
    return members.map((m, i) => ({
      ...m,
      user: users[i],
    }));
  },
});

export const invite = mutation({
  args: {
    orgId: v.id("organizations"),
    email: v.string(),
    role: inviteRole,
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Neautentificat");

    const member = await ctx.db
      .query("members")
      .withIndex("by_orgId_userId", (q) =>
        q.eq("orgId", args.orgId).eq("userId", userId)
      )
      .unique();
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      throw new Error("Fără permisiune");
    }

    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 48 * 60 * 60 * 1000;
    await ctx.db.insert("invitations", {
      orgId: args.orgId,
      email: args.email.toLowerCase(),
      role: args.role,
      invitedBy: userId,
      token,
      expiresAt,
    });
    const org = await ctx.db.get(args.orgId);
    if (org) {
      await ctx.scheduler.runAfter(0, internal.email.sendOrgInvite.sendOrgInvite, {
        email: args.email.toLowerCase(),
        orgName: org.name,
        token,
      });
    }
    return token;
  },
});

export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Neautentificat");

    const invite = await ctx.db
      .query("invitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!invite || invite.acceptedAt) throw new Error("Invitație invalidă");
    if (invite.expiresAt < Date.now()) throw new Error("Invitație expirată");

    const existing = await ctx.db
      .query("members")
      .withIndex("by_orgId_userId", (q) =>
        q.eq("orgId", invite.orgId).eq("userId", userId)
      )
      .unique();
    if (existing) throw new Error("Ești deja membru");

    await ctx.db.insert("members", {
      orgId: invite.orgId,
      userId,
      role: invite.role,
      joinedAt: Date.now(),
    });
    await ctx.db.patch(invite._id, { acceptedAt: Date.now() });
    return invite.orgId;
  },
});

export const removeMember = mutation({
  args: {
    orgId: v.id("organizations"),
    memberUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Neautentificat");

    const actor = await ctx.db
      .query("members")
      .withIndex("by_orgId_userId", (q) =>
        q.eq("orgId", args.orgId).eq("userId", userId)
      )
      .unique();
    if (!actor || (actor.role !== "owner" && actor.role !== "admin")) {
      throw new Error("Fără permisiune");
    }

    const target = await ctx.db
      .query("members")
      .withIndex("by_orgId_userId", (q) =>
        q.eq("orgId", args.orgId).eq("userId", args.memberUserId)
      )
      .unique();
    if (!target) throw new Error("Membru negăsit");
    if (target.role === "owner") throw new Error("Nu poți elimina owner-ul");

    await ctx.db.delete(target._id);
  },
});

export const updateRole = mutation({
  args: {
    orgId: v.id("organizations"),
    memberUserId: v.id("users"),
    role: orgRole,
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Neautentificat");

    const actor = await ctx.db
      .query("members")
      .withIndex("by_orgId_userId", (q) =>
        q.eq("orgId", args.orgId).eq("userId", userId)
      )
      .unique();
    if (!actor || actor.role !== "owner") throw new Error("Fără permisiune");

    const target = await ctx.db
      .query("members")
      .withIndex("by_orgId_userId", (q) =>
        q.eq("orgId", args.orgId).eq("userId", args.memberUserId)
      )
      .unique();
    if (!target) throw new Error("Membru negăsit");
    if (target.role === "owner") throw new Error("Nu poți modifica owner-ul");

    await ctx.db.patch(target._id, { role: args.role });
  },
});

export const getInvitations = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];
    const member = await ctx.db
      .query("members")
      .withIndex("by_orgId_userId", (q) =>
        q.eq("orgId", args.orgId).eq("userId", userId)
      )
      .unique();
    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return [];
    }
    return ctx.db
      .query("invitations")
      .withIndex("by_orgId", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.eq(q.field("acceptedAt"), undefined))
      .collect();
  },
});
