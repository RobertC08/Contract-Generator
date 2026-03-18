import { mutation, query } from "./_generated/server";
import { auth } from "./auth";
import { v } from "convex/values";
import { PLANS } from "./schema";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return undefined;
    const [user, subscription] = await Promise.all([
      ctx.db.get(userId),
      ctx.db
        .query("subscriptions")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .unique(),
    ]);
    if (!user) return undefined;
    const plan = subscription?.planId
      ? await ctx.db.get(subscription.planId)
      : undefined;
    const avatarUrl = user.imageId
      ? await ctx.storage.getUrl(user.imageId)
      : user.image;
    return {
      ...user,
      avatarUrl: avatarUrl || undefined,
      subscription:
        subscription && plan
          ? {
              ...subscription,
              planKey: plan.key,
            }
          : undefined,
    };
  },
});

export const getActivePlans = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return undefined;
    const free = await ctx.db
      .query("plans")
      .withIndex("key", (q) => q.eq("key", PLANS.FREE))
      .unique();
    const pro = await ctx.db
      .query("plans")
      .withIndex("key", (q) => q.eq("key", PLANS.PRO))
      .unique();
    if (!free || !pro) return undefined;
    return { free, pro };
  },
});

export const updateUsername = mutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return;
    await ctx.db.patch(userId, { username: args.username });
  },
});

export const completeOnboarding = mutation({
  args: {
    username: v.string(),
    orgName: v.string(),
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Neautentificat");

    await ctx.db.patch(userId, { username: args.username });

    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.orgSlug))
      .unique();
    if (existing) throw new Error("Slug-ul organizației există deja");

    const now = Date.now();
    const orgId = await ctx.db.insert("organizations", {
      name: args.orgName,
      slug: args.orgSlug,
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

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Utilizator negăsit");
    return await ctx.storage.generateUploadUrl();
  },
});

export const updateUserImage = mutation({
  args: { imageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return;
    await ctx.db.patch(userId, { imageId: args.imageId });
  },
});

export const removeUserImage = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return;
    await ctx.db.patch(userId, { imageId: undefined, image: undefined });
  },
});
