/**
 * Reset presenter password for live demo login issues.
 *   npx tsx scripts/reset-kavanaghs-demo-password.ts
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

import { createAdminClient } from "../src/utils/supabase/admin";

const EMAIL = "kavanaghs@cliste.test";
const PASSWORD = "KavanaghsDemo2026!";

async function main() {
  const admin = createAdminClient();
  const normalized = EMAIL.toLowerCase();

  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = listed?.users.find(
    (u) => u.email?.toLowerCase() === normalized,
  );
  if (!existing?.id) {
    throw new Error(`${EMAIL} not found — run seed-kavanaghs-retail-demo.ts first.`);
  }

  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      ...((existing.user_metadata as Record<string, unknown>) ?? {}),
      needs_password: false,
    },
  });
  if (error) throw error;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    throw new Error("Missing Supabase URL/anon key in .env.local");
  }

  const client = createClient(url, anon);
  const { error: signErr } = await client.auth.signInWithPassword({
    email: normalized,
    password: PASSWORD,
  });
  if (signErr) {
    throw new Error(`Password updated but sign-in test failed: ${signErr.message}`);
  }

  console.log("\n✓ Kavanaghs demo login reset\n");
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log("  URL:      http://localhost:3001/login");
  console.log("  (On phone use your ngrok URL + /login, not localhost)\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
