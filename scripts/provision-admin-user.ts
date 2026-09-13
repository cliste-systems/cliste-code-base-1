/**
 * Create or update a Supabase auth user with full Admin console access.
 *
 * Run:
 *   npx tsx scripts/provision-admin-user.ts [email]
 *
 * Prints the generated password once to stdout (store it securely).
 */

import { randomBytes } from "node:crypto";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

import { createAdminClient } from "../src/utils/supabase/admin";

const DEFAULT_EMAIL = "brendan@clistesystems.ie";

function generatePassword(): string {
  const base = randomBytes(18).toString("base64url");
  return `Cl1ste!${base}`;
}

async function findUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const match = data.users.find(
      (u) => u.email?.trim().toLowerCase() === email,
    );
    if (match) return match;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function main(): Promise<void> {
  const email = (process.argv[2]?.trim() || DEFAULT_EMAIL).toLowerCase();
  const password = generatePassword();
  const admin = createAdminClient();

  const existing = await findUserByEmail(admin, email);
  if (existing) {
    const appMeta = (existing.app_metadata ?? {}) as Record<string, unknown>;
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: { ...appMeta, cliste_admin_console: true },
    });
    if (error) throw new Error(`updateUser failed: ${error.message}`);
    console.log(`Updated existing user ${email} (${data.user?.id})`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { cliste_admin_console: true },
    });
    if (error) throw new Error(`createUser failed: ${error.message}`);
    console.log(`Created user ${email} (${data.user?.id})`);
  }

  console.log("");
  console.log("Admin console credentials (save once — not stored in repo):");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log("");
  console.log("Sign in flow:");
  console.log("  1. /admin/login — gate password (CLISTE_ADMIN_SECRET)");
  console.log("  2. /authenticate — Supabase sign-in with the email/password above");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
