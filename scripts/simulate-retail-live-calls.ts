/**
 * Dev-only: simulate incoming retail calls so /dashboard updates live via Realtime.
 *
 *   npx tsx scripts/simulate-retail-live-calls.ts
 *
 * Inserts a new call every ~18s (and sometimes a ticket). Stop with Ctrl+C.
 * Rows use RT-TEST-LIVE-* / [smoke test] markers — cleaned by seed-retail-dashboard-activity.
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import { randomInt } from "node:crypto";

import { createAdminClient } from "../src/utils/supabase/admin";

const OWNER_EMAIL = "admin@cliste.test";
const INTERVAL_MS = 18_000;
const SMOKE_TAG = "[smoke test]";

const CALLERS = [
  { name: "Mairead Flynn", phone: "+353861001001" },
  { name: "Declan Healy", phone: "+353861001002" },
  { name: "Orla McNamara", phone: "+353861001003" },
  { name: "Paul Brennan", phone: "+353861001004" },
  { name: "Ciara Dunne", phone: "+353861001005" },
  { name: "Eoin Fitzgerald", phone: "+353861001006" },
  { name: "Grainne O'Reilly", phone: "+353861001007" },
  { name: "Barry Nolan", phone: "+353861001008" },
  { name: "Helen Crowley", phone: "+353861001009" },
  { name: "Mark Sullivan", phone: "+353861001010" },
];

const SUMMARIES = [
  "Asked about Sunday opening hours",
  "Deli counter — party platter pricing",
  "Click and collect wait time",
  "Butcher — lamb shoulder availability",
  "Bakery gluten-free bread today",
  "Off-licence special offers",
  "Customer service desk location",
  "Parking on Main Street",
  "Loyalty card points balance",
  "Home delivery to Killarney",
];

const OUTCOMES = [
  "answered",
  "answered",
  "answered",
  "link_sent",
  "callback_requested",
  "action_created",
] as const;

async function findOrgId(
  admin: ReturnType<typeof createAdminClient>,
): Promise<string> {
  const { data: users, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  const owner = users.users.find(
    (u) => u.email?.trim().toLowerCase() === OWNER_EMAIL,
  );
  if (!owner) {
    throw new Error(`No ${OWNER_EMAIL} — run seed-retail-demo-user.ts first.`);
  }
  const { data: profile } = await admin
    .from("profiles")
    .select("active_organization_id, organization_id")
    .eq("id", owner.id)
    .maybeSingle();
  const orgId =
    (profile?.active_organization_id as string | null) ??
    (profile?.organization_id as string);
  if (!orgId) throw new Error("Retail org not found.");
  return orgId;
}

let tick = 0;

async function insertLiveEvent(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
): Promise<void> {
  tick += 1;
  const caller = CALLERS[randomInt(CALLERS.length)]!;
  const summary = SUMMARIES[randomInt(SUMMARIES.length)]!;
  const outcome = OUTCOMES[randomInt(OUTCOMES.length)]!;
  const now = new Date();
  const callSid = `RT-TEST-LIVE-${now.getTime()}`;

  const { error: callErr } = await admin.from("call_logs").insert({
    organization_id: orgId,
    caller_number: caller.phone,
    caller_name: caller.name,
    duration_seconds: randomInt(60, 140),
    outcome,
    ai_summary: `${SMOKE_TAG} ${summary}`,
    call_sid: callSid,
    created_at: now.toISOString(),
  });

  if (callErr) {
    console.error("call_logs insert failed:", callErr.message);
    return;
  }

  console.log(
    `[${now.toLocaleTimeString("en-IE")}] Call #${tick}: ${caller.name} — ${outcome}`,
  );

  if (outcome === "action_created" || outcome === "callback_requested" || tick % 3 === 0) {
    const ticketSummary =
      outcome === "callback_requested"
        ? `${SMOKE_TAG} Callback request — ${summary.toLowerCase()}`
        : outcome === "action_created"
          ? `${SMOKE_TAG} New enquiry — ${summary.toLowerCase()}`
          : `${SMOKE_TAG} Pricing question — ${summary.toLowerCase()}`;

    const { error: ticketErr } = await admin.from("action_tickets").insert({
      organization_id: orgId,
      caller_number: caller.phone,
      caller_name: caller.name,
      summary: ticketSummary,
      status: "open",
      created_at: now.toISOString(),
    });

    if (ticketErr) {
      console.error("action_tickets insert failed:", ticketErr.message);
    } else {
      console.log(`  → ticket captured (${ticketSummary.slice(0, 48)}…)`);
    }
  }

  if (tick % 5 === 0) {
    const { error: trainingErr } = await admin.from("cara_training_items").insert({
      organization_id: orgId,
      status: "awaiting_answer",
      source: "call_gap",
      gap_summary: `${SMOKE_TAG} Live gap: ${summary}`,
      cara_question: `A caller asked: ${summary}. What should I tell them?`,
      caller_context: summary,
      updated_at: now.toISOString(),
      created_at: now.toISOString(),
    });
    if (!trainingErr) {
      console.log("  → Cara training gap added");
    }
  }
}

async function main() {
  const admin = createAdminClient();
  const orgId = await findOrgId(admin);

  console.log("\n✓ Live call simulator running");
  console.log(`  Org:      ${orgId}`);
  console.log(`  Interval: every ${INTERVAL_MS / 1000}s`);
  console.log("  Watch:    http://localhost:3001/dashboard");
  console.log("  Stop:     Ctrl+C\n");

  await insertLiveEvent(admin, orgId);

  setInterval(() => {
    void insertLiveEvent(admin, orgId);
  }, INTERVAL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
