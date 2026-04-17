import "server-only";

import Stripe from "stripe";

import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Nightly job that forwards finished AI-call minutes from `usage_records` to
 * Stripe Billing as meter events on the `cliste_call_minute` meter.
 *
 * Why a single meter + `stripe_customer_id` mapping:
 *   Stripe meter events are addressed per-customer. We don't care which plan
 *   the customer is on — Stripe picks the overage price from their active
 *   subscription item. Minutes that fall within the included-quota never
 *   bill (Stripe's tier-aware pricing rules make that trivial) but we still
 *   send them so the Billing Portal usage UI is accurate.
 *
 * Idempotency:
 *   Each `usage_records` row holds its own Stripe meter-event `identifier`
 *   (set on first send). The table's `synced_to_stripe_at` column moves to
 *   now() once Stripe confirms. Re-runs skip anything with a non-null
 *   `synced_to_stripe_at`.
 */

const METER_EVENT_NAME = "cliste_call_minute";

type UnsyncedRow = {
  id: string;
  organization_id: string;
  ended_at: string | null;
  minutes_billable: number | null;
};

type OrgRow = {
  id: string;
  platform_customer_id: string | null;
  platform_subscription_id: string | null;
};

export type UsageSyncResult = {
  ok: true;
  rowsProcessed: number;
  rowsSkipped: number;
  rowsFailed: number;
  byOrganization: Record<
    string,
    { minutes: number; rows: number; skippedReason?: string }
  >;
};

export async function syncUsageToStripe(): Promise<UsageSyncResult> {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error(
      "STRIPE_SECRET_KEY not set — cannot sync usage records to Stripe.",
    );
  }
  const stripe = new Stripe(secret, { apiVersion: "2026-03-25.dahlia" });
  const admin = createAdminClient();

  // Pull a capped batch of finished-but-unsynced rows. 500/call keeps us well
  // below the Stripe meter-events rate limit even under churn spikes.
  const { data: rows, error } = await admin
    .from("usage_records")
    .select("id, organization_id, ended_at, minutes_billable")
    .not("ended_at", "is", null)
    .is("synced_to_stripe_at", null)
    .limit(500);
  if (error) {
    throw new Error(`Failed to query usage_records: ${error.message}`);
  }
  const batch = (rows ?? []) as UnsyncedRow[];
  const result: UsageSyncResult = {
    ok: true,
    rowsProcessed: 0,
    rowsSkipped: 0,
    rowsFailed: 0,
    byOrganization: {},
  };

  if (batch.length === 0) {
    return result;
  }

  const orgIds = [...new Set(batch.map((r) => r.organization_id))];
  const { data: orgs, error: orgErr } = await admin
    .from("organizations")
    .select("id, platform_customer_id, platform_subscription_id")
    .in("id", orgIds);
  if (orgErr) {
    throw new Error(`Failed to query organizations: ${orgErr.message}`);
  }
  const orgIndex = new Map<string, OrgRow>(
    (orgs ?? []).map((o) => [o.id as string, o as OrgRow]),
  );

  for (const row of batch) {
    const org = orgIndex.get(row.organization_id);
    const minutes =
      typeof row.minutes_billable === "number"
        ? Math.max(0, Math.round(row.minutes_billable))
        : 0;

    if (!org?.platform_customer_id) {
      result.rowsSkipped += 1;
      bumpOrgBucket(result, row.organization_id, minutes, "no_customer");
      // Mark as synced so we don't keep scanning these rows — once the org
      // attaches a platform_customer_id via webhook, new rows will sync.
      await admin
        .from("usage_records")
        .update({ synced_to_stripe_at: new Date().toISOString() })
        .eq("id", row.id);
      continue;
    }
    if (minutes === 0) {
      // Zero-minute calls still get a synced timestamp so they're not
      // re-scanned, but we skip the Stripe round-trip.
      await admin
        .from("usage_records")
        .update({ synced_to_stripe_at: new Date().toISOString() })
        .eq("id", row.id);
      result.rowsSkipped += 1;
      bumpOrgBucket(result, row.organization_id, 0, "zero_minutes");
      continue;
    }

    try {
      const event = await stripe.billing.meterEvents.create({
        event_name: METER_EVENT_NAME,
        identifier: `usage_${row.id}`,
        timestamp: Math.floor(
          new Date(row.ended_at ?? new Date().toISOString()).getTime() / 1000,
        ),
        payload: {
          stripe_customer_id: org.platform_customer_id,
          value: String(minutes),
        },
      });

      await admin
        .from("usage_records")
        .update({
          synced_to_stripe_at: new Date().toISOString(),
          stripe_usage_record_id: event.identifier ?? `usage_${row.id}`,
        })
        .eq("id", row.id);

      result.rowsProcessed += 1;
      bumpOrgBucket(result, row.organization_id, minutes);
    } catch (err) {
      result.rowsFailed += 1;
      console.error(
        `[usage-sync] meter event failed for usage ${row.id}`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return result;
}

function bumpOrgBucket(
  result: UsageSyncResult,
  orgId: string,
  minutes: number,
  skippedReason?: string,
): void {
  const existing = result.byOrganization[orgId] ?? { minutes: 0, rows: 0 };
  existing.minutes += minutes;
  existing.rows += 1;
  if (skippedReason) {
    existing.skippedReason = skippedReason;
  }
  result.byOrganization[orgId] = existing;
}
