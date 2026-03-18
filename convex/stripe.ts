import Stripe from "stripe";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { ERRORS } from "../errors";
import { auth } from "./auth";
import { currencyValidator, intervalValidator, PLANS } from "./schema";
import { api, internal } from "./_generated/api";
import { SITE_URL, STRIPE_SECRET_KEY } from "./env";
import { asyncMap } from "convex-helpers";

export const stripe = new Stripe(STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
  typescript: true,
});

export const PREAUTH_updateCustomerId = internalMutation({
  args: {
    userId: v.id("users"),
    customerId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { customerId: args.customerId });
  },
});

export const PREAUTH_getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => ctx.db.get(args.userId),
});

export const PREAUTH_createStripeCustomer = internalAction({
  args: {
    currency: currencyValidator,
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.stripe.PREAUTH_getUserById, {
      userId: args.userId,
    });
    if (!user || user.customerId)
      throw new Error(ERRORS.STRIPE_CUSTOMER_NOT_CREATED);

    const customer = await stripe.customers
      .create({ email: user.email, name: user.username })
      .catch((err) => console.error(err));
    if (!customer) throw new Error(ERRORS.STRIPE_CUSTOMER_NOT_CREATED);

    await ctx.runAction(internal.stripe.PREAUTH_createFreeStripeSubscription, {
      userId: args.userId,
      customerId: customer.id,
      currency: args.currency,
    });
  },
});

export const UNAUTH_getDefaultPlan = internalQuery({
  handler: async (ctx) =>
    ctx.db
      .query("plans")
      .withIndex("key", (q) => q.eq("key", PLANS.FREE))
      .unique(),
});

export const getSubscriptionAndPlanForCheckout = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .unique();
    const currentPlan = subscription?.planId
      ? await ctx.db.get(subscription.planId)
      : null;
    return { subscription, currentPlan };
  },
});

export const getPlanById = internalQuery({
  args: { planId: v.id("plans") },
  handler: async (ctx, args) => ctx.db.get(args.planId),
});

export const PREAUTH_getUserByCustomerId = internalQuery({
  args: { customerId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("customerId", (q) => q.eq("customerId", args.customerId))
      .unique();
    if (!user) throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .unique();
    if (!subscription) throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    const plan = await ctx.db.get(subscription.planId);
    if (!plan) throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    return {
      ...user,
      subscription: { ...subscription, planKey: plan.key },
    };
  },
});

export const PREAUTH_createSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    planId: v.id("plans"),
    priceStripeId: v.string(),
    currency: currencyValidator,
    stripeSubscriptionId: v.string(),
    status: v.string(),
    interval: intervalValidator,
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) throw new Error("Abonament existent");
    await ctx.db.insert("subscriptions", {
      userId: args.userId,
      planId: args.planId,
      priceStripeId: args.priceStripeId,
      stripeId: args.stripeSubscriptionId,
      currency: args.currency,
      interval: args.interval,
      status: args.status,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
    });
  },
});

export const PREAUTH_replaceSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    subscriptionStripeId: v.string(),
    input: v.object({
      currency: currencyValidator,
      planStripeId: v.string(),
      priceStripeId: v.string(),
      interval: intervalValidator,
      status: v.string(),
      currentPeriodStart: v.number(),
      currentPeriodEnd: v.number(),
      cancelAtPeriodEnd: v.boolean(),
    }),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!subscription) throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    await ctx.db.delete(subscription._id);
    const plan = await ctx.db
      .query("plans")
      .withIndex("stripeId", (q) => q.eq("stripeId", args.input.planStripeId))
      .unique();
    if (!plan) throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    await ctx.db.insert("subscriptions", {
      userId: args.userId,
      planId: plan._id,
      stripeId: args.subscriptionStripeId,
      priceStripeId: args.input.priceStripeId,
      interval: args.input.interval,
      status: args.input.status,
      currency: args.input.currency,
      currentPeriodStart: args.input.currentPeriodStart,
      currentPeriodEnd: args.input.currentPeriodEnd,
      cancelAtPeriodEnd: args.input.cancelAtPeriodEnd,
    });
  },
});

export const PREAUTH_deleteSubscription = internalMutation({
  args: { subscriptionStripeId: v.string() },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("stripeId", (q) => q.eq("stripeId", args.subscriptionStripeId))
      .unique();
    if (!subscription) throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    await ctx.db.delete(subscription._id);
  },
});

export const PREAUTH_createFreeStripeSubscription = internalAction({
  args: {
    userId: v.id("users"),
    customerId: v.string(),
    currency: currencyValidator,
  },
  handler: async (ctx, args) => {
    const plan = await ctx.runQuery(internal.stripe.UNAUTH_getDefaultPlan);
    if (!plan) throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);

    const yearlyPrice = plan.prices.year[args.currency];
    const stripeSubscription = await stripe.subscriptions.create({
      customer: args.customerId,
      items: [{ price: yearlyPrice?.stripeId }],
    });
    if (!stripeSubscription)
      throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);

    await ctx.runMutation(internal.stripe.PREAUTH_createSubscription, {
      userId: args.userId,
      planId: plan._id,
      currency: args.currency,
      priceStripeId: stripeSubscription.items.data[0].price.id,
      stripeSubscriptionId: stripeSubscription.id,
      status: stripeSubscription.status,
      interval: "year",
      currentPeriodStart: stripeSubscription.current_period_start,
      currentPeriodEnd: stripeSubscription.current_period_end,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    });

    await ctx.runMutation(internal.stripe.PREAUTH_updateCustomerId, {
      userId: args.userId,
      customerId: args.customerId,
    });
  },
});

export const createSubscriptionCheckout = action({
  args: {
    userId: v.id("users"),
    planId: v.id("plans"),
    planInterval: intervalValidator,
    currency: currencyValidator,
  },
  handler: async (ctx, args): Promise<string | undefined> => {
    const user = await ctx.runQuery(api.app.getCurrentUser);
    if (!user || !user.customerId)
      throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);

    const { currentPlan } = await ctx.runQuery(
      internal.stripe.getSubscriptionAndPlanForCheckout,
      { userId: user._id }
    );
    if (currentPlan?.key !== PLANS.FREE) return undefined;

    const newPlan = await ctx.runQuery(
      internal.stripe.getPlanById,
      { planId: args.planId }
    );
    if (!newPlan) return undefined;
    const price = newPlan.prices[args.planInterval][args.currency];

    const checkout = await stripe.checkout.sessions.create({
      customer: user.customerId,
      line_items: [{ price: price?.stripeId, quantity: 1 }],
      mode: "subscription",
      payment_method_types: ["card"],
      success_url: `${SITE_URL}/panou/setari/abonament?success=1`,
      cancel_url: `${SITE_URL}/panou/setari/abonament`,
    });
    return checkout.url ?? undefined;
  },
});

export const createCustomerPortal = action({
  args: { userId: v.id("users") },
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return undefined;
    const user = await ctx.runQuery(api.app.getCurrentUser);
    if (!user || !user.customerId)
      throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);

    const portal = await stripe.billingPortal.sessions.create({
      customer: user.customerId,
      return_url: `${SITE_URL}/panou/setari/abonament`,
    });
    return portal.url;
  },
});

export const cancelCurrentUserSubscriptions = internalAction({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.runQuery(api.app.getCurrentUser);
    if (!user) throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    const subs = (
      await stripe.subscriptions.list({ customer: user.customerId! })
    ).data;
    await asyncMap(subs, async (sub) => {
      await stripe.subscriptions.cancel(sub.id);
    });
  },
});
