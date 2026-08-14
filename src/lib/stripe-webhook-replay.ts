import type { createAdminClient } from "@/utils/supabase/admin";

export type StripeWebhookAdminClient = ReturnType<typeof createAdminClient>;

/** Result of claiming a Stripe webhook event for processing. */
export type StripeWebhookClaimResult = "claimed" | "replay" | "duplicate";

/**
 * When insert hits a duplicate key, decide whether to replay (handler never finished)
 * or return duplicate (already processed successfully).
 */
export function resolveWebhookClaimFromDuplicate(
  processedAt: string | null | undefined,
): "replay" | "duplicate" {
  return processedAt == null ? "replay" : "duplicate";
}

/**
 * Insert a webhook event row with processed_at null, or resolve a duplicate for replay.
 * Throws on unexpected database errors.
 */
export async function claimStripeWebhookEvent(
  admin: StripeWebhookAdminClient,
  eventId: string,
  eventType: string,
): Promise<StripeWebhookClaimResult> {
  const { data: inserted, error: insertErr } = await admin
    .from("stripe_webhook_events")
    .insert({
      event_id: eventId,
      event_type: eventType,
      processed_at: null,
    })
    .select("event_id")
    .maybeSingle();

  if (!insertErr) {
    return inserted ? "claimed" : "claimed";
  }

  if (insertErr.code !== "23505") {
    throw insertErr;
  }

  const { data: existing, error: fetchErr } = await admin
    .from("stripe_webhook_events")
    .select("processed_at")
    .eq("event_id", eventId)
    .maybeSingle();

  if (fetchErr) {
    throw fetchErr;
  }

  return resolveWebhookClaimFromDuplicate(existing?.processed_at);
}

/** Mark a webhook event as successfully processed (allows future duplicates to short-circuit). */
export async function markStripeWebhookEventProcessed(
  admin: StripeWebhookAdminClient,
  eventId: string,
): Promise<void> {
  const { error } = await admin
    .from("stripe_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_id", eventId);

  if (error) {
    throw error;
  }
}
