import "server-only";

import { SUB_PROCESSOR_LIST_VERSION } from "@/lib/sub-processors.data";
import { sendTransactionalEmail } from "@/lib/sendgrid-mail";
import { createAdminClient } from "@/utils/supabase/admin";

const PLATFORM_CONFIG_KEY = "sub_processors_notified_version";

export type SubProcessorNotifyResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  emailsSent?: number;
  version?: string;
};

async function getNotifiedVersion(
  admin: ReturnType<typeof createAdminClient>,
): Promise<string | null> {
  const { data } = await admin
    .from("platform_config")
    .select("value")
    .eq("key", PLATFORM_CONFIG_KEY)
    .maybeSingle();
  return data?.value?.trim() || null;
}

async function setNotifiedVersion(
  admin: ReturnType<typeof createAdminClient>,
  version: string,
): Promise<void> {
  const { error } = await admin.from("platform_config").upsert(
    {
      key: PLATFORM_CONFIG_KEY,
      value: version,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) {
    throw new Error(error.message);
  }
}

/** Primary admin email per active organization (first admin profile). */
async function listOrgAdminEmails(
  admin: ReturnType<typeof createAdminClient>,
): Promise<string[]> {
  const { data: orgs, error: orgErr } = await admin
    .from("organizations")
    .select("id")
    .eq("status", "active");

  if (orgErr || !orgs?.length) return [];

  const orgIds = orgs.map((o) => o.id as string);
  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select("organization_id, id, role")
    .in("organization_id", orgIds)
    .eq("role", "admin");

  if (profErr || !profiles?.length) return [];

  const adminUserIds = profiles.map((p) => p.id as string);
  const { data: users, error: userErr } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });

  if (userErr) return [];

  const userById = new Map(
    (users.users ?? []).map((u) => [u.id, u.email?.trim().toLowerCase()]),
  );

  const emails = new Set<string>();
  for (const profile of profiles) {
    const email = userById.get(profile.id as string);
    if (email) emails.add(email);
  }
  return [...emails];
}

/**
 * Notify salon admins when the sub-processor list version changes (DPA §7).
 * Idempotent per version — safe to run from cron daily.
 */
export async function notifySubProcessorListChangeIfNeeded(): Promise<SubProcessorNotifyResult> {
  const admin = createAdminClient();
  const current = SUB_PROCESSOR_LIST_VERSION;
  const notified = await getNotifiedVersion(admin);

  if (notified === current) {
    return { ok: true, skipped: true, reason: "already_notified", version: current };
  }

  const recipients = await listOrgAdminEmails(admin);
  if (recipients.length === 0) {
    await setNotifiedVersion(admin, current);
    return {
      ok: true,
      skipped: true,
      reason: "no_active_admins",
      version: current,
    };
  }

  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim()?.replace(/^/, "https://") ||
    "https://app.clistesystems.ie";

  const subProcessorsUrl = `${appOrigin.replace(/\/$/, "")}/dashboard/legal/sub-processors`;
  let emailsSent = 0;

  for (const to of recipients) {
    const result = await sendTransactionalEmail({
      to,
      subject: "Cliste sub-processor list update",
      text: [
        "Hello,",
        "",
        `We have updated our sub-processor list (version ${current}).`,
        "",
        `Review the named vendors and transfer mechanisms here:`,
        subProcessorsUrl,
        "",
        "Under our Data Processing Agreement you have 30 days to object on reasonable grounds.",
        "Reply to privacy@clistesystems.ie with any concerns.",
        "",
        "— Cliste Systems",
      ].join("\n"),
    });
    if (result.ok) emailsSent += 1;
    else console.warn("[sub-processors] notify_failed", to, result.message);
  }

  await setNotifiedVersion(admin, current);

  return { ok: true, emailsSent, version: current };
}
