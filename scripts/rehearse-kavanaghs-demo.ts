/**
 * Verify Kavanaghs retail demo readiness before the manager meeting.
 *
 *   npx tsx scripts/rehearse-kavanaghs-demo.ts
 *   npx tsx scripts/rehearse-kavanaghs-demo.ts --manager-phone +35387...
 *   npx tsx scripts/rehearse-kavanaghs-demo.ts --probe-webhooks
 *   npx tsx scripts/rehearse-kavanaghs-demo.ts --simulate-four-part
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import { createAdminClient } from "../src/utils/supabase/admin";
import { classifyActionCategory } from "../src/app/(dashboard)/dashboard/action-inbox/categories";

const ORG_SLUG = "kavanaghs-supervalu-donegal-town";
const RETAIL_LINE_E164 = "+353749759508";
const PRESENTER_EMAIL = "kavanaghs@cliste.test";
const DEMO_TAG = "[demo rehearsal]";
const DEFAULT_APP_URL = "http://localhost:3001";

function parseArgs(): {
  managerPhone: string | null;
  probeWebhooks: boolean;
  simulateFourPart: boolean;
  appUrl: string;
} {
  const args = process.argv.slice(2);
  let managerPhone = process.env.KAVANAGHS_MANAGER_PHONE?.trim() || null;
  let probeWebhooks = false;
  let simulateFourPart = false;
  let appUrl = process.env.APP_URL?.trim() || DEFAULT_APP_URL;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--manager-phone" && args[i + 1]) managerPhone = args[++i];
    if (args[i] === "--probe-webhooks") probeWebhooks = true;
    if (args[i] === "--simulate-four-part") simulateFourPart = true;
    if (args[i] === "--app-url" && args[i + 1]) appUrl = args[++i];
  }
  return { managerPhone, probeWebhooks, simulateFourPart, appUrl };
}

function printFourPartScript(): void {
  console.log("\n4-part live demo script (call → show screen → repeat):\n");
  console.log(`  Line: ${RETAIL_LINE_E164}`);
  console.log(`  Dashboard: ${PRESENTER_EMAIL}\n`);
  console.log("  Part 1 — FAQ → Call History");
  console.log('    Say: "What time do you close on Sunday?" / "Where is the bakery?"');
  console.log("    Show: /dashboard/call-history — Answered, no Action Inbox ticket\n");
  console.log("  Part 2 — Unsure → Action Inbox");
  console.log(
    '    Say: "Can I use Real Rewards at Applegreen?" then give your name for callback',
  );
  console.log("    Show: /dashboard/action-inbox — Needs review\n");
  console.log("  Part 3 — Cake → Dashboard home");
  console.log(
    '    Say: birthday cake Saturday, chocolate sponge, 12 servings, icing message, your name',
  );
  console.log("    Show: /dashboard — Today's requests (Pricing question)\n");
  console.log("  Part 4 — Manager → Action Inbox + SMS");
  console.log(
    '    Say: "Speak to the store manager — home delivery never arrived yesterday" + your name',
  );
  console.log("    Show: /dashboard/action-inbox — Complaint/Urgent + Garreth's phone SMS\n");
}

async function probeActionTicketWebhook(
  appUrl: string,
  secret: string,
): Promise<boolean> {
  const base = appUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/voice/action-ticket`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        called_number: RETAIL_LINE_E164,
        caller_number: "+353861009998",
        caller_name: "Webhook Probe",
        summary: `${DEMO_TAG} safe to delete — webhook auth probe`,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };
    if (res.status === 503 && body.error?.includes("CLISTE_VOICE_WEBHOOK_SECRET")) {
      console.log(`✗ Webhook probe (${base}): secret not loaded at runtime (HTTP 503)`);
      return false;
    }
    if (res.status === 401) {
      console.log(`✗ Webhook probe (${base}): unauthorized — secret mismatch (HTTP 401)`);
      return false;
    }
    if (!res.ok || !body.ok) {
      console.log(
        `✗ Webhook probe (${base}): HTTP ${res.status} — ${body.error ?? "unknown error"}`,
      );
      return false;
    }
    console.log(`✓ Webhook probe (${base}): action-ticket OK`);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`✗ Webhook probe (${base}): ${msg}`);
    return false;
  }
}

type FourPartScenario = {
  part: number;
  label: string;
  callerName: string;
  callerPhone: string;
  summary: string;
  expectedCategory: ReturnType<typeof classifyActionCategory> | null;
  outcome: string;
};

const FOUR_PART_SCENARIOS: FourPartScenario[] = [
  {
    part: 1,
    label: "FAQ — Sunday hours + bakery",
    callerName: "Demo Caller One",
    callerPhone: "+353861009901",
    summary: `${DEMO_TAG} Asked Sunday closing time (9–6) and where the bakery is (front beside Customer Service)`,
    expectedCategory: null,
    outcome: "answered",
  },
  {
    part: 2,
    label: "Unsure — Real Rewards at Applegreen",
    callerName: "Demo Caller Two",
    callerPhone: "+353861009902",
    summary: `${DEMO_TAG} Caller asked if Real Rewards works at Applegreen — Cara was not sure and logged it for the team`,
    expectedCategory: "unclear",
    outcome: "action_created",
  },
  {
    part: 3,
    label: "Cake — birthday order",
    callerName: "Demo Caller Three",
    callerPhone: "+353861009903",
    summary: `${DEMO_TAG} Pricing question — birthday cake for Saturday, chocolate sponge, 12 servings, "Happy 8th Birthday Jamie"`,
    expectedCategory: "quote",
    outcome: "action_created",
  },
  {
    part: 4,
    label: "Manager — missed delivery",
    callerName: "Demo Caller Four",
    callerPhone: "+353861009904",
    summary: `${DEMO_TAG} Complaint — caller asked to speak to store manager about a home delivery that never arrived yesterday`,
    expectedCategory: "complaint",
    outcome: "action_created",
  },
];

async function simulateFourPartDemo(input: {
  admin: ReturnType<typeof createAdminClient>;
  orgId: string;
  appUrl: string;
  secret: string;
}): Promise<string[]> {
  const failures: string[] = [];
  const base = input.appUrl.replace(/\/$/, "");
  const now = Date.now();

  for (const scenario of FOUR_PART_SCENARIOS) {
    console.log(`\nSimulating part ${scenario.part}: ${scenario.label}`);

    const callSid = `DEMO-4PART-${scenario.part}-${now}`;
    const { error: callErr } = await input.admin.from("call_logs").insert({
      organization_id: input.orgId,
      caller_number: scenario.callerPhone,
      caller_name: scenario.callerName,
      duration_seconds: 95 + scenario.part * 5,
      outcome: scenario.outcome,
      ai_summary: scenario.summary,
      call_sid: callSid,
      called_number: RETAIL_LINE_E164,
    });
    if (callErr) {
      console.log(`  ✗ call_logs: ${callErr.message}`);
      failures.push(`Part ${scenario.part} call log`);
      continue;
    }
    console.log(`  ✓ call_logs (${scenario.outcome})`);

    if (scenario.part === 1) continue;

    try {
      const res = await fetch(`${base}/api/voice/action-ticket`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          called_number: RETAIL_LINE_E164,
          caller_number: scenario.callerPhone,
          caller_name: scenario.callerName,
          summary: scenario.summary,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        action_ticket_id?: string;
      };
      if (!res.ok || !body.ok) {
        console.log(
          `  ✗ action-ticket: HTTP ${res.status} — ${body.error ?? "failed"}`,
        );
        failures.push(`Part ${scenario.part} action ticket`);
        continue;
      }
      const category = classifyActionCategory(scenario.summary);
      const categoryOk = category === scenario.expectedCategory;
      console.log(
        `  ${categoryOk ? "✓" : "✗"} action-ticket (${category}, ticket ${body.action_ticket_id ?? "?"})`,
      );
      if (!categoryOk) {
        failures.push(`Part ${scenario.part} category expected ${scenario.expectedCategory}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  ✗ action-ticket: ${msg}`);
      failures.push(`Part ${scenario.part} action ticket`);
    }
  }

  return failures;
}

async function main() {
  const { managerPhone, probeWebhooks, simulateFourPart, appUrl } = parseArgs();
  const admin = createAdminClient();
  const expectedManagerPhone = managerPhone;
  const failures: string[] = [];

  const webhookSecret = process.env.CLISTE_VOICE_WEBHOOK_SECRET?.trim() ?? "";
  const hasWebhookSecret = webhookSecret.length > 0;
  console.log(`${hasWebhookSecret ? "✓" : "✗"} CLISTE_VOICE_WEBHOOK_SECRET in .env.local`);
  if (!hasWebhookSecret) {
    failures.push("CLISTE_VOICE_WEBHOOK_SECRET missing in .env.local");
  }

  const { data: org, error } = await admin
    .from("organizations")
    .select(
      "id, name, slug, phone_number, notification_phone, fallback_number, greeting, custom_prompt, is_active, niche, call_routing_mode",
    )
    .eq("slug", ORG_SLUG)
    .maybeSingle();

  if (error || !org?.id) {
    throw new Error(error?.message ?? `Org ${ORG_SLUG} not found — run seed-kavanaghs-retail-demo.ts first.`);
  }

  const prompt = String(org.custom_prompt ?? "");
  const hasGarreth = prompt.includes("Garreth Ferry");

  const checks: Array<[string, boolean]> = [
    ["Org name is Kavanaghs", org.name === "Kavanaghs SuperValu Donegal Town"],
    ["Retail niche", org.niche === "retail"],
    ["Org active", org.is_active === true],
    ["9508 assigned", org.phone_number === RETAIL_LINE_E164],
    ["Custom prompt compiled", prompt.trim().length > 200],
    ["Manager name Garreth Ferry in prompt", hasGarreth],
    ["Greeting mentions Kavanaghs", String(org.greeting ?? "").includes("Kavanaghs")],
    ["Notification phone set", Boolean(String(org.notification_phone ?? "").trim())],
    ["Fallback number set", Boolean(String(org.fallback_number ?? "").trim())],
    ["Call routing mode", org.call_routing_mode === "cliste_number"],
  ];

  if (expectedManagerPhone) {
    checks.push([
      "Manager phone matches",
      org.notification_phone === expectedManagerPhone &&
        org.fallback_number === expectedManagerPhone,
    ]);
  }

  for (const [label, ok] of checks) {
    console.log(`${ok ? "✓" : "✗"} ${label}`);
    if (!ok) failures.push(label);
  }

  const { count: deptCount } = await admin
    .from("store_departments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("active", true);
  console.log(`${(deptCount ?? 0) >= 3 ? "✓" : "✗"} Store departments (${deptCount ?? 0})`);
  if ((deptCount ?? 0) < 3) failures.push("Store departments");

  const { count: openTickets } = await admin
    .from("action_tickets")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("status", "open");
  console.log(`${(openTickets ?? 0) >= 3 ? "✓" : "✗"} Open Action Inbox tickets (${openTickets ?? 0})`);
  if ((openTickets ?? 0) < 3) {
    failures.push("Open Action Inbox tickets — run seed-kavanaghs-dashboard-activity.ts");
  }

  const { count: callsToday } = await admin
    .from("call_logs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id);
  console.log(`${(callsToday ?? 0) >= 10 ? "✓" : "✗"} Call history rows (${callsToday ?? 0})`);
  if ((callsToday ?? 0) < 10) {
    failures.push("Call history — run seed-kavanaghs-dashboard-activity.ts");
  }

  if (probeWebhooks || simulateFourPart) {
    if (!hasWebhookSecret) {
      failures.push("Cannot probe/simulate without CLISTE_VOICE_WEBHOOK_SECRET");
    } else {
      const localOk = await probeActionTicketWebhook(appUrl, webhookSecret);
      if (!localOk) {
        failures.push(
          `Local webhook probe failed (${appUrl}) — start: npm run dev -- -p 3001`,
        );
      }
      const prodOk = await probeActionTicketWebhook(
        "https://app.hellocara.ie",
        webhookSecret,
      );
      if (!prodOk) {
        console.log(
          "⚠ Production app.hellocara.ie webhooks unavailable — use local dashboard + ngrok for live calls",
        );
        console.log(
          "  1. npm run dev -- -p 3001",
        );
        console.log("  2. ngrok http 3001 → set Railway CLISTE_APP_URL to the https URL");
        console.log("  3. Railway CLISTE_VOICE_WEBHOOK_SECRET already matches .env.local");
      }
    }
  }

  printFourPartScript();

  if (simulateFourPart && hasWebhookSecret) {
    console.log(`\nRunning 4-part simulation against ${appUrl}…`);
    const simFailures = await simulateFourPartDemo({
      admin,
      orgId: org.id,
      appUrl,
      secret: webhookSecret,
    });
    failures.push(...simFailures);
    if (simFailures.length === 0) {
      console.log("\n✓ 4-part simulation passed — check dashboard live refresh");
    }
  } else if (simulateFourPart) {
    console.log("\nSkipped simulation — fix CLISTE_VOICE_WEBHOOK_SECRET first.");
  }

  console.log("\nLive demo tips:");
  console.log("  • Top up LiveKit inference credits (429 quota caused silence on last call)");
  console.log("  • Hang up between each of the 4 calls");
  console.log("  • Hard refresh dashboard; wide viewport (≥1024px) for home charts");
  console.log(`  • Simulate dry-run: npx tsx scripts/rehearse-kavanaghs-demo.ts --simulate-four-part --app-url ${appUrl}\n`);

  if (failures.length > 0) {
    console.error(`Failed checks: ${failures.join(", ")}`);
    process.exit(1);
  }

  console.log("Demo readiness checks passed.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
