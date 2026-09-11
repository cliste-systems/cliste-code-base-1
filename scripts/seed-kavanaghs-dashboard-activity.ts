/**
 * Dev-only: fill Kavanaghs SuperValu Donegal Town /dashboard with realistic retail activity.
 *
 *   npx tsx scripts/seed-kavanaghs-dashboard-activity.ts
 *   npx tsx scripts/seed-kavanaghs-dashboard-activity.ts --screenshot
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import { startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import { createAdminClient } from "../src/utils/supabase/admin";

const DUBLIN = "Europe/Dublin";
const ORG_DISPLAY_NAME = "Kavanaghs SuperValu Donegal Town";
const DEFAULT_OWNER_EMAIL = "kavanaghs@cliste.test";
const ORG_SLUG = "kavanaghs-supervalu-donegal-town";

function parseArgs(): { email: string; orgId: string; screenshot: boolean } {
  const args = process.argv.slice(2);
  let email = DEFAULT_OWNER_EMAIL;
  let orgId = "";
  let screenshot = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) email = args[++i];
    if (args[i] === "--org" && args[i + 1]) orgId = args[++i];
    if (args[i] === "--screenshot") screenshot = true;
  }
  return { email, orgId, screenshot };
}

type CallSeed = {
  callerNumber: string;
  callerName: string;
  durationSeconds: number;
  outcome: string;
  aiSummary: string;
  transcript?: string;
  transcriptReview?: string;
  minutesAgo?: number;
  atDublinHour?: number;
  atDublinMinute?: number;
  transferConnected?: boolean;
  transferDepartment?: string;
  transferTarget?: string;
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

function demoPhone(index: number): string {
  return `+353555${String(index).padStart(6, "0")}`;
}

function minutesAgoIso(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

/** Today's Dublin calendar at a shop hour — used for demo rows so metrics/charts work before opening. */
function dublinShopHourTodayIso(hour: number, minute = 0): string {
  const zonedNow = toZonedTime(new Date(), DUBLIN);
  const dayStart = startOfDay(zonedNow);
  const zonedTarget = new Date(dayStart);
  zonedTarget.setHours(hour, minute, 0, 0);
  return fromZonedTime(zonedTarget, DUBLIN).toISOString();
}

function retailDublinHourForIndex(index: number): { hour: number; minute: number } {
  const hour = 9 + (index % 9);
  const minute = 8 + ((index * 7) % 52);
  return { hour, minute };
}

function callCreatedAt(call: CallSeed, index: number): string {
  const todayStart = dublinTodayStartIso();

  if (call.minutesAgo != null && call.atDublinHour == null) {
    const recent = minutesAgoIso(call.minutesAgo);
    if (recent >= todayStart) {
      return recent;
    }
  }

  if (call.atDublinHour != null) {
    return dublinShopHourTodayIso(call.atDublinHour, call.atDublinMinute ?? 10);
  }

  const { hour, minute } = retailDublinHourForIndex(index);
  return dublinShopHourTodayIso(hour, minute);
}

function dublinTodayStartIso(now = new Date()): string {
  const zonedNow = toZonedTime(now, DUBLIN);
  const startTodayZoned = startOfDay(zonedNow);
  return fromZonedTime(startTodayZoned, DUBLIN).toISOString();
}

