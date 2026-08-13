/**
 * Verify (and optionally fix) Twilio IE1 messaging region on pool numbers.
 *
 * Usage:
 *   npx tsx scripts/verify-twilio-ie1-messaging.ts
 *   npx tsx scripts/verify-twilio-ie1-messaging.ts --fix
 *
 * Also reports SendGrid domain authentication for clistesystems.ie.
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

import {
  ensureTwilioIe1MessagingRegion,
  getTwilioMessagingRegion,
} from "../src/lib/twilio-ie-messaging";
import { getSendGridDomainAuthStatus } from "../src/lib/sendgrid-domain";

const fix = process.argv.includes("--fix");

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const domainStatus = await getSendGridDomainAuthStatus();
  console.log("\nSendGrid domain auth:");
  console.log(`  ${domainStatus.message}`);
  console.log(`  authenticated=${domainStatus.authenticated} valid=${domainStatus.valid}`);

  const { data: rows, error } = await admin
    .from("phone_numbers")
    .select("e164, status, provider")
    .eq("provider", "twilio")
    .order("e164");

  if (error) {
    console.error("phone_numbers lookup failed:", error.message);
    process.exit(1);
  }

  if (!rows?.length) {
    console.log("\nNo Twilio phone_numbers rows found.");
    process.exit(0);
  }

  console.log(`\nTwilio numbers (${rows.length}):`);
  let needsFix = 0;

  for (const row of rows) {
    const e164 = String(row.e164 ?? "").trim();
    if (!e164) continue;

    const status = await getTwilioMessagingRegion(e164);
    if (!status.ok) {
      console.log(`  ${e164} [${row.status}] — lookup failed: ${status.error}`);
      continue;
    }

    const region = status.messagingRegion ?? "unset";
    const ok = region === "ie1";
    console.log(
      `  ${e164} [${row.status}] messaging_region=${region} voice_region=${status.voiceRegion ?? "unset"}${ok ? "" : " NEEDS_IE1"}`,
    );

    if (!ok) {
      needsFix += 1;
      if (fix) {
        const result = await ensureTwilioIe1MessagingRegion(e164);
        console.log(
          `    fix: ${result.ok ? "ok" : `failed (${"message" in result ? result.message : "unknown"})`}`,
        );
      }
    }
  }

  if (needsFix > 0 && !fix) {
    console.log(`\n${needsFix} number(s) need messaging_region=ie1. Re-run with --fix.`);
    process.exit(2);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
