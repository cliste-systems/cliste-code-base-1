/**
 * Dev-only: fill Murphy's SuperValu /dashboard with realistic activity so every
 * home panel, chart, and hero metric has data.
 *
 *   npx tsx scripts/seed-retail-dashboard-activity.ts
 *
 * Rows are tagged [smoke test] / RT-TEST-* / +353555* for easy cleanup.
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import { startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import { createAdminClient } from "../src/utils/supabase/admin";

const DUBLIN = "Europe/Dublin";
const SMOKE_TAG = "[smoke test]";
const OWNER_EMAIL = "admin@cliste.test";

type CallSeed = {
  callerNumber: string;
  callerName: string;
  durationSeconds: number;
  outcome: string;
  aiSummary: string;
  minutesAgo: number;
};

type TicketSeed = {
  callerNumber: string;
  callerName: string;
  summary: string;
  status: "open" | "resolved";
  minutesAgo: number;
};

type TrainingSeed = {
  status: "awaiting_answer" | "draft_ready";
  gapSummary: string;
  caraQuestion: string;
  callerContext: string;
  minutesAgo: number;
};

function smokePhone(index: number): string {
  return `+353555${String(index).padStart(6, "0")}`;
}

function minutesAgoIso(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function dublinTodayStartIso(now = new Date()): string {
  const zonedNow = toZonedTime(now, DUBLIN);
  const startTodayZoned = startOfDay(zonedNow);
  return fromZonedTime(startTodayZoned, DUBLIN).toISOString();
}

async function findRetailOrgId(
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ orgId: string; accountId: string; billingPeriodStart: string }> {
  const { data: users, error: usersErr } = await admin.auth.admin.listUsers({
    perPage: 200,
  });
  if (usersErr) throw usersErr;

  const owner = users.users.find(
    (u) => u.email?.trim().toLowerCase() === OWNER_EMAIL,
  );
  if (!owner) {
    throw new Error(
      `No auth user ${OWNER_EMAIL}. Run scripts/seed-retail-demo-user.ts first.`,
    );
  }

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("organization_id, active_organization_id, account_id")
    .eq("id", owner.id)
    .maybeSingle();
  if (profileErr || !profile) {
    throw new Error(profileErr?.message ?? "Profile not found for retail owner.");
  }

  const orgId =
    (profile.active_organization_id as string | null) ??
    (profile.organization_id as string);
  const accountId = profile.account_id as string;

  const { data: account, error: accountErr } = await admin
    .from("accounts")
    .select("billing_period_start")
    .eq("id", accountId)
    .maybeSingle();
  if (accountErr || !account) {
    throw new Error(accountErr?.message ?? "Account not found.");
  }

  const billingPeriodStart =
    (account.billing_period_start as string | null) ??
    new Date().toISOString().slice(0, 10);

  return { orgId, accountId, billingPeriodStart };
}

async function cleanupSmokeData(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
): Promise<void> {
  const { data: smokeCalls } = await admin
    .from("call_logs")
    .select("id")
    .eq("organization_id", orgId)
    .or(
      `call_sid.like.RT-TEST-%,caller_number.like.+353555%,ai_summary.ilike.%${SMOKE_TAG}%`,
    );

  const callIds = (smokeCalls ?? []).map((row) => row.id as string);
  if (callIds.length > 0) {
    await admin
      .from("cara_training_items")
      .delete()
      .eq("organization_id", orgId)
      .in("call_log_id", callIds);
  }

  await admin
    .from("cara_training_items")
    .delete()
    .eq("organization_id", orgId)
    .ilike("gap_summary", `%${SMOKE_TAG}%`);

  await admin
    .from("usage_records")
    .delete()
    .eq("organization_id", orgId)
    .like("call_sid", "RT-TEST-%");

  await admin
    .from("action_tickets")
    .delete()
    .eq("organization_id", orgId)
    .ilike("summary", `%${SMOKE_TAG}%`);

  await admin
    .from("call_logs")
    .delete()
    .eq("organization_id", orgId)
    .or(
      `call_sid.like.RT-TEST-%,caller_number.like.+353555%,ai_summary.ilike.%${SMOKE_TAG}%`,
    );
}

async function ensurePhoneNumber(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
): Promise<void> {
  const { data: org } = await admin
    .from("organizations")
    .select("phone_number")
    .eq("id", orgId)
    .maybeSingle();

  if (org?.phone_number) return;

  const { data: row } = await admin
    .from("phone_numbers")
    .select("id, e164")
    .is("organization_id", null)
    .eq("status", "available")
    .limit(1)
    .maybeSingle();

  if (!row?.e164) {
    console.log("  (no pool number — Cara may show Offline until a number is assigned)");
    return;
  }

  const now = new Date().toISOString();
  await admin
    .from("phone_numbers")
    .update({
      organization_id: orgId,
      status: "assigned",
      assigned_at: now,
      updated_at: now,
    })
    .eq("id", row.id);

  await admin
    .from("organizations")
    .update({ phone_number: row.e164, updated_at: now })
    .eq("id", orgId);

  console.log(`  Assigned Cliste number ${row.e164}`);
}

const CALLS: CallSeed[] = [
  { callerNumber: smokePhone(1), callerName: "Siobhán Kelly", durationSeconds: 95, outcome: "answered", aiSummary: `${SMOKE_TAG} Asked about Sunday opening hours`, minutesAgo: 4 },
  { callerNumber: smokePhone(2), callerName: "Tom O'Brien", durationSeconds: 110, outcome: "answered", aiSummary: `${SMOKE_TAG} Deli counter location`, minutesAgo: 8 },
  { callerNumber: smokePhone(3), callerName: "Mary Walsh", durationSeconds: 88, outcome: "answered", aiSummary: `${SMOKE_TAG} Click and collect process`, minutesAgo: 12 },
  { callerNumber: smokePhone(4), callerName: "James Lynch", durationSeconds: 102, outcome: "answered", aiSummary: `${SMOKE_TAG} Butcher counter hours`, minutesAgo: 18 },
  { callerNumber: smokePhone(5), callerName: "Niamh O'Sullivan", durationSeconds: 76, outcome: "answered", aiSummary: `${SMOKE_TAG} Parking near Main Street`, minutesAgo: 22 },
  { callerNumber: smokePhone(6), callerName: "Patrick Doyle", durationSeconds: 90, outcome: "answered", aiSummary: `${SMOKE_TAG} Bakery bread availability`, minutesAgo: 28 },
  { callerNumber: smokePhone(7), callerName: "Aoife Byrne", durationSeconds: 85, outcome: "answered", aiSummary: `${SMOKE_TAG} Off-licence opening times`, minutesAgo: 35 },
  { callerNumber: smokePhone(8), callerName: "Conor Murphy", durationSeconds: 92, outcome: "answered", aiSummary: `${SMOKE_TAG} Customer service desk location`, minutesAgo: 42 },
  { callerNumber: smokePhone(9), callerName: "Emma Walsh", durationSeconds: 98, outcome: "answered", aiSummary: `${SMOKE_TAG} Gift voucher enquiry`, minutesAgo: 55 },
  { callerNumber: smokePhone(10), callerName: "Liam O'Connor", durationSeconds: 87, outcome: "answered", aiSummary: `${SMOKE_TAG} Home delivery options`, minutesAgo: 68 },
  { callerNumber: smokePhone(11), callerName: "Sarah Ryan", durationSeconds: 94, outcome: "answered", aiSummary: `${SMOKE_TAG} SuperValu loyalty card`, minutesAgo: 82 },
  { callerNumber: smokePhone(12), callerName: "David Keane", durationSeconds: 80, outcome: "answered", aiSummary: `${SMOKE_TAG} ATM in store`, minutesAgo: 96 },
  { callerNumber: smokePhone(13), callerName: "Kate O'Neill", durationSeconds: 105, outcome: "link_sent", aiSummary: `${SMOKE_TAG} Sent store link via SMS for product enquiry`, minutesAgo: 14 },
  { callerNumber: smokePhone(14), callerName: "Brian O'Sullivan", durationSeconds: 98, outcome: "link_sent", aiSummary: `${SMOKE_TAG} Texted click and collect info link via SMS`, minutesAgo: 26 },
  { callerNumber: smokePhone(15), callerName: "Fiona McCarthy", durationSeconds: 112, outcome: "link_sent", aiSummary: `${SMOKE_TAG} Sent directions link via SMS`, minutesAgo: 38 },
  { callerNumber: smokePhone(16), callerName: "Sean O'Malley", durationSeconds: 120, outcome: "action_created", aiSummary: `${SMOKE_TAG} Caller interested in bulk order — follow-up needed`, minutesAgo: 16 },
  { callerNumber: smokePhone(17), callerName: "Rita O'Donnell", durationSeconds: 115, outcome: "callback_requested", aiSummary: `${SMOKE_TAG} Caller wants callback about special order`, minutesAgo: 20 },
  { callerNumber: smokePhone(18), callerName: "Unknown", durationSeconds: 15, outcome: "failed", aiSummary: `${SMOKE_TAG} Missed call — no answer`, minutesAgo: 6 },
  { callerNumber: smokePhone(19), callerName: "Unknown", durationSeconds: 8, outcome: "voicemail_or_no_speech", aiSummary: `${SMOKE_TAG} Voicemail left`, minutesAgo: 10 },
  { callerNumber: smokePhone(20), callerName: "Unhappy Customer", durationSeconds: 130, outcome: "answered", aiSummary: `${SMOKE_TAG} Complaint about refund on damaged goods`, minutesAgo: 24 },
  { callerNumber: smokePhone(21), callerName: "Mairead Flynn", durationSeconds: 91, outcome: "answered", aiSummary: `${SMOKE_TAG} Fresh fish counter today`, minutesAgo: 120 },
  { callerNumber: smokePhone(22), callerName: "Declan Healy", durationSeconds: 86, outcome: "answered", aiSummary: `${SMOKE_TAG} Wheelchair access at entrance`, minutesAgo: 150 },
  { callerNumber: smokePhone(23), callerName: "Orla McNamara", durationSeconds: 99, outcome: "answered", aiSummary: `${SMOKE_TAG} EV charging nearby`, minutesAgo: 180 },
  { callerNumber: smokePhone(24), callerName: "Paul Brennan", durationSeconds: 103, outcome: "link_sent", aiSummary: `${SMOKE_TAG} Sent weekly offers link via SMS`, minutesAgo: 210 },
  { callerNumber: smokePhone(25), callerName: "Ciara Dunne", durationSeconds: 88, outcome: "answered", aiSummary: `${SMOKE_TAG} Pharmacy opening hours`, minutesAgo: 240 },
  { callerNumber: smokePhone(26), callerName: "Eoin Fitzgerald", durationSeconds: 95, outcome: "answered", aiSummary: `${SMOKE_TAG} Lottery counter location`, minutesAgo: 300 },
  { callerNumber: smokePhone(27), callerName: "Grainne O'Reilly", durationSeconds: 92, outcome: "answered", aiSummary: `${SMOKE_TAG} Pet food aisle`, minutesAgo: 360 },
  { callerNumber: smokePhone(28), callerName: "Barry Nolan", durationSeconds: 84, outcome: "answered", aiSummary: `${SMOKE_TAG} Trolley deposit refund`, minutesAgo: 420 },
  { callerNumber: smokePhone(29), callerName: "Helen Crowley", durationSeconds: 97, outcome: "callback_requested", aiSummary: `${SMOKE_TAG} Callback about party catering`, minutesAgo: 480 },
  { callerNumber: smokePhone(30), callerName: "Mark Sullivan", durationSeconds: 108, outcome: "action_created", aiSummary: `${SMOKE_TAG} Corporate hamper enquiry captured`, minutesAgo: 540 },
];

const TICKETS: TicketSeed[] = [
  { callerNumber: smokePhone(1), callerName: "Siobhán Kelly", summary: `${SMOKE_TAG} Pricing question — how much is the family deli platter?`, status: "open", minutesAgo: 11 },
  { callerNumber: smokePhone(17), callerName: "Rita O'Donnell", summary: `${SMOKE_TAG} Callback request — ring back about gluten-free bread stock`, status: "open", minutesAgo: 19 },
  { callerNumber: smokePhone(16), callerName: "Sean O'Malley", summary: `${SMOKE_TAG} New customer interested in bulk catering order`, status: "open", minutesAgo: 15 },
  { callerNumber: smokePhone(13), callerName: "Kate O'Neill", summary: `${SMOKE_TAG} General enquiry — do ye deliver to Killarney town?`, status: "open", minutesAgo: 13 },
  { callerNumber: smokePhone(29), callerName: "Helen Crowley", summary: `${SMOKE_TAG} Callback needed — party catering for 40 people`, status: "open", minutesAgo: 45 },
  { callerNumber: smokePhone(3), callerName: "Mary Walsh", summary: `${SMOKE_TAG} Pricing question — cost of party sandwich platter`, status: "resolved", minutesAgo: 60 },
  { callerNumber: smokePhone(4), callerName: "James Lynch", summary: `${SMOKE_TAG} Callback needed — butcher to confirm lamb availability`, status: "resolved", minutesAgo: 75 },
  { callerNumber: smokePhone(5), callerName: "Niamh O'Sullivan", summary: `${SMOKE_TAG} New enquiry — interested in weekly grocery delivery`, status: "resolved", minutesAgo: 90 },
  { callerNumber: smokePhone(6), callerName: "Patrick Doyle", summary: `${SMOKE_TAG} General enquiry — bank holiday opening hours`, status: "resolved", minutesAgo: 105 },
  { callerNumber: smokePhone(7), callerName: "Aoife Byrne", summary: `${SMOKE_TAG} Pricing question — how much for a birthday cake order`, status: "resolved", minutesAgo: 120 },
  { callerNumber: smokePhone(8), callerName: "Conor Murphy", summary: `${SMOKE_TAG} Callback request — call me back about off-licence wine list`, status: "resolved", minutesAgo: 135 },
  { callerNumber: smokePhone(9), callerName: "Emma Walsh", summary: `${SMOKE_TAG} Product enquiry — do ye stock organic milk?`, status: "resolved", minutesAgo: 150 },
  { callerNumber: smokePhone(10), callerName: "Liam O'Connor", summary: `${SMOKE_TAG} General enquiry — lost loyalty card replacement`, status: "resolved", minutesAgo: 165 },
  { callerNumber: smokePhone(11), callerName: "Sarah Ryan", summary: `${SMOKE_TAG} Pricing question — estimate for corporate hamper`, status: "resolved", minutesAgo: 180 },
  { callerNumber: smokePhone(12), callerName: "David Keane", summary: `${SMOKE_TAG} New enquiry — potential supplier for local honey`, status: "resolved", minutesAgo: 195 },
  { callerNumber: smokePhone(30), callerName: "Mark Sullivan", summary: `${SMOKE_TAG} Product enquiry — interested in wine tasting event`, status: "resolved", minutesAgo: 210 },
];

const TRAINING: TrainingSeed[] = [
  {
    status: "awaiting_answer",
    gapSummary: `${SMOKE_TAG} Do ye sell gluten-free sourdough in the bakery?`,
    caraQuestion: "A caller asked about gluten-free sourdough. What should I tell them?",
    callerContext: "Caller asked if gluten-free sourdough is available daily",
    minutesAgo: 45,
  },
  {
    status: "awaiting_answer",
    gapSummary: `${SMOKE_TAG} Can customers pre-order a turkey for Christmas?`,
    caraQuestion: "A caller asked about Christmas turkey pre-orders. What should I tell them?",
    callerContext: "Asked about deposit and collection dates",
    minutesAgo: 120,
  },
  {
    status: "draft_ready",
    gapSummary: `${SMOKE_TAG} Student discount policy for local college`,
    caraQuestion: "A caller asked about student discounts. What should I tell them?",
    callerContext: "Caller mentioned MTU Kerry student card",
    minutesAgo: 180,
  },
  {
    status: "awaiting_answer",
    gapSummary: `${SMOKE_TAG} Is there EV charging in the car park?`,
    caraQuestion: "A caller asked about EV charging. What should I tell them?",
    callerContext: "Asked if chargers are free for customers",
    minutesAgo: 240,
  },
  {
    status: "awaiting_answer",
    gapSummary: `${SMOKE_TAG} Do ye price-match Dunnes on branded goods?`,
    caraQuestion: "A caller asked about price matching. What should I tell them?",
    callerContext: "Caller quoted a competitor leaflet",
    minutesAgo: 300,
  },
];

async function main() {
  const admin = createAdminClient();
  const { orgId, billingPeriodStart } = await findRetailOrgId(admin);

  console.log(`\nSeeding dashboard activity for org ${orgId}\n`);

  console.log("Cleaning previous smoke-test rows…");
  await cleanupSmokeData(admin, orgId);

  console.log("Ensuring Cliste phone number…");
  await ensurePhoneNumber(admin, orgId);

  const todayStart = dublinTodayStartIso();
  console.log(`Dublin today starts: ${todayStart}`);

  console.log(`Inserting ${CALLS.length} call logs…`);
  const callRows = CALLS.map((call, index) => ({
    organization_id: orgId,
    caller_number: call.callerNumber,
    caller_name: call.callerName,
    duration_seconds: call.durationSeconds,
    outcome: call.outcome,
    ai_summary: call.aiSummary,
    call_sid: `RT-TEST-${String(index + 1).padStart(4, "0")}`,
    created_at: minutesAgoIso(call.minutesAgo),
  }));

  const { error: callsErr } = await admin.from("call_logs").insert(callRows);
  if (callsErr) throw new Error(`call_logs: ${callsErr.message}`);

  console.log(`Inserting ${TICKETS.length} action tickets…`);
  const ticketRows = TICKETS.map((ticket) => ({
    organization_id: orgId,
    caller_number: ticket.callerNumber,
    caller_name: ticket.callerName,
    summary: ticket.summary,
    status: ticket.status,
    created_at: minutesAgoIso(ticket.minutesAgo),
  }));

  const { error: ticketsErr } = await admin.from("action_tickets").insert(ticketRows);
  if (ticketsErr) throw new Error(`action_tickets: ${ticketsErr.message}`);

  console.log(`Inserting ${TRAINING.length} Cara training items…`);
  const trainingRows = TRAINING.map((item) => ({
    organization_id: orgId,
    status: item.status,
    source: "call_gap" as const,
    gap_summary: item.gapSummary,
    cara_question: item.caraQuestion,
    caller_context: item.callerContext,
    updated_at: minutesAgoIso(item.minutesAgo),
    created_at: minutesAgoIso(item.minutesAgo),
  }));

  const { error: trainingErr } = await admin
    .from("cara_training_items")
    .insert(trainingRows);
  if (trainingErr) throw new Error(`cara_training_items: ${trainingErr.message}`);

  console.log("Inserting usage records (~86 billable minutes)…");
  const usageRows = Array.from({ length: 34 }, (_, index) => {
    const startedAt = new Date(Date.now() - (index + 1) * 75 * 60_000);
    const endedAt = new Date(startedAt.getTime() + 150_000);
    return {
      organization_id: orgId,
      call_sid: `RT-TEST-USAGE-${String(index + 1).padStart(3, "0")}`,
      caller_number: smokePhone(100 + index),
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      minutes_billable: 2.5,
      billing_period_start: billingPeriodStart,
      plan_tier_at_time: "starter",
      plan_quota_at_time: 140,
    };
  });

  const { error: usageErr } = await admin.from("usage_records").insert(usageRows);
  if (usageErr) throw new Error(`usage_records: ${usageErr.message}`);

  const openTickets = TICKETS.filter((t) => t.status === "open").length;
  const routedCalls = CALLS.filter((c) =>
    ["link_sent", "callback_requested", "action_created"].includes(c.outcome),
  ).length;

  console.log("\n✓ Dashboard activity seeded\n");
  console.log(`  Calls today:        ${CALLS.length}`);
  console.log(`  Enquiries captured: ${TICKETS.length}`);
  console.log(`  Info sent / routed: ${routedCalls}`);
  console.log(`  Needs attention:    ${openTickets} open tickets`);
  console.log(`  Cara training:      ${TRAINING.length} items`);
  console.log(`  Billable minutes:   ~86`);
  console.log("\n  Refresh http://localhost:3001/dashboard (hard refresh if cached)\n");
  console.log("  Cleanup: re-run this script (clears RT-TEST / +353555 / [smoke test] rows)\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
