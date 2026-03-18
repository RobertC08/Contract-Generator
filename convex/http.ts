import { httpRouter } from "convex/server";
import { registerIntegrationHttpApi } from "./integration/httpIntegration";
import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { auth } from "./auth";
import { stripe } from "./stripe";
import { STRIPE_WEBHOOK_SECRET } from "./env";
import { ERRORS } from "../errors";
import { internal } from "./_generated/api";
import { Currency, Interval, PLANS } from "./schema";
import {
  sendSubscriptionSuccessEmail,
  sendSubscriptionErrorEmail,
} from "./email/templates/subscriptionEmail";
import type { Doc } from "./_generated/dataModel";
import Stripe from "stripe";
import { z } from "zod";

const http = httpRouter();

async function getStripeEvent(request: Request) {
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error(`Stripe - ${ERRORS.ENVS_NOT_INITIALIZED}`);
  }
  const signature = request.headers.get("Stripe-Signature");
  if (!signature) throw new Error(ERRORS.STRIPE_MISSING_SIGNATURE);
  const payload = await request.text();
  return stripe.webhooks.constructEventAsync(
    payload,
    signature,
    STRIPE_WEBHOOK_SECRET
  );
}

async function handleUpdateSubscription(
  ctx: ActionCtx,
  user: Doc<"users">,
  subscription: Stripe.Subscription
) {
  const item = subscription.items.data[0];
  await ctx.runMutation(internal.stripe.PREAUTH_replaceSubscription, {
    userId: user._id,
    subscriptionStripeId: subscription.id,
    input: {
      currency: subscription.items.data[0].price.currency as Currency,
      planStripeId: item.plan.product as string,
      priceStripeId: item.price.id,
      interval: item.plan.interval as Interval,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}

http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const event = await getStripeEvent(request);

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const { customer: customerId, subscription: subscriptionId } = z
            .object({ customer: z.string(), subscription: z.string() })
            .parse(session);

          const user = await ctx.runQuery(
            internal.stripe.PREAUTH_getUserByCustomerId,
            { customerId }
          );
          if (!user?.email) throw new Error(ERRORS.SOMETHING_WENT_WRONG);

          const freeSubId =
            user.subscription.planKey === PLANS.FREE
              ? user.subscription.stripeId
              : undefined;

          const subscription = await stripe.subscriptions.retrieve(
            subscriptionId
          );
          await handleUpdateSubscription(ctx, user, subscription);

          await sendSubscriptionSuccessEmail({
            email: user.email,
            subscriptionId,
          });

          const subs = (
            await stripe.subscriptions.list({ customer: customerId })
          ).data;
          if (subs.length > 1 && freeSubId) {
            const freeSub = subs.find((s) => s.id === freeSubId);
            if (freeSub) await stripe.subscriptions.cancel(freeSub.id);
          }
          return new Response(null);
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object;
          const { customer: customerId } = z
            .object({ customer: z.string() })
            .parse(subscription);

          const user = await ctx.runQuery(
            internal.stripe.PREAUTH_getUserByCustomerId,
            { customerId }
          );
          if (!user) throw new Error(ERRORS.SOMETHING_WENT_WRONG);
          await handleUpdateSubscription(ctx, user, subscription);
          return new Response(null);
        }

        case "customer.subscription.deleted": {
          await ctx.runMutation(internal.stripe.PREAUTH_deleteSubscription, {
            subscriptionStripeId: event.data.object.id,
          });
          return new Response(null);
        }
      }
    } catch (err) {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const { customer: customerId, subscription: subscriptionId } = z
          .object({ customer: z.string(), subscription: z.string() })
          .parse(session);
        const user = await ctx.runQuery(
          internal.stripe.PREAUTH_getUserByCustomerId,
          { customerId }
        );
        if (user?.email) {
          await sendSubscriptionErrorEmail({
            email: user.email,
            subscriptionId,
          });
        }
        return new Response(null);
      }
      if (event.type === "customer.subscription.updated") {
        const subscription = event.data.object;
        const { customer: customerId } = z
          .object({ customer: z.string() })
          .parse(subscription);
        const user = await ctx.runQuery(
          internal.stripe.PREAUTH_getUserByCustomerId,
          { customerId }
        );
        if (user?.email) {
          await sendSubscriptionErrorEmail({
            email: user.email,
            subscriptionId: subscription.id,
          });
        }
        return new Response(null);
      }
      throw err;
    }

    return new Response(null);
  }),
});

auth.addHttpRoutes(http);

registerIntegrationHttpApi(http);

export default http;
