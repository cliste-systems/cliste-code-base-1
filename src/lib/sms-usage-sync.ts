import "server-only";

import Stripe from "stripe";

import { loadPlatformCustomerIdsForOrganizations } from "@/lib/account-billing";
import { captureObservedError } from "@/lib/observability";
import { createAdminClient } from "@/utils/supabase/admin";

const SMS_METER_EVENT_NAME = "cliste_sms";

type UnsyncedSmsRow = {
  id: string;
  organization_id: string;
  segments: number;
  sent_at: string;
};

type OrgRow = {
  id: string;
  platform_customer_id: string | null;
};

export type SmsUsageSyncResult = {
  ok: true;
  rowsProcessed: number;
  rowsSkipped: number;
  rowsFailed: number;
};

export async function syncSmsUsageToStripe(): Promise<SmsUsageSyncResult> {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error(
      "STRIPE_SECRET_KEY not set — cannot sync SMS usage records to Stripe.",
    );
  }

  const stripe = new Stripe(secret, { apiVersion: "2026-03-25.dahlia" });
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("sms_usage_records")
    .select("id, organization_id, segments, sent_at")
    .is("synced_to_stripe_at", null)
    .limit(500);

  if (error) {
    throw new Error(`Failed to query sms_usage_records: ${error.message}`);
  }

  const batch = (rows ?? []) as UnsyncedSmsRow[];
  const result: SmsUsageSyncResult = {
    ok: true,
    rowsProcessed: 0,
    rowsSkipped: 0,
    rowsFailed: 0,
  };

  if (batch.length === 0) return result;

  const orgIds = [...new Set(batch.map((r) => r.organization_id))];
  const customerByOrg = await loadPlatformCustomerIdsForOrganizations(orgIds);
  const orgIndex = new Map<string, OrgRow>();
  for (const orgId of orgIds) {
    orgIndex.set(orgId, {
      id: orgId,
      platform_customer_id: customerByOrg.get(orgId) ?? null,
    });
  }

  for (const row of batch) {
    const org = orgIndex.get(row.organization_id);
    const segments = Math.max(1, row.segments ?? 1);

    if (!org?.platform_customer_id) {
      result.rowsSkipped += 1;
      await admin
        .from("sms_usage_records")
        .update({ synced_to_stripe_at: new Date().toISOString() })
        .eq("id", row.id);
      continue;
    }

    try {
      const event = await stripe.billing.meterEvents.create({
        event_name: SMS_METER_EVENT_NAME,
        identifier: `sms_${row.id}`,
        timestamp: Math.floor(new Date(row.sent_at).getTime() / 1000),
        payload: {
          stripe_customer_id: org.platform_customer_id,
          value: String(segments),
        },
      });

      await admin
        .from("sms_usage_records")
        .update({
          synced_to_stripe_at: new Date().toISOString(),
          stripe_usage_record_id: event.identifier ?? `sms_${row.id}`,
        })
        .eq("id", row.id);

      result.rowsProcessed += 1;
    } catch (err) {
      result.rowsFailed += 1;
      console.error(
        `[sms-usage-sync] meter event failed for sms ${row.id}`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (result.rowsFailed > 0) {
    await captureObservedError(new Error("sms-usage-sync rows failed"), {
      rowsFailed: result.rowsFailed,
      rowsProcessed: result.rowsProcessed,
    });
  }

  return result;
}
