/**
 * Dev QA: remove every tenant (auth users, accounts, orgs) and return pool
 * numbers to available. Preserves phone_numbers inventory.
 *
 *   npx tsx scripts/purge-all-tenants.ts
 *   npx tsx scripts/purge-all-tenants.ts --keep-email brendan@clistesystems.ie
 */

import "./mock-server-only.ts";
import { config } from "dotenv";

config({ path: ".env.local" });

import { createAdminClient } from "../src/utils/supabase/admin";

function parseArgs() {
  const keepEmails = new Set<string>();
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === "--keep-email" && process.argv[i + 1]) {
      keepEmails.add(process.argv[++i]!.trim().toLowerCase());
    }
  }
  return { keepEmails };
}

async function listAllUsers(admin: ReturnType<typeof createAdminClient>) {
  const users: Array<{ id: string; email?: string }> = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    users.push(...data.users.map((u) => ({ id: u.id, email: u.email })));
    if (data.users.length < 200) break;
    page += 1;
  }
  return users;
}

async function main() {
  const { keepEmails } = parseArgs();
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: orgs } = await admin
    .from("organizations")
    .select("id, name, slug, phone_number, account_id");

  console.log(`Found ${orgs?.length ?? 0} organization(s).`);

  const { data: assignedPhones } = await admin
    .from("phone_numbers")
    .select("id, e164, organization_id")
    .eq("status", "assigned");

  for (const row of assignedPhones ?? []) {
    const { error } = await admin
      .from("phone_numbers")
      .update({
        status: "available",
        organization_id: null,
        assigned_at: null,
        updated_at: now,
      })
      .eq("id", row.id);
    if (error) throw new Error(`release ${row.e164}: ${error.message}`);
    console.log(`Released ${row.e164}`);
  }

  const users = await listAllUsers(admin);
  for (const user of users) {
    const email = user.email?.trim().toLowerCase() ?? "";
    if (email && keepEmails.has(email)) {
      console.log(`Keeping user ${email}`);
      continue;
    }
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`delete user ${email || user.id}: ${error.message}`);
    console.log(`Deleted user ${email || user.id}`);
  }

  const { data: accounts } = await admin.from("accounts").select("id, slug");
  for (const account of accounts ?? []) {
    const { error } = await admin.from("accounts").delete().eq("id", account.id);
    if (error) throw new Error(`delete account ${account.slug}: ${error.message}`);
    console.log(`Deleted account ${account.slug}`);
  }

  const { count: orgCount } = await admin
    .from("organizations")
    .select("id", { count: "exact", head: true });
  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1 });
  const { data: pool } = await admin
    .from("phone_numbers")
    .select("e164, status, organization_id")
    .order("created_at", { ascending: true });

  console.log("\n✓ Purge complete\n");
  console.log(`  Organizations remaining: ${orgCount ?? 0}`);
  console.log(`  Auth users remaining:      ${userList?.users?.length ?? "?"}`);
  console.log("  Phone pool:");
  for (const p of pool ?? []) {
    console.log(`    ${p.e164}  ${p.status}  org=${p.organization_id ?? "—"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
