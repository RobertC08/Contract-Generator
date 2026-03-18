import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useAction } from "convex/react";
import { api } from "@cvx/_generated/api";
import { CURRENCIES, PLANS } from "@cvx/schema";
import { Button } from "@/ui/button";

export const Route = createFileRoute("/_app/_auth/panou/_layout/setari/abonament")({
  component: SetariAbonamentPage,
});

function SetariAbonamentPage() {
  const user = useQuery(api.app.getCurrentUser, {});
  const plans = useQuery(api.app.getActivePlans, {});
  const createCustomerPortal = useAction(api.stripe.createCustomerPortal);

  const handleManageSubscription = async () => {
    if (!user?._id || !user?.customerId) return;
    const url = await createCustomerPortal({ userId: user._id });
    if (url) window.location.href = url;
  };

  if (!user || !plans) return null;

  const planKey = user.subscription?.planKey ?? PLANS.FREE;
  const planName = planKey === PLANS.PRO ? "Pro" : "Gratuit";

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">Plan curent</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Ești pe planul <span className="font-medium text-stone-700 dark:text-stone-300">{planName}</span>.
          </p>
        </div>
        {user.subscription && user.subscription.planId !== plans.free._id && (
          <div className="border-t border-stone-200 dark:border-stone-800 p-6">
            <p className="text-sm text-stone-600 dark:text-stone-400">
              {user.subscription.cancelAtPeriodEnd ? "Expiră" : "Se reînnoiește"} pe{" "}
              {new Date(user.subscription.currentPeriodEnd * 1000).toLocaleDateString("ro-RO")}.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">Gestionează abonamentul</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Actualizează metoda de plată, adresa de facturare și altele.
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-stone-200 dark:border-stone-800 p-6">
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Vei fi redirecționat către Stripe Customer Portal.
          </p>
          <Button
            onClick={handleManageSubscription}
            disabled={!user.customerId}
          >
            Gestionează
          </Button>
        </div>
      </div>

      {plans.pro && (
        <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">{plans.pro.name}</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{plans.pro.description}</p>
          <p className="mt-2 text-sm font-medium text-stone-700 dark:text-stone-300">
            {CURRENCIES.USD === "usd" ? "$" : "€"}{" "}
            {(plans.pro.prices.month[CURRENCIES.USD as keyof typeof plans.pro.prices.month]?.amount ?? 0) / 100} / lună
          </p>
        </div>
      )}
    </div>
  );
}