async function findRetailOrgId(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  orgIdArg: string,
): Promise<{ orgId: string; accountId: string; billingPeriodStart: string }> {
  let orgId = orgIdArg.trim();

  if (!orgId) {
    const { data: orgBySlug, error: slugErr } = await admin
      .from("organizations")
      .select("id, account_id")
      .eq("slug", ORG_SLUG)
      .maybeSingle();
    if (slugErr) throw slugErr;
    if (orgBySlug?.id) {
      orgId = orgBySlug.id as string;
    }
  }

  if (!orgId) {
    const { data: users, error: usersErr } = await admin.auth.admin.listUsers({
      perPage: 200,
    });
    if (usersErr) throw usersErr;

    const owner = users.users.find(
      (u) => u.email?.trim().toLowerCase() === email.trim().toLowerCase(),
    );
    if (!owner) {
      throw new Error(
        `No auth user ${email}. Run scripts/seed-retail-demo-user.ts first.`,
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

    orgId =
      (profile.active_organization_id as string | null) ??
      (profile.organization_id as string);
  }

  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .select("account_id")
    .eq("id", orgId)
    .maybeSingle();
  if (orgErr || !orgRow?.account_id) {
    throw new Error(orgErr?.message ?? `Organization ${orgId} not found.`);
  }

  const accountId = orgRow.account_id as string;

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

async function cleanupDemoData(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
): Promise<void> {
  await admin.from("cara_training_items").delete().eq("organization_id", orgId);
  await admin.from("action_tickets").delete().eq("organization_id", orgId);
  await admin
    .from("usage_records")
    .delete()
    .eq("organization_id", orgId)
    .like("call_sid", "KAV-TEST-%");
  await admin.from("call_logs").delete().eq("organization_id", orgId);
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

async function renameDemoOrg(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  accountId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await admin
    .from("organizations")
    .update({ name: ORG_DISPLAY_NAME, updated_at: now })
    .eq("id", orgId);
  await admin
    .from("accounts")
    .update({ name: ORG_DISPLAY_NAME, updated_at: now })
    .eq("id", accountId);
}

const CALLS: CallSeed[] = [
  { callerNumber: demoPhone(1), callerName: "Siobhán Kelly", durationSeconds: 95, outcome: "answered", aiSummary: "Asked about Real Rewards points balance and how to register a new card", minutesAgo: 5 },
  { callerNumber: demoPhone(2), callerName: "Tom O'Brien", durationSeconds: 110, outcome: "answered", aiSummary: "Asked where the deli counter is and Sunday opening hours", minutesAgo: 9 },
  { callerNumber: demoPhone(3), callerName: "Mary Walsh", durationSeconds: 88, outcome: "answered", aiSummary: "Asked about Click & Collect collection times for a grocery order", minutesAgo: 14 },
  { callerNumber: demoPhone(4), callerName: "James Lynch", durationSeconds: 102, outcome: "transferred", aiSummary: "Wanted to speak to the butcher about a Sunday lamb roast — transferred to Butcher", minutesAgo: 17, transferConnected: true, transferDepartment: "Butcher", transferTarget: "+35364123001" },
  { callerNumber: demoPhone(5), callerName: "Niamh O'Sullivan", durationSeconds: 76, outcome: "answered", aiSummary: "Asked about parking on Main Street and trolley deposit refund", minutesAgo: 21 },
  { callerNumber: demoPhone(6), callerName: "Patrick Doyle", durationSeconds: 90, outcome: "answered", aiSummary: "Asked if the bakery has fresh soda bread this morning", minutesAgo: 28 },
  { callerNumber: demoPhone(7), callerName: "Aoife Byrne", durationSeconds: 85, outcome: "answered", aiSummary: "Asked about off-licence wine offers for the weekend", minutesAgo: 33 },
  { callerNumber: demoPhone(8), callerName: "Conor Murphy", durationSeconds: 92, outcome: "transferred", aiSummary: "Asked for Customer Service about a Real Rewards voucher — transferred", minutesAgo: 38, transferConnected: true, transferDepartment: "Customer Service", transferTarget: "+35364123003" },
  { callerNumber: demoPhone(9), callerName: "Emma Walsh", durationSeconds: 98, outcome: "answered", aiSummary: "Asked about SuperValu gift vouchers for a staff prize draw", minutesAgo: 44 },
  { callerNumber: demoPhone(10), callerName: "Liam O'Connor", durationSeconds: 87, outcome: "answered", aiSummary: "Asked about home delivery slots for Killarney town", minutesAgo: 52 },
  { callerNumber: demoPhone(11), callerName: "Sarah Ryan", durationSeconds: 94, outcome: "link_sent", aiSummary: "Sent weekly offers link via SMS for Real Rewards app download", minutesAgo: 16 },
  { callerNumber: demoPhone(12), callerName: "David Keane", durationSeconds: 80, outcome: "link_sent", aiSummary: "Texted Click & Collect booking link via SMS", minutesAgo: 27 },
  { callerNumber: demoPhone(13), callerName: "Kate O'Neill", durationSeconds: 105, outcome: "link_sent", aiSummary: "Sent store directions link via SMS for a visitor from Tralee", minutesAgo: 39 },
  { callerNumber: demoPhone(14), callerName: "Fiona McCarthy", durationSeconds: 112, outcome: "link_sent", aiSummary: "Sent Christmas hamper brochure link via SMS", minutesAgo: 58 },
  { callerNumber: demoPhone(15), callerName: "Sean O'Malley", durationSeconds: 120, outcome: "action_created", aiSummary: "Caller interested in bulk catering for a GAA club dinner — follow-up needed", minutesAgo: 19 },
  { callerNumber: demoPhone(16), callerName: "Rita O'Donnell", durationSeconds: 115, outcome: "callback_requested", aiSummary: "Caller wants a callback about gluten-free bread availability in bakery", minutesAgo: 23 },
  { callerNumber: demoPhone(17), callerName: "Helen Crowley", durationSeconds: 97, outcome: "callback_requested", aiSummary: "Callback requested about party catering platter for 40 people", minutesAgo: 48 },
  { callerNumber: demoPhone(18), callerName: "Unknown", durationSeconds: 12, outcome: "voicemail_or_no_speech", aiSummary: "Caller hung up after the greeting — no speech detected", minutesAgo: 7 },
  { callerNumber: demoPhone(19), callerName: "Unknown", durationSeconds: 8, outcome: "voicemail_or_no_speech", aiSummary: "Silent call — Cara answered but the caller did not speak", minutesAgo: 11 },
  { callerNumber: demoPhone(20), callerName: "Margaret Hayes", durationSeconds: 130, outcome: "answered", aiSummary: "Complaint about a refund on damaged packaging — unhappy with previous visit", minutesAgo: 31 },
  { callerNumber: demoPhone(21), callerName: "Declan Healy", durationSeconds: 86, outcome: "answered", aiSummary: "Asked about wheelchair access at the Main Street entrance", atDublinHour: 9, atDublinMinute: 20 },
  { callerNumber: demoPhone(22), callerName: "Orla McNamara", durationSeconds: 99, outcome: "answered", aiSummary: "Asked if there is EV charging in the car park behind the store", atDublinHour: 10, atDublinMinute: 45 },
  { callerNumber: demoPhone(23), callerName: "Paul Brennan", durationSeconds: 103, outcome: "transferred", aiSummary: "Wanted the deli for a party platter quote — transferred to Deli", atDublinHour: 11, atDublinMinute: 30, transferConnected: true, transferDepartment: "Deli", transferTarget: "+35364123000" },
  { callerNumber: demoPhone(24), callerName: "Ciara Dunne", durationSeconds: 88, outcome: "answered", aiSummary: "Asked about ATM location inside the store", atDublinHour: 12, atDublinMinute: 15 },
  { callerNumber: demoPhone(25), callerName: "Eoin Fitzgerald", durationSeconds: 95, outcome: "answered", aiSummary: "Asked where the National Lottery counter is", atDublinHour: 13, atDublinMinute: 0 },
  { callerNumber: demoPhone(26), callerName: "Grainne O'Reilly", durationSeconds: 92, outcome: "answered", aiSummary: "Asked which aisle stocks premium dog food", atDublinHour: 14, atDublinMinute: 20 },
  {
    callerNumber: demoPhone(27),
    callerName: "Barry Nolan",
    durationSeconds: 84,
    outcome: "answered",
    aiSummary: "Asked about bank holiday opening hours for August",
    transcriptReview:
      "Barry called to ask whether Brennan's Provisions is open on the August bank holiday. Cara confirmed the store is closed on bank holidays, including Monday 3 August. Barry asked about Sunday trading before the holiday; Cara gave normal Sunday hours of 9:00–18:00 and regular weekday hours for the rest of the month. No follow-up needed.",
    transcript: `Cara: You're through to Brennan's Provisions — I'm Cara, the AI assistant. This call may be recorded and transcribed. How can I help you today?

Barry: Hi, yeah, quick one — are ye open on the August bank holiday?

Cara: We're closed on bank holidays, including the August bank holiday on Monday the 3rd of August.

Barry: Right, so the shop is closed on the Monday?

Cara: That's right — closed all day. We reopen Tuesday the 4th at eight o'clock in the morning.

Barry: And what about the Sunday before that?

Cara: Sundays we trade nine till six, as normal — so Sunday the 2nd of August we'll be open nine to six.

Barry: Perfect. And there's no special hours for the rest of August?

Cara: Just our usual hours — Monday to Saturday eight till nine, Sunday nine till six. No other bank holidays in August after the third.

Barry: Lovely, that's all I needed. Thanks a million.

Cara: No problem at all, Barry. Thanks for calling Brennan's Provisions. Have a great day.`,
    atDublinHour: 15,
    atDublinMinute: 40,
  },
  { callerNumber: demoPhone(28), callerName: "Mark Sullivan", durationSeconds: 108, outcome: "action_created", aiSummary: "Corporate hamper enquiry for hotel welcome packs — message captured", atDublinHour: 16, atDublinMinute: 10 },
  { callerNumber: demoPhone(29), callerName: "Mairead Flynn", durationSeconds: 91, outcome: "answered", aiSummary: "Asked if the fish counter has fresh salmon today", atDublinHour: 17, atDublinMinute: 25 },
  { callerNumber: demoPhone(30), callerName: "Blocked Caller", durationSeconds: 0, outcome: "blocked", aiSummary: "Withheld caller ID — blocked per store policy", minutesAgo: 13 },
  { callerNumber: demoPhone(31), callerName: "Unknown", durationSeconds: 22, outcome: "spam_or_abuse", aiSummary: "Abusive language after opening — call ended", minutesAgo: 35 },
  { callerNumber: demoPhone(32), callerName: "Una Fitzgerald", durationSeconds: 118, outcome: "transferred", aiSummary: "Asked for manager about a delivery complaint — transfer to Customer Service failed", minutesAgo: 42, transferConnected: false, transferDepartment: "Customer Service", transferTarget: "+35364123003" },
  { callerNumber: demoPhone(33), callerName: "Peter Costello", durationSeconds: 105, outcome: "answered", aiSummary: "Refund query on a Real Rewards promotion — disappointed with outcome", minutesAgo: 56 },
];

const TICKETS: TicketSeed[] = [
  {
    callerNumber: demoPhone(7),
    callerName: "Aoife Byrne",
    summary:
      "Pricing question — birthday cake for 8-year-old, Saturday pickup, chocolate sponge",
    status: "open",
    minutesAgo: 8,
  },
  {
    callerNumber: demoPhone(16),
    callerName: "Rita O'Donnell",
    summary: "Callback request — ring back about gluten-free sourdough in the bakery",
    status: "open",
    minutesAgo: 20,
  },
  {
    callerNumber: demoPhone(32),
    callerName: "Una Fitzgerald",
    summary:
      "Caller asked to speak to store manager about a home delivery that never arrived yesterday",
    status: "open",
    minutesAgo: 14,
  },
  { callerNumber: demoPhone(1), callerName: "Siobhán Kelly", summary: "Pricing question — how much is the large family deli platter?", status: "open", minutesAgo: 12 },
  { callerNumber: demoPhone(15), callerName: "Sean O'Malley", summary: "New customer interested in bulk catering for a GAA club dinner", status: "open", minutesAgo: 18 },
  { callerNumber: demoPhone(10), callerName: "Liam O'Connor", summary: "General enquiry — do you deliver to Donegal Town?", status: "open", minutesAgo: 15 },
  { callerNumber: demoPhone(17), callerName: "Helen Crowley", summary: "Callback needed — party catering platter for 40 people next Saturday", status: "open", minutesAgo: 46 },
  { callerNumber: demoPhone(3), callerName: "Mary Walsh", summary: "Pricing question — cost of a party sandwich platter from the deli", status: "resolved", minutesAgo: 62 },
  { callerNumber: demoPhone(4), callerName: "James Lynch", summary: "Callback needed — butcher to confirm lamb roast availability for Sunday", status: "resolved", minutesAgo: 78 },
  { callerNumber: demoPhone(5), callerName: "Niamh O'Sullivan", summary: "New enquiry — interested in weekly grocery delivery slots", status: "resolved", minutesAgo: 92 },
  { callerNumber: demoPhone(6), callerName: "Patrick Doyle", summary: "General enquiry — bank holiday opening hours in August", status: "resolved", minutesAgo: 108 },
  { callerNumber: demoPhone(8), callerName: "Conor Murphy", summary: "Callback request — call me back about the off-licence wine list", status: "resolved", minutesAgo: 138 },
  { callerNumber: demoPhone(9), callerName: "Emma Walsh", summary: "Product enquiry — do you stock organic oat milk?", status: "resolved", minutesAgo: 155 },
  { callerNumber: demoPhone(11), callerName: "Sarah Ryan", summary: "General enquiry — lost Real Rewards card replacement", status: "resolved", minutesAgo: 172 },
  { callerNumber: demoPhone(12), callerName: "David Keane", summary: "Pricing question — estimate for a corporate Christmas hamper", status: "resolved", minutesAgo: 188 },
];

const TRAINING: TrainingSeed[] = [
  {
    status: "awaiting_answer",
    gapSummary: "Real Rewards at partner petrol stations",
    caraQuestion: "A caller asked if Real Rewards works at partner petrol stations. What should I tell them?",
    callerContext: "Asked about Circle K and Applegreen redemption",
    minutesAgo: 40,
  },
  {
    status: "awaiting_answer",
    gapSummary: "Christmas turkey pre-orders",
    caraQuestion: "A caller asked about ordering a Christmas turkey. What should I tell them?",
    callerContext: "Asked about deposit and collection dates",
    minutesAgo: 85,
  },
  {
    status: "draft_ready",
    gapSummary: "Student discount with MTU Kerry card",
    caraQuestion: "A caller asked about student discounts. What should I tell them?",
    callerContext: "Caller mentioned MTU Kerry student card",
    minutesAgo: 130,
  },
  {
    status: "awaiting_answer",
    gapSummary: "EV charging in the car park",
    caraQuestion: "A caller asked about EV charging on site. What should I tell them?",
    callerContext: "Asked if chargers are free for shoppers",
    minutesAgo: 90,
  },
  {
    status: "awaiting_answer",
    gapSummary: "Butcher lamb roast pre-orders",
    caraQuestion: "A caller asked about pre-ordering meat from the butcher. What should I tell them?",
    callerContext: "Sunday roast for six people",
    minutesAgo: 55,
  },
  {
    status: "awaiting_answer",
    gapSummary: "Price matching on branded groceries",
    caraQuestion: "A caller asked about price matching competitors. What should I tell them?",
    callerContext: "Caller quoted a Dunnes leaflet",
    minutesAgo: 175,
  },
];

async function main() {
  const { email, orgId: orgIdArg, screenshot } = parseArgs();
  const admin = createAdminClient();
  const { orgId, accountId, billingPeriodStart } = await findRetailOrgId(
    admin,
    email,
    orgIdArg,
  );

  if (screenshot) {
    console.log("\n📸 Screenshot mode — run this immediately before capturing /dashboard.\n");
  }

  console.log(`\nSeeding dashboard activity for org ${orgId}\n`);

  console.log("Cleaning previous demo rows…");
  await cleanupDemoData(admin, orgId);

  console.log(`Renaming org to "${ORG_DISPLAY_NAME}"…`);
  await renameDemoOrg(admin, orgId, accountId);

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
    ...(call.transcript ? { transcript: call.transcript } : {}),
    ...(call.transcriptReview ? { transcript_review: call.transcriptReview } : {}),
    call_sid: `KAV-TEST-${String(index + 1).padStart(4, "0")}`,
    created_at: callCreatedAt(call, index),
    ...(call.outcome === "transferred"
      ? {
          transfer_connected: call.transferConnected ?? false,
          transfer_department: call.transferDepartment ?? null,
          transfer_target: call.transferTarget ?? null,
        }
      : {}),
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

  console.log("Inserting usage records (~85 billable minutes)…");
  const usageRows = Array.from({ length: 34 }, (_, index) => {
    const startedAt = new Date(Date.now() - (index + 1) * 75 * 60_000);
    const endedAt = new Date(startedAt.getTime() + 150_000);
    return {
      organization_id: orgId,
      call_sid: `KAV-TEST-USAGE-${String(index + 1).padStart(3, "0")}`,
      caller_number: demoPhone(100 + index),
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
  const transferred = CALLS.filter((c) => c.outcome === "transferred").length;
  const connected = CALLS.filter((c) => c.outcome === "transferred" && c.transferConnected).length;

  console.log("\n✓ Dashboard activity seeded\n");
  console.log(`  Org name:           ${ORG_DISPLAY_NAME}`);
  console.log(`  Calls today:        ${CALLS.length}`);
  console.log(`  Enquiries captured: ${TICKETS.length}`);
  console.log(`  Transfers:          ${transferred} (${connected} connected)`);
  console.log(`  Needs attention:    ${openTickets} open tickets`);
  console.log(`  Cara training:      ${TRAINING.length} items`);
  console.log(`  Billable minutes:   ~85`);
  console.log("\n  Log in kavanaghs@cliste.test → http://localhost:3001/dashboard");
  console.log("  Hard refresh; use a wide viewport (≥1024px) for bottom charts.\n");
  if (screenshot) {
    console.log("  Screenshot tip: capture now while timestamps are fresh (Today view).\n");
  }
  console.log("  Cleanup: re-run this script (wipes demo org activity and re-seeds)\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
