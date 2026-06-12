import "server-only";

import { locationAddonQuantity } from "@/lib/account-locations";
import { LOCATION_ADDON_STRIPE_KEY } from "@/lib/cliste-plans.data";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Updates the licensed location add-on quantity on the account subscription.
 * Quantity = active locations − 1 (first location is included in the plan).
 */
export async function syncAccountLocationAddonQuantity(
  accountId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = createAdminClient();
  const [{ data: account }, { count }] = await Promise.all([
    admin
      .from("accounts")
      .select("platform_subscription_id")
      .eq("id", accountId)
      .maybeSingle(),
    admin
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId),
  ]);

  const subscriptionId = account?.platform_subscription_id?.trim();
  if (!subscriptionId || subscriptionId === "dev_checkout_skipped") {
    return { ok: true };
  }

  const { data: priceRow } = await admin
    .from("stripe_platform_prices")
    .select("stripe_price_id")
    .eq("key", LOCATION_ADDON_STRIPE_KEY)
    .eq("active", true)
    .maybeSingle();

  const addonPriceId = priceRow?.stripe_price_id as string | undefined;
  if (!addonPriceId) {
    return {
      ok: false,
      message:
        "Location add-on price is not configured. Run npm run stripe:bootstrap.",
    };
  }

  const quantity = locationAddonQuantity(count ?? 1);
  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });

  const existingItem = subscription.items.data.find(
    (item) =>
      item.price.id === addonPriceId ||
      item.price.lookup_key === LOCATION_ADDON_STRIPE_KEY,
  );

  if (quantity === 0) {
    if (existingItem) {
      await stripe.subscriptionItems.del(existingItem.id);
    }
    return { ok: true };
  }

  if (existingItem) {
    await stripe.subscriptionItems.update(existingItem.id, { quantity });
    return { ok: true };
  }

  await stripe.subscriptionItems.create({
    subscription: subscriptionId,
    price: addonPriceId,
    quantity,
  });
  return { ok: true };
}
