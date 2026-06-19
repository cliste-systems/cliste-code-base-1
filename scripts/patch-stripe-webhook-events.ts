/**
 * Add setup_intent.succeeded to the platform Stripe webhook endpoint.
 *
 * Usage:
 *   npx tsx scripts/patch-stripe-webhook-events.ts
 *
 * Requires STRIPE_SECRET_KEY (from .env.local or env).
 */
import Stripe from "stripe";

const WEBHOOK_PATH = "/api/stripe/webhook";
const REQUIRED_EVENT = "setup_intent.succeeded";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    console.error("STRIPE_SECRET_KEY is not set.");
    process.exit(1);
  }

  const stripe = new Stripe(key);
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const target = endpoints.data.find((ep) => ep.url.includes(WEBHOOK_PATH));

  if (!target) {
    console.error(`No webhook endpoint found for path ${WEBHOOK_PATH}.`);
    process.exit(1);
  }

  if (
    target.enabled_events.includes("*") ||
    target.enabled_events.includes(REQUIRED_EVENT)
  ) {
    console.log(
      `OK   ${target.id} already listens for ${REQUIRED_EVENT} (${target.url})`,
    );
    return;
  }

  const enabledEvents = [
    ...target.enabled_events,
    REQUIRED_EVENT,
  ].sort() as Stripe.WebhookEndpointUpdateParams["enabled_events"];
  const updated = await stripe.webhookEndpoints.update(target.id, {
    enabled_events: enabledEvents,
  });

  console.log(
    `OK   ${updated.id} updated — added ${REQUIRED_EVENT} (${updated.url})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
