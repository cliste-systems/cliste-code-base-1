import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { PLANS, type PlanTier } from "@/lib/cliste-plans.data";

export type SmsQuotaStatus = {
  allowed: boolean;
  usedSegments: number;
  includedSms: number;
  remaining: number;
  reason?: string;
};

type AccountRow = {
  plan_tier: string | null;
  billing_period_start: string | null;
};

/**
 * Caller-facing SMS is gated on the account's included monthly SMS allowance.
 * Owner alerts use the platform sender and are not gated here.
 */
export async function getCallerSmsQuotaStatus(
  admin: SupabaseClient,
  organizationId: string,
): Promise<SmsQuotaStatus> {
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("account_id")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgErr || !org?.account_id) {
    return {
      allowed: false,
      usedSegments: 0,
      includedSms: 0,
      remaining: 0,
      reason: "organization_not_found",
    };
  }

  const accountId = org.account_id as string;

  const { data: account, error: accountErr } = await admin
    .from("accounts")
    .select("plan_tier, billing_period_start")
    .eq("id", accountId)
    .maybeSingle();

  if (accountErr || !account) {
    return {
      allowed: false,
      usedSegments: 0,
      includedSms: 0,
      remaining: 0,
      reason: "account_not_found",
    };
  }

  const tier = (account as AccountRow).plan_tier as PlanTier | null;
  const plan = tier && PLANS[tier] ? PLANS[tier] : null;
  const includedSms = plan?.includedSms ?? 0;

  const periodStart =
    (account as AccountRow).billing_period_start?.trim() ||
    new Date().toISOString().slice(0, 10);

  const { data: orgRows } = await admin
    .from("organizations")
    .select("id")
    .eq("account_id", accountId)
    .eq("is_active", true);

  const orgIds = (orgRows ?? []).map((row) => row.id as string);
  if (orgIds.length === 0) {
    orgIds.push(organizationId);
  }

  const { data: smsRows, error: smsErr } = await admin
    .from("sms_usage_records")
    .select("segments")
    .in("organization_id", orgIds)
    .gte("sent_at", `${periodStart}T00:00:00.000Z`);

  if (smsErr) {
    console.error("[sms-quota] usage lookup failed", smsErr.message);
    return {
      allowed: false,
      usedSegments: 0,
      includedSms,
      remaining: 0,
      reason: "usage_lookup_failed",
    };
  }

  let usedSegments = 0;
  for (const row of smsRows ?? []) {
    const segments = row.segments;
    usedSegments +=
      typeof segments === "number" ? Math.max(0, segments) : 0;
  }

  const remaining = Math.max(0, includedSms - usedSegments);
  const allowed = includedSms > 0 && usedSegments < includedSms;

  return {
    allowed,
    usedSegments,
    includedSms,
    remaining,
    reason: allowed ? undefined : "quota_exhausted",
  };
}
