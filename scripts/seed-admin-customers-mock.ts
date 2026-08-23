/**
 * Seed mock customers for admin UI preview. Rows are marked [smoke test].
 *
 *   npx tsx scripts/seed-admin-customers-mock.ts
 *   npx tsx scripts/seed-admin-customers-mock.ts --cleanup
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import { createAdminClient } from "../src/utils/supabase/admin";

const MARKER = "[smoke test]";
const COUNT = 28;

const MANAGED_NAMES = [
  "SuperValu Donegal Town",
  "Centra Westport",
  "Daybreak Killarney",
  "Eurospar Tralee",
  "SuperValu Letterkenny",
  "Centra Sligo",
  "Daybreak Galway",
  "Eurospar Cork",
  "SuperValu Limerick",
  "Centra Waterford",
  "Daybreak Athlone",
  "Eurospar Dundalk",
  "SuperValu Navan",
  "Centra Kilkenny",
  "Daybreak Wexford",
  "Eurospar Ennis",
  "SuperValu Castlebar",
  "Centra Tullamore",
  "Daybreak Mullingar",
  "Eurospar Carlow",
];

const SAAS_NAMES = [
  "Last Look Hair Studio",
  "Glow Beauty Dublin",
  "Oak Trades Ltd",
  "Harbour Dental",
  "Peak Fitness Cork",
  "Studio Nine Barbers",
  "Greenleaf Home Services",
  "River Cafe Killarney",
];

function slugify(name: string, i: number): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `smoke-${base}-${i}`;
}

async function cleanup(admin: ReturnType<typeof createAdminClient>) {
  const { data: orgs } = await admin
    .from("organizations")
    .select("id, account_id, name")
    .like("name", `${MARKER}%`);

  const orgIds = (orgs ?? []).map((o) => o.id as string);
  const accountIds = [
    ...new Set(
      (orgs ?? [])
        .map((o) => o.account_id as string | null)
        .filter(Boolean) as string[],
    ),
  ];

  if (orgIds.length > 0) {
    await admin.from("admin_invites").delete().in("organization_id", orgIds);
    await admin.from("organizations").delete().in("id", orgIds);
  }
  if (accountIds.length > 0) {
    await admin.from("accounts").delete().in("id", accountIds);
  }

  console.log(
    `Cleaned ${orgIds.length} mock org(s) and ${accountIds.length} account(s).`,
  );
}

async function seed() {
  const admin = createAdminClient();

  const ts = Date.now();
  for (let i = 0; i < COUNT; i++) {
    const isManaged = i % 3 !== 2;
    const rawName = isManaged
      ? MANAGED_NAMES[i % MANAGED_NAMES.length]
      : SAAS_NAMES[i % SAAS_NAMES.length];
    const name = `${MARKER} ${rawName}`;
    const slug = `${slugify(rawName, i)}-${ts}`;

    const { data: account, error: accountErr } = await admin
      .from("accounts")
      .insert({
        name,
        slug,
        status: isManaged ? "active" : "onboarding",
        launch_status: "not_started",
        plan_tier: i % 4 === 0 ? "starter" : "pro",
        ...(isManaged
          ? {}
          : { signup_ip: "127.0.0.1", signup_user_agent: "smoke-seed" }),
      })
      .select("id")
      .single();

    if (accountErr || !account?.id) {
      console.error(`Account ${i}:`, accountErr?.message);
      continue;
    }

    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({
        account_id: account.id,
        is_primary_location: true,
        name,
        slug,
        tier: "native",
        niche: isManaged ? "retail" : "other",
        is_active: false,
        status: isManaged ? "active" : "onboarding",
        onboarding_step: isManaged ? 0 : Math.min(5, (i % 6) + 1),
        retail_banner: isManaged ? "supervalu" : null,
      })
      .select("id")
      .single();

    if (orgErr || !org?.id) {
      await admin.from("accounts").delete().eq("id", account.id);
      console.error(`Org ${i}:`, orgErr?.message);
      continue;
    }

    if (isManaged) {
      await admin.from("admin_invites").insert({
        organization_id: org.id,
        email: `smoke-owner-${i}@example.com`,
        recipient_name: `Smoke Owner ${i}`,
        sent_at: new Date(Date.now() - i * 86400000).toISOString(),
        accepted_at: i % 5 === 0 ? null : new Date().toISOString(),
      });
    }
  }

  console.log(`Seeded up to ${COUNT} mock customers (${MARKER}).`);
}

async function main() {
  const admin = createAdminClient();
  if (process.argv.includes("--cleanup")) {
    await cleanup(admin);
    return;
  }
  await seed();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
