import { internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { stripe } from "./stripe";
import { STRIPE_SECRET_KEY } from "./env";
import { CURRENCIES, INTERVALS, PLANS } from "./schema";
import { internal } from "./_generated/api";
import type { Currency } from "./schema";
import type { Interval } from "./schema";
import type { PlanKey } from "./schema";

const seedProducts = [
  {
    key: PLANS.FREE,
    name: "Gratuit",
    description: "Plan de bază, upgrade oricând.",
    prices: {
      [INTERVALS.MONTH]: {
        [CURRENCIES.USD]: 0,
        [CURRENCIES.EUR]: 0,
      },
      [INTERVALS.YEAR]: {
        [CURRENCIES.USD]: 0,
        [CURRENCIES.EUR]: 0,
      },
    },
  },
  {
    key: PLANS.PRO,
    name: "Pro",
    description: "Acces la toate funcționalitățile.",
    prices: {
      [INTERVALS.MONTH]: {
        [CURRENCIES.USD]: 1990,
        [CURRENCIES.EUR]: 1990,
      },
      [INTERVALS.YEAR]: {
        [CURRENCIES.USD]: 19990,
        [CURRENCIES.EUR]: 19990,
      },
    },
  },
];

export const insertSeedPlan = internalMutation({
  args: {
    stripeId: v.string(),
    key: v.union(v.literal("free"), v.literal("pro")),
    name: v.string(),
    description: v.string(),
    prices: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("plans", {
      stripeId: args.stripeId,
      key: args.key,
      name: args.name,
      description: args.description,
      prices: args.prices,
    });
  },
});

export default internalAction(async (ctx) => {
  if (!STRIPE_SECRET_KEY) {
    console.info("Stripe: STRIPE_SECRET_KEY nu este setat, omitem init.");
    return;
  }

  const products = await stripe.products.list({ limit: 1 });
  if (products?.data?.length) {
    console.info("Stripe: Produse existente, omitem crearea.");
    return;
  }

  for (const product of seedProducts) {
    const stripeProduct = await stripe.products.create({
      name: product.name,
      description: product.description,
    });

    const pricesByInterval = Object.entries(product.prices).flatMap(
      ([interval, price]) =>
        Object.entries(price).map(([currency, amount]) => ({
          interval,
          currency,
          amount,
        }))
    );

    const stripePrices = await Promise.all(
      pricesByInterval.map((price) =>
        stripe.prices.create({
          product: stripeProduct.id,
          currency: (price.currency as Currency) ?? "usd",
          unit_amount: price.amount ?? 0,
          tax_behavior: "inclusive",
          recurring: {
            interval: (price.interval as Interval) ?? "month",
          },
        })
      )
    );

    const getPrice = (currency: Currency, interval: Interval) => {
      const p = stripePrices.find(
        (price) =>
          price.currency === currency && price.recurring?.interval === interval
      );
      if (!p) throw new Error("Stripe: preț negăsit");
      return { stripeId: p.id, amount: p.unit_amount || 0 };
    };

    await ctx.runMutation(internal.init.insertSeedPlan, {
      stripeId: stripeProduct.id,
      key: product.key as PlanKey,
      name: product.name,
      description: product.description,
      prices: {
        [INTERVALS.MONTH]: {
          [CURRENCIES.USD]: getPrice(CURRENCIES.USD, INTERVALS.MONTH),
          [CURRENCIES.EUR]: getPrice(CURRENCIES.EUR, INTERVALS.MONTH),
        },
        [INTERVALS.YEAR]: {
          [CURRENCIES.USD]: getPrice(CURRENCIES.USD, INTERVALS.YEAR),
          [CURRENCIES.EUR]: getPrice(CURRENCIES.EUR, INTERVALS.YEAR),
        },
      },
    });
  }

  console.info("Stripe: Produse create cu succes.");
});
