import "server-only";

import { PLANS, type PlanTier } from "@/lib/cliste-plans.data";
import { recordComplianceEvent } from "@/lib/compliance-events";
import { sendTransactionalEmail } from "@/lib/sendgrid-mail";
import { createAdminClient } from "@/utils/supabase/admin";

export type UsageAlertResult = {
  orgsChecked: number;
  alertsSent: number;
  skipped: number;
};

type AccountRow = {
  id: string;
  plan_tier: string | null;
  billing_period_start: string | null;
  status: string | null;
};

export async function runUsageAlerts(): Promise<UsageAlertResult> {
  const admin = createAdminClient();
  const result: UsageAlertResult = { orgsChecked: 0, alertsSent: 0, skipped: 0 };

  const { data: accounts, error } = await admin
    .from("accounts")
    .select("id, plan_tier, billing_period_start, status")
    .eq("status", "active");
  if (error) throw new Error(error.message);

  for (const account of (accounts ?? []) as AccountRow[]) {
    const tier = account.plan_tier as PlanTier | null;
    if (!tier || !PLANS[tier]) continue;
    const plan = PLANS[tier];
    if (plan.includedMinutes <= 0) continue;

    const { data: orgs } = await admin
      .from("organizations")
      .select("id, name")
      .eq("account_id", account.id)
      .eq("is_active", true);
    if (!orgs?.length) continue;

    const periodStart =
      account.billing_period_start?.trim() ||
      new Date().toISOString().slice(0, 10);
    const orgIds = orgs.map((o) => o.id as string);

    const { data: usageRows } = await admin
      .from("usage_records")
      .select("minutes_billable")
      .in("organization_id", orgIds)
      .gte("ended_at", `${periodStart}T00:00:00.000Z`)
      .not("ended_at", "is", null);

    let usedMinutes = 0;
    for (const row of usageRows ?? []) {
      const m = row.minutes_billable;
      if (typeof m === "number") usedMinutes += m;
    }

    const pct =
      plan.includedMinutes > 0
        ? Math.round((usedMinutes / plan.includedMinutes) * 100)
        : 0;
    result.orgsChecked += 1;

    const threshold = pct >= 100 ? "100" : pct >= 80 ? "80" : null;
    if (!threshold) continue;

    const periodKey = `${account.id}:${periodStart}:${threshold}`;
    const { data: prior } = await admin
      .from("compliance_events")
      .select("id")
      .eq("event_type", "usage_quota_alert")
      .contains("metadata", { period_key: periodKey })
      .limit(1);
    if (prior?.length) {
      result.skipped += 1;
      continue;
    }

    const primaryOrg = orgs[0];
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", primaryOrg.id)
      .limit(1)
      .maybeSingle();
    if (!profile?.id) continue;

    const { data: userRes } = await admin.auth.admin.getUserById(profile.id);
    const ownerEmail = userRes?.user?.email?.trim();
    if (!ownerEmail) continue;

    const subject =
      threshold === "100"
        ? `Cliste: you've used your included minutes for ${primaryOrg.name}`
        : `Cliste: ${pct}% of included minutes used for ${primaryOrg.name}`;

    const text = `Hi,\n\nYour Cliste account has used ${Math.round(usedMinutes)} of ${plan.includedMinutes} included minutes this billing period (${pct}%).\n\nReview usage: https://clistesystems.ie/dashboard/billing\n`;

    const mail = await sendTransactionalEmail({ to: ownerEmail, subject, text });
    if (!mail.ok) {
      console.warn("[usage-alerts] email failed", primaryOrg.id, mail.message);
      continue;
    }

    await recordComplianceEvent(admin, {
      organizationId: primaryOrg.id,
      eventType: "usage_quota_alert",
      metadata: {
        period_key: periodKey,
        threshold,
        used_minutes: usedMinutes,
        included_minutes: plan.includedMinutes,
      },
    });
    result.alertsSent += 1;
  }

  return result;
}
