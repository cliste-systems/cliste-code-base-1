/**
 * Assign a specific pool DID to an organization.
 *
 *   npx tsx scripts/assign-phone-to-org.ts --e164 +353749389378 --org <uuid>
 *   npx tsx scripts/assign-phone-to-org.ts --e164 +353749389378 --email bloom@cliste.test
 */

import "./mock-server-only.ts";
import { config } from "dotenv";

config({ path: ".env.local" });

import { createAdminClient } from "../src/utils/supabase/admin";

function parseArgs() {
  const args = process.argv.slice(2);
  let e164 = "";
  let orgId = "";
  let email = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--e164" && args[i + 1]) e164 = args[++i];
    if (args[i] === "--org" && args[i + 1]) orgId = args[++i];
    if (args[i] === "--email" && args[i + 1]) email = args[++i];
  }
  if (!e164.startsWith("+")) {
    throw new Error("Pass --e164 in E.164 format, e.g. +353749389378");
  }
  if (!orgId && !email) {
    throw new Error("Pass --org <uuid> or --email <signup-email>");
  }
  return { e164, orgId, email };
}

async function resolveOrgId(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  email: string,
): Promise<string> {
  if (orgId) return orgId;
  const { data: users } = await admin.auth.admin.listUsers();
  const user = users.users.find((u) => u.email === email);
  if (!user?.id) throw new Error(`No auth user for ${email}`);
  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.organization_id) throw new Error(`No org for ${email}`);
  return profile.organization_id as string;
}

async function main() {
  const { e164, orgId: argOrgId, email } = parseArgs();
  const admin = createAdminClient();
  const organizationId = await resolveOrgId(admin, argOrgId, email);
  const now = new Date().toISOString();

  const { data: target } = await admin
    .from("phone_numbers")
    .select("id, status, organization_id")
    .eq("e164", e164)
    .maybeSingle();

  if (!target?.id) {
    throw new Error(`${e164} not in phone_numbers pool — seed it first.`);
  }

  const { data: currentForOrg } = await admin
    .from("phone_numbers")
    .select("id, e164")
    .eq("organization_id", organizationId)
    .eq("status", "assigned")
    .maybeSingle();

  if (currentForOrg?.id && currentForOrg.id !== target.id) {
    await admin
      .from("phone_numbers")
      .update({
        status: "available",
        organization_id: null,
        assigned_at: null,
        updated_at: now,
      })
      .eq("id", currentForOrg.id);
    console.log(`Released previous number ${currentForOrg.e164}`);
  }

  if (target.organization_id && target.organization_id !== organizationId) {
    await admin
      .from("phone_numbers")
      .update({
        status: "available",
        organization_id: null,
        assigned_at: null,
        updated_at: now,
      })
      .eq("id", target.id);
  }

  const { error: claimError } = await admin
    .from("phone_numbers")
    .update({
      status: "assigned",
      organization_id: organizationId,
      assigned_at: now,
      updated_at: now,
    })
    .eq("id", target.id);

  if (claimError) throw new Error(claimError.message);

  await admin
    .from("organizations")
    .update({ phone_number: e164, updated_at: now })
    .eq("id", organizationId);

  const { data: org } = await admin
    .from("organizations")
    .select("name, phone_number, status, onboarding_step, routing_links")
    .eq("id", organizationId)
    .single();

  const { count: fileCount } = await admin
    .from("business_files")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  console.log("\n✓ Phone assigned\n");
  console.log(`  Org:       ${org?.name} (${organizationId})`);
  console.log(`  Number:    ${org?.phone_number}`);
  console.log(`  Status:    ${org?.status}, step ${org?.onboarding_step}`);
  console.log(
    `  Routes:    ${Array.isArray(org?.routing_links) ? org.routing_links.length : 0}`,
  );
  console.log(`  Files:     ${fileCount ?? 0}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
