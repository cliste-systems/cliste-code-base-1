/**
 * Verify Kavanaghs retail demo readiness before the manager meeting.
 *
 *   npx tsx scripts/rehearse-kavanaghs-demo.ts
 *   npx tsx scripts/rehearse-kavanaghs-demo.ts --manager-phone +35387...
 *   npx tsx scripts/rehearse-kavanaghs-demo.ts --probe-webhooks
 *   npx tsx scripts/rehearse-kavanaghs-demo.ts --simulate-five-part
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import { createAdminClient } from "../src/utils/supabase/admin";
import { classifyActionCategory } from "../src/app/(dashboard)/dashboard/action-inbox/categories";

const ORG_SLUG = "kavanaghs-supervalu-donegal-town";
const RETAIL_LINE_E164 = "+353749759508";
const PRESENTER_EMAIL = "kavanaghs@cliste.test";
const DEFAULT_APP_URL = "http://localhost:3001";
const DEMO_OFFER_QUERY = "quick fry steak on offer this week";

function parseArgs(): {
  managerPhone: string | null;
  probeWebhooks: boolean;
  simulateFivePart: boolean;
  appUrl: string;
} {
  const args = process.argv.slice(2);
  let managerPhone = process.env.KAVANAGHS_MANAGER_PHONE?.trim() || null;
  let probeWebhooks = false;
  let simulateFivePart = false;
  let appUrl = process.env.APP_URL?.trim() || DEFAULT_APP_URL;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--manager-phone" && args[i + 1]) managerPhone = args[++i];
    if (args[i] === "--probe-webhooks") probeWebhooks = true;
    if (args[i] === "--simulate-five-part" || args[i] === "--simulate-four-part") {
      simulateFivePart = true;
    }
    if (args[i] === "--app-url" && args[i + 1]) appUrl = args[++i];
  }
  return { managerPhone, probeWebhooks, simulateFivePart, appUrl };
}

function printFivePartScript(): void {
  console.log("\n5-part live demo script (call → show screen → repeat):\n");
  console.log(`  Line: ${RETAIL_LINE_E164}`);
  console.log(`  Dashboard: ${PRESENTER_EMAIL}`);
  console.log(`  Full card: scripts/kavanaghs-five-part-demo-script.md\n`);
  console.log("  Part 1 — FAQ → Call History");
  console.log('    Say: "What time do you close on Sunday?" / "Where is the bakery?"');
  console.log("    Show: /dashboard/call-history — Answered, no Action Inbox ticket\n");
  console.log("  Part 2 — Cake → Bakery department");
  console.log(
    '    Say: birthday cake Saturday, chocolate sponge, 12 servings, icing message, your name',
  );
  console.log("    Show: /dashboard/departments/bakery — card Order, detail fields\n");
  console.log("  Part 3 — Live offer quote → Call History");
  console.log(`    Say: "${DEMO_OFFER_QUERY}" (national weekly offers via searchSuperValuProducts)`);
  console.log("    Show: /dashboard/call-history — answered with live offer quote\n");
  console.log("  Part 4 — Butcher pre-order → Meat counter");
  console.log(
    '    Say: "10 sirloin steaks for collection tomorrow evening" + your name; answer one follow-up',
  );
  console.log("    Show: /dashboard/departments/meat-counter — Order / When fields\n");
  console.log("  Part 5 — Manager complaint → Management + SMS (after hang-up)");
  console.log(
    '    Say: "Speak to the store manager — home delivery never arrived yesterday" + your name',
  );
  console.log("    Show: /dashboard/departments/management — Complaint + notification_phone SMS\n");
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
        summary: "Webhook auth probe — safe to delete",
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

async function probeOfferSearch(appUrl: string, secret: string): Promise<boolean> {
  const base = appUrl.replace(/\/$/, "");

  type ProductSearchBody = {
    ok?: boolean;
    promotion_query?: boolean;
    no_match_quote?: string | null;
    matches?: Array<{
      product_name?: string;
      is_on_offer?: boolean;
      discount_label?: string | null;
    }>;
    error?: string;
  };

  const lookup = async (query: string, intent: "offer" | "stock" = "offer") => {
    const res = await fetch(`${base}/api/voice/search-supervalu-products`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        called_number: RETAIL_LINE_E164,
        query,
        intent,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as ProductSearchBody;
    return { res, body };
  };

  try {
    let ok = true;

    const quickFry = await lookup("quick fry steak");
    const quickFryHit =
      quickFry.res.ok &&
      quickFry.body.ok === true &&
      (quickFry.body.matches?.some((m) => m.is_on_offer === true) ?? false);
    console.log(
      `${quickFryHit ? "✓" : "✗"} Offer probe — quick fry steak (${quickFry.body.matches?.length ?? 0} matches)`,
    );
    ok = ok && quickFryHit;

    const birdsEye = await lookup("Birds Eye fish fingers");
    const birdsEyeHit =
      birdsEye.res.ok &&
      birdsEye.body.ok === true &&
      (birdsEye.body.matches?.some((m) =>
        /birds? eye.*fish finger/i.test(String(m.product_name ?? "")),
      ) ?? false);
    console.log(
      `${birdsEyeHit ? "✓" : "✗"} Offer probe — Birds Eye fish fingers stays product-specific`,
    );
    ok = ok && birdsEyeHit;

    const multibuy = await lookup("3 for €10 fruit and veg");
    const multibuyHit =
      multibuy.res.ok &&
      multibuy.body.ok === true &&
      multibuy.body.promotion_query === true &&
      (multibuy.body.matches?.some((m) =>
        /3\s+for\s+€?10/i.test(String(m.discount_label ?? "")),
      ) ?? false);
    console.log(
      `${multibuyHit ? "✓" : "✗"} Promotion probe — 3 for €10 fruit and veg (${multibuy.body.matches?.length ?? 0} matches)`,
    );
    ok = ok && multibuyHit;

    // Named campaigns must never fall back to random products. Super 7 may or
    // may not be active in source data on the day this script runs.
    const super7 = await lookup("Super 7 offers");
    const super7Safe =
      super7.res.ok &&
      super7.body.ok === true &&
      super7.body.promotion_query === true &&
      (
        (super7.body.matches?.length ?? 0) === 0
          ? Boolean(super7.body.no_match_quote)
          : super7.body.matches!.every((m) =>
              /super\s*7/i.test(String(m.discount_label ?? "")),
            )
      );
    console.log(
      `${super7Safe ? "✓" : "✗"} Promotion probe — named campaign never degrades to unrelated offers`,
    );
    ok = ok && super7Safe;

    return ok;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`✗ Retail search probes: ${msg}`);
    return false;
  }
}

type FivePartScenario = {
  part: number;
  label: string;
  callerName: string;
  callerPhone: string;
  summary: string;
  expectedCategory: ReturnType<typeof classifyActionCategory> | null;
  outcome: string;
  departmentSlug?: string;
};

const FIVE_PART_SCENARIOS: FivePartScenario[] = [
  {
    part: 1,
    label: "FAQ — Sunday hours + bakery",
    callerName: "Demo Caller One",
    callerPhone: "+353861009901",
    summary:
      "Asked Sunday closing time (9–6) and where the bakery is (front beside Customer Service)",
    expectedCategory: null,
    outcome: "answered",
  },
  {
    part: 2,
    label: "Cake — birthday order",
    callerName: "Demo Caller Two",
    callerPhone: "+353861009902",
    summary: `Birthday cake order
Order: chocolate sponge for 12 people
When: Saturday
For: Jamie
Message: Happy 8th Birthday Jamie`,
    expectedCategory: "follow_up",
    outcome: "action_created",
    departmentSlug: "bakery",
  },
  {
    part: 3,
    label: "Offer — quick fry steak on special",
    callerName: "Demo Caller Three",
    callerPhone: "+353861009903",
    summary:
      "Asked if quick fry steak is on offer this week — Cara quoted national weekly offer via searchSuperValuProducts",
    expectedCategory: null,
    outcome: "answered",
  },
  {
    part: 4,
    label: "Butcher — sirloin pre-order",
    callerName: "Demo Caller Four",
    callerPhone: "+353861009904",
    summary: `Butcher order — callback
Order: 10 sirloin steaks
When: collection tomorrow evening`,
    expectedCategory: "callback",
    outcome: "action_created",
    departmentSlug: "meat-counter",
  },
  {
    part: 5,
    label: "Manager — missed delivery + SMS",
    callerName: "Demo Caller Five",
    callerPhone: "+353861009905",
    summary: `Complaint — manager callback
Issue: home delivery never arrived yesterday`,
    expectedCategory: "complaint",
    outcome: "action_created",
    departmentSlug: "management",
  },
];

async function simulateFivePartDemo(input: {
  admin: ReturnType<typeof createAdminClient>;
  orgId: string;
  appUrl: string;
  secret: string;
}): Promise<string[]> {
  const failures: string[] = [];
  const base = input.appUrl.replace(/\/$/, "");
  const now = Date.now();

  for (const scenario of FIVE_PART_SCENARIOS) {
    console.log(`\nSimulating part ${scenario.part}: ${scenario.label}`);

    const callSid = `DEMO-5PART-${scenario.part}-${now}`;
    const { error: callErr } = await input.admin.from("call_logs").insert({
      organization_id: input.orgId,
      caller_number: scenario.callerPhone,
      caller_name: scenario.callerName,
      duration_seconds: 95 + scenario.part * 5,
      outcome: scenario.outcome,
      ai_summary: scenario.summary.replace(/\n/g, " ").slice(0, 500),
      call_sid: callSid,
      called_number: RETAIL_LINE_E164,
    });
    if (callErr) {
      console.log(`  ✗ call_logs: ${callErr.message}`);
      failures.push(`Part ${scenario.part} call log`);
      continue;
    }
    console.log(`  ✓ call_logs (${scenario.outcome})`);

    if (scenario.part === 1 || scenario.part === 3) continue;

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
      if (scenario.departmentSlug) {
        const { data: ticket } = await input.admin
          .from("action_tickets")
          .select("department_slug")
          .eq("id", body.action_ticket_id ?? "")
          .maybeSingle();
        const deptOk = ticket?.department_slug === scenario.departmentSlug;
        console.log(
          `  ${deptOk ? "✓" : "⚠"} department_slug ${ticket?.department_slug ?? "?"} (expected ${scenario.departmentSlug})`,
        );
      }
      if (!categoryOk) {
        failures.push(`Part ${scenario.part} category expected ${scenario.expectedCategory}`);
      }
      if (scenario.part === 5) {
        console.log("  ℹ Part 5 should also trigger SMS to notification_phone if Twilio is configured");
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
  const { managerPhone, probeWebhooks, simulateFivePart, appUrl } = parseArgs();
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
      "id, name, slug, phone_number, notification_phone, fallback_number, greeting, custom_prompt, is_active, niche, call_routing_mode, offers_synced_at, retail_banner",
    )
    .eq("slug", ORG_SLUG)
    .maybeSingle();

  if (error || !org?.id) {
    throw new Error(error?.message ?? `Org ${ORG_SLUG} not found — run seed-kavanaghs-retail-demo.ts first.`);
  }

  const prompt = String(org.custom_prompt ?? "");
  const hasGarreth = prompt.includes("Garreth Ferry");
  const hasMark = prompt.includes("Mark O") && prompt.toLowerCase().includes("toole");
  const hasRealRewards = prompt.includes("0818 220 088");

  const checks: Array<[string, boolean]> = [
    ["Org name is Kavanaghs", org.name === "Kavanaghs SuperValu Donegal Town"],
    ["Retail niche", org.niche === "retail"],
    ["SuperValu banner", org.retail_banner === "supervalu"],
    ["Org active", org.is_active === true],
    ["9508 assigned", org.phone_number === RETAIL_LINE_E164],
    ["Custom prompt compiled", prompt.trim().length > 200],
    ["Store manager Garreth Ferry in prompt", hasGarreth],
    ["Fresh food manager Mark O'Toole in prompt", hasMark],
    ["Real Rewards Helpdesk in prompt", hasRealRewards],
    ["Greeting mentions Kavanaghs", String(org.greeting ?? "").includes("Kavanaghs")],
    ["Notification phone set", Boolean(String(org.notification_phone ?? "").trim())],
    ["Fallback number set", Boolean(String(org.fallback_number ?? "").trim())],
    ["Call routing mode", org.call_routing_mode === "cliste_number"],
    ["National offers synced", Boolean(org.offers_synced_at)],
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

  const { count: offerCount } = await admin
    .from("retail_weekly_offers")
    .select("id", { count: "exact", head: true })
    .eq("retail_banner", "supervalu");
  console.log(`${(offerCount ?? 0) >= 100 ? "✓" : "✗"} National weekly offers rows (${offerCount ?? 0})`);
  if ((offerCount ?? 0) < 100) failures.push("National weekly offers — run SuperValu offers sync");

  const { count: deptCount } = await admin
    .from("store_departments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("active", true);
  console.log(`${(deptCount ?? 0) >= 3 ? "✓" : "✗"} Store departments (${deptCount ?? 0})`);
  if ((deptCount ?? 0) < 3) failures.push("Store departments");

  if (probeWebhooks || simulateFivePart) {
    if (!hasWebhookSecret) {
      failures.push("Cannot probe/simulate without CLISTE_VOICE_WEBHOOK_SECRET");
    } else {
      const localOk = await probeActionTicketWebhook(appUrl, webhookSecret);
      if (!localOk) {
        failures.push(
          `Local webhook probe failed (${appUrl}) — start: npm run dev -- -p 3001`,
        );
      }
      await probeOfferSearch(appUrl, webhookSecret);
      const prodOk = await probeActionTicketWebhook(
        "https://app.hellocara.ie",
        webhookSecret,
      );
      if (!prodOk) {
        console.log(
          "⚠ Production app.hellocara.ie webhooks unavailable — use local dashboard + ngrok for live calls",
        );
      }
    }
  }

  printFivePartScript();

  if (simulateFivePart && hasWebhookSecret) {
    console.log(`\nRunning 5-part simulation against ${appUrl}…`);
    const simFailures = await simulateFivePartDemo({
      admin,
      orgId: org.id,
      appUrl,
      secret: webhookSecret,
    });
    failures.push(...simFailures);
    if (simFailures.length === 0) {
      console.log("\n✓ 5-part simulation passed — check bakery, meat-counter, management tabs");
    }
  } else if (simulateFivePart) {
    console.log("\nSkipped simulation — fix CLISTE_VOICE_WEBHOOK_SECRET first.");
  }

  console.log("\nLive demo tips:");
  console.log("  • Top up LiveKit inference credits (429 quota caused silence on last call)");
  console.log("  • Hang up between each of the 5 calls — tickets appear after hang-up on 9508");
  console.log("  • Hard refresh dashboard; wide viewport (≥1024px) for home charts");
  console.log("  • Recompile prompt: npx tsx scripts/regenerate-kavanaghs-prompt.ts");
  console.log(
    `  • Simulate dry-run: npx tsx scripts/rehearse-kavanaghs-demo.ts --simulate-five-part --app-url ${appUrl}\n`,
  );

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
