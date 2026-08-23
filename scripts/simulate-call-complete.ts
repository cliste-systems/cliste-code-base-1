/**
 * Simulate voice worker POST /api/voice/call-complete payloads (Layer B readiness QA).
 *
 *   npx tsx scripts/simulate-call-complete.ts
 *   npx tsx scripts/simulate-call-complete.ts --email shop@cliste.test
 *   npx tsx scripts/simulate-call-complete.ts --org <uuid> --scenario transfer-verify
 *   npx tsx scripts/simulate-call-complete.ts --all
 *
 * Env (see docs/ops/ENV.md):
 *   CLISTE_VOICE_WEBHOOK_SECRET — shared bearer secret (required)
 *   APP_URL — default http://localhost:3001
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import { createAdminClient } from "../src/utils/supabase/admin";

const SMOKE_TAG = "[smoke test]";
const DEFAULT_EMAIL = "shop@cliste.test";
const DEFAULT_APP_URL = "http://localhost:3001";

type ScenarioId =
  | "answered"
  | "action_created"
  | "transferred"
  | "transfer-verify"
  | "blocked"
  | "spam"
  | "knowledge-gap";

type Scenario = {
  id: ScenarioId;
  label: string;
  body: Record<string, unknown>;
};

function parseArgs() {
  const args = process.argv.slice(2);
  let email = DEFAULT_EMAIL;
  let orgId = "";
  let scenario: ScenarioId | "all" = "all";
  let appUrl = process.env.APP_URL?.trim() || DEFAULT_APP_URL;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) email = args[++i];
    if (args[i] === "--org" && args[i + 1]) orgId = args[++i];
    if (args[i] === "--scenario" && args[i + 1]) {
      scenario = args[++i] as ScenarioId;
    }
    if (args[i] === "--all") scenario = "all";
    if (args[i] === "--app-url" && args[i + 1]) appUrl = args[++i];
  }
  return { email, orgId, scenario, appUrl };
}

async function resolveOrg(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  orgIdArg: string,
): Promise<{ orgId: string; calledNumber: string; name: string }> {
  let orgId = orgIdArg.trim();

  if (!orgId) {
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
    const owner = users.users.find(
      (u) => u.email?.trim().toLowerCase() === email.trim().toLowerCase(),
    );
    if (!owner) throw new Error(`No auth user ${email}`);

    const { data: profile } = await admin
      .from("profiles")
      .select("organization_id, active_organization_id")
      .eq("id", owner.id)
      .maybeSingle();

    orgId =
      (profile?.active_organization_id as string | null) ??
      (profile?.organization_id as string) ??
      "";
    if (!orgId) throw new Error(`No org for ${email}`);
  }

  const { data: org } = await admin
    .from("organizations")
    .select("id, name, phone_number")
    .eq("id", orgId)
    .maybeSingle();

  if (!org?.id) throw new Error(`Organization ${orgId} not found`);

  const calledNumber = String(org.phone_number ?? "").trim();
  if (!calledNumber) {
    throw new Error(
      `Org ${orgId} has no assigned Cliste DID — run assign-phone-to-org or seed-retail-demo-user.`,
    );
  }

  return {
    orgId: org.id as string,
    calledNumber,
    name: String(org.name ?? ""),
  };
}

function buildScenarios(calledNumber: string, orgId: string): Scenario[] {
  const ts = Date.now();
  const sid = (suffix: string) => `RT-TEST-${suffix}-${ts}`;

  return [
    {
      id: "answered",
      label: "General answered enquiry",
      body: {
        called_number: calledNumber,
        organization_id: orgId,
        call_sid: sid("answered"),
        caller_number: "+353871234567",
        caller_name: `${SMOKE_TAG} Stock question caller`,
        duration_seconds: 95,
        outcome: "answered",
        disclosure_confirmed: true,
        ai_summary: `${SMOKE_TAG} Asked about Sunday opening hours — Cara answered.`,
        transcript_review: `${SMOKE_TAG} Caller asked if shop opens late on Sundays.`,
      },
    },
    {
      id: "action_created",
      label: "Enquiry captured for Action Inbox",
      body: {
        called_number: calledNumber,
        organization_id: orgId,
        call_sid: sid("action"),
        caller_number: "+353872345678",
        caller_name: `${SMOKE_TAG} Bulk order caller`,
        duration_seconds: 118,
        outcome: "action_created",
        disclosure_confirmed: true,
        ai_summary: `${SMOKE_TAG} Corporate hamper enquiry — follow-up needed.`,
        transcript_review: `${SMOKE_TAG} Caller wants pricing for 40 hampers.`,
      },
    },
    {
      id: "transferred",
      label: "Department transfer (connected)",
      body: {
        called_number: calledNumber,
        organization_id: orgId,
        call_sid: sid("xfer"),
        caller_number: "+353873456789",
        caller_name: `${SMOKE_TAG} Deli transfer caller`,
        duration_seconds: 142,
        outcome: "transferred",
        disclosure_confirmed: true,
        transfer_department: "Deli / hot food",
        transfer_connected: true,
        ai_summary: `${SMOKE_TAG} Transferred to deli for party platter enquiry.`,
        transcript_review: `${SMOKE_TAG} Caller asked to speak to deli counter.`,
      },
    },
    {
      id: "transfer-verify",
      label: "§5 transfer verification stamp",
      body: {
        called_number: calledNumber,
        organization_id: orgId,
        call_sid: sid("verify"),
        caller_number: "+353874567890",
        caller_name: `${SMOKE_TAG} Verification test`,
        duration_seconds: 45,
        outcome: "transferred",
        disclosure_confirmed: true,
        verification_call: true,
        transfer_connected: true,
        transfer_department: "Customer service",
        ai_summary: `${SMOKE_TAG} Staff transfer verification call.`,
        transcript_review: `${SMOKE_TAG} Verification transfer to customer service DDI.`,
      },
    },
    {
      id: "blocked",
      label: "Blocklisted caller",
      body: {
        called_number: calledNumber,
        organization_id: orgId,
        call_sid: sid("blocked"),
        caller_number: "+353555000099",
        caller_name: "Blocked Caller",
        duration_seconds: 0,
        outcome: "blocked",
        ai_summary: blockedCallSummary(),
        transcript_review: null,
      },
    },
    {
      id: "spam",
      label: "Spam or abuse classification",
      body: {
        called_number: calledNumber,
        organization_id: orgId,
        call_sid: sid("spam"),
        caller_number: "+353875678901",
        caller_name: "Unknown",
        duration_seconds: 22,
        outcome: "spam_or_abuse",
        disclosure_confirmed: false,
        ai_summary: `${SMOKE_TAG} Repeated abusive language — classified spam.`,
        transcript_review: `${SMOKE_TAG} Caller used abusive language after refusal.`,
      },
    },
    {
      id: "knowledge-gap",
      label: "Knowledge gap → Cara Training queue",
      body: {
        called_number: calledNumber,
        organization_id: orgId,
        call_sid: sid("gap"),
        caller_number: "+353876789012",
        caller_name: `${SMOKE_TAG} EV charging caller`,
        duration_seconds: 88,
        outcome: "answered",
        disclosure_confirmed: true,
        ai_summary: `${SMOKE_TAG} Asked about EV charging — gap logged.`,
        transcript_review: `${SMOKE_TAG} Caller asked if EV chargers are free.`,
        knowledge_gaps: [
          {
            topic: "EV charging",
            caller_context: "Caller asked if EV chargers in the car park are free for customers.",
            cara_question:
              "A caller asked about EV charging. What should Cara tell them?",
          },
        ],
      },
    },
  ];
}

function blockedCallSummary(): string {
  return "Caller blocked — on blocklist.";
}

async function postScenario(
  appUrl: string,
  secret: string,
  scenario: Scenario,
): Promise<{ ok: boolean; status: number; body: string }> {
  const url = `${appUrl.replace(/\/$/, "")}/api/voice/call-complete`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(scenario.body),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text };
}

async function main() {
  const secret = process.env.CLISTE_VOICE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error(
      "Set CLISTE_VOICE_WEBHOOK_SECRET in .env.local (same value as voice worker).",
    );
    process.exit(1);
  }

  const { email, orgId, scenario, appUrl } = parseArgs();
  const admin = createAdminClient();
  const { orgId: resolvedOrgId, calledNumber, name } = await resolveOrg(
    admin,
    email,
    orgId,
  );

  const scenarios = buildScenarios(calledNumber, resolvedOrgId);
  const selected =
    scenario === "all"
      ? scenarios
      : scenarios.filter((s) => s.id === scenario);

  if (selected.length === 0) {
    console.error(`Unknown scenario: ${scenario}`);
    process.exit(1);
  }

  console.log(`\nSimulating call-complete for ${name}`);
  console.log(`  Org:     ${resolvedOrgId}`);
  console.log(`  DID:     ${calledNumber}`);
  console.log(`  Target:  ${appUrl}/api/voice/call-complete`);
  console.log(`  Runs:    ${selected.map((s) => s.id).join(", ")}\n`);

  let failures = 0;
  for (const run of selected) {
    const result = await postScenario(appUrl, secret, run);
    const mark = result.ok ? "✓" : "✗";
    console.log(`${mark} ${run.id}: HTTP ${result.status}`);
    if (!result.ok) {
      failures += 1;
      console.log(`    ${result.body.slice(0, 240)}`);
    } else {
      try {
        const json = JSON.parse(result.body) as { ok?: boolean; call_log_id?: string };
        if (json.call_log_id) console.log(`    call_log_id: ${json.call_log_id}`);
      } catch {
        /* non-json ok */
      }
    }
  }

  console.log(
    failures === 0
      ? "\n✓ All scenarios posted successfully\n"
      : `\n✗ ${failures} scenario(s) failed — is the app running at ${appUrl}?\n`,
  );
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
