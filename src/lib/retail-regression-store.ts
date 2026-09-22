import "server-only";

import { createHash } from "node:crypto";

import { resolveAdminDemoCallLine } from "@/lib/admin-demo-call";
import type { RetailDiscoveryScenarioDraft } from "@/lib/retail-discovery";
import { buildDefaultRetailRegressionScenarios } from "@/lib/retail-regression-library";
import {
  classifyRegressionFailure,
  type RetailRegressionExecution,
  type RetailRegressionGrade,
  type RetailRegressionScenario,
  type RetailRegressionScenarioHistory,
} from "@/lib/retail-regression";
import { createAdminClient } from "@/utils/supabase/admin";

type ResultHistoryRow = {
  scenario_id: string;
  status: "pass" | "fail" | "error";
  failure_signature: string | null;
  created_at: string;
};

function asScenario(row: Record<string, unknown>): RetailRegressionScenario {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    category: String(row.category) as RetailRegressionScenario["category"],
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    turns: Array.isArray(row.turns)
      ? (row.turns as RetailRegressionScenario["turns"])
      : [],
    expectations:
      row.expectations && typeof row.expectations === "object"
        ? (row.expectations as RetailRegressionScenario["expectations"])
        : { summary: "No regression expectation configured." },
    active: Boolean(row.active),
    source: String(row.source) as RetailRegressionScenario["source"],
  };
}

async function requireRegressionLine(calledNumber: string) {
  const line = await resolveAdminDemoCallLine(calledNumber);
  if (!line) throw new Error("Invalid demo line.");
  return line;
}

export async function seedRetailRegressionScenarios(calledNumber: string): Promise<number> {
  const line = await requireRegressionLine(calledNumber);
  const admin = createAdminClient();
  const defaults = buildDefaultRetailRegressionScenarios();

  const rows = defaults.map((scenario) => ({
    organization_id: line.orgId,
    slug: scenario.slug,
    title: scenario.title,
    category: scenario.category,
    tags: scenario.tags,
    turns: scenario.turns,
    expectations: scenario.expectations,
    source: scenario.source,
    active: scenario.active,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await admin
    .from("retail_regression_scenarios")
    .upsert(rows, { onConflict: "organization_id,slug" });

  if (error) throw new Error(error.message);
  return rows.length;
}

export async function loadRetailRegressionSuite(calledNumber: string): Promise<{
  storeLabel: string;
  organizationId: string;
  scenarios: RetailRegressionScenario[];
  recentRuns: Array<Record<string, unknown>>;
}> {
  const line = await requireRegressionLine(calledNumber);
  await seedRetailRegressionScenarios(calledNumber);

  const admin = createAdminClient();
  const { data: scenarioRows, error: scenarioError } = await admin
    .from("retail_regression_scenarios")
    .select(
      "id,slug,title,category,tags,turns,expectations,source,active,created_at,updated_at",
    )
    .eq("organization_id", line.orgId)
    .eq("active", true)
    .order("category", { ascending: true })
    .order("slug", { ascending: true });

  if (scenarioError) throw new Error(scenarioError.message);

  const scenarios = (scenarioRows ?? []).map((row) =>
    asScenario(row as Record<string, unknown>),
  );
  const scenarioIds = scenarios.map((scenario) => scenario.id);

  const historyByScenario = new Map<string, ResultHistoryRow[]>();
  if (scenarioIds.length > 0) {
    const { data: historyRows, error: historyError } = await admin
      .from("retail_regression_results")
      .select("scenario_id,status,failure_signature,created_at")
      .in("scenario_id", scenarioIds)
      .order("created_at", { ascending: false })
      .limit(4000);

    if (historyError) throw new Error(historyError.message);

    for (const row of (historyRows ?? []) as ResultHistoryRow[]) {
      const rows = historyByScenario.get(row.scenario_id) ?? [];
      rows.push(row);
      historyByScenario.set(row.scenario_id, rows);
    }
  }

  for (const scenario of scenarios) {
    const rows = historyByScenario.get(scenario.id) ?? [];
    let consecutiveFailures = 0;
    for (const row of rows) {
      if (row.status === "pass") break;
      consecutiveFailures += 1;
    }

    const history: RetailRegressionScenarioHistory = {
      lastStatus: rows[0]?.status ?? null,
      lastRunAt: rows[0]?.created_at ?? null,
      recentStatuses: rows.slice(0, 5).map((row) => row.status),
      totalRuns: rows.length,
      totalFailures: rows.filter((row) => row.status !== "pass").length,
      consecutiveFailures,
    };
    scenario.history = history;
  }

  const { data: recentRuns, error: runError } = await admin
    .from("retail_regression_runs")
    .select(
      "id,status,total,passed,failed,errored,started_at,completed_at,called_number",
    )
    .eq("organization_id", line.orgId)
    .order("started_at", { ascending: false })
    .limit(10);

  if (runError) throw new Error(runError.message);

  return {
    storeLabel: line.orgName,
    organizationId: line.orgId,
    scenarios,
    recentRuns: (recentRuns ?? []) as Array<Record<string, unknown>>,
  };
}

export async function persistRetailDiscoveryScenarios(input: {
  calledNumber: string;
  generationId: string;
  batchIndex: number;
  drafts: RetailDiscoveryScenarioDraft[];
}): Promise<RetailRegressionScenario[]> {
  const line = await requireRegressionLine(input.calledNumber);
  const admin = createAdminClient();
  const generationId = input.generationId.trim();

  if (!generationId || input.drafts.length === 0) return [];

  const rows = input.drafts.map((draft, index) => {
    const fingerprint = createHash("sha1")
      .update(
        [
          generationId,
          String(input.batchIndex),
          String(index),
          draft.discoveryProfile,
          draft.title,
          draft.turns.map((turn) => turn.caller).join("\n"),
        ].join("|"),
      )
      .digest("hex")
      .slice(0, 16);

    return {
      organization_id: line.orgId,
      slug: `discovery-${generationId.slice(0, 8)}-${input.batchIndex}-${index}-${fingerprint}`,
      title: draft.title,
      category: draft.category,
      tags: draft.tags,
      turns: draft.turns,
      expectations: draft.expectations,
      source: "variant",
      active: false,
      updated_at: new Date().toISOString(),
    };
  });

  const { data, error } = await admin
    .from("retail_regression_scenarios")
    .insert(rows)
    .select(
      "id,slug,title,category,tags,turns,expectations,source,active,created_at,updated_at",
    );

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => asScenario(row as Record<string, unknown>));
}

export async function promoteRetailDiscoveryScenario(input: {
  calledNumber: string;
  scenarioId: string;
}): Promise<void> {
  const line = await requireRegressionLine(input.calledNumber);
  const admin = createAdminClient();

  const { data: row, error: loadError } = await admin
    .from("retail_regression_scenarios")
    .select("id,tags,source")
    .eq("id", input.scenarioId)
    .eq("organization_id", line.orgId)
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);
  if (!row) throw new Error("Discovery scenario not found.");

  const tags = Array.isArray(row.tags) ? row.tags.map(String) : [];
  if (!tags.includes("discovery")) {
    throw new Error("Only discovery scenarios can be promoted here.");
  }

  const nextTags = [...new Set([...tags, "promoted-discovery"])];
  const { error } = await admin
    .from("retail_regression_scenarios")
    .update({
      source: "manual",
      active: true,
      tags: nextTags,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.scenarioId)
    .eq("organization_id", line.orgId);

  if (error) throw new Error(error.message);
}

export async function startRetailRegressionRun(input: {
  calledNumber: string;
  total: number;
}): Promise<{ runId: string }> {
  const line = await requireRegressionLine(input.calledNumber);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("retail_regression_runs")
    .insert({
      organization_id: line.orgId,
      called_number: line.e164,
      status: "running",
      total: Math.max(0, Math.trunc(input.total)),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { runId: String(data.id) };
}

export async function recordRetailRegressionResult(input: {
  runId: string;
  scenarioId: string;
  grade: RetailRegressionGrade;
  execution: RetailRegressionExecution;
}): Promise<{
  issueKind: "new_failure" | "recurring" | "regression_returned" | null;
  occurrenceCount: number;
}> {
  const admin = createAdminClient();

  const { data: scenarioMeta, error: scenarioMetaError } = await admin
    .from("retail_regression_scenarios")
    .select("organization_id,tags,source")
    .eq("id", input.scenarioId)
    .maybeSingle();

  if (scenarioMetaError) throw new Error(scenarioMetaError.message);

  const scenarioTags = Array.isArray(scenarioMeta?.tags)
    ? scenarioMeta.tags.map(String)
    : [];
  const discoveryFamily = scenarioTags.find((tag) =>
    tag.startsWith("discovery-family:"),
  );
  const isDiscovery =
    scenarioMeta?.source === "variant" &&
    scenarioTags.includes("discovery") &&
    Boolean(discoveryFamily);

  let recurrence: {
    issueKind: "new_failure" | "recurring" | "regression_returned" | null;
    occurrenceCount: number;
  };

  if (
    isDiscovery &&
    input.grade.status !== "pass" &&
    input.grade.failureSignature &&
    scenarioMeta?.organization_id &&
    discoveryFamily
  ) {
    const { data: familyScenarios, error: familyError } = await admin
      .from("retail_regression_scenarios")
      .select("id")
      .eq("organization_id", scenarioMeta.organization_id)
      .eq("source", "variant")
      .contains("tags", ["discovery", discoveryFamily])
      .limit(1000);

    if (familyError) throw new Error(familyError.message);

    const familyScenarioIds = (familyScenarios ?? []).map((row) => String(row.id));
    let priorSameSignatureCount = 0;

    if (familyScenarioIds.length > 0) {
      const { count, error: signatureError } = await admin
        .from("retail_regression_results")
        .select("id", { count: "exact", head: true })
        .in("scenario_id", familyScenarioIds)
        .eq("failure_signature", input.grade.failureSignature);

      if (signatureError) throw new Error(signatureError.message);
      priorSameSignatureCount = count ?? 0;
    }

    recurrence =
      priorSameSignatureCount > 0
        ? {
            issueKind: "recurring",
            occurrenceCount: priorSameSignatureCount + 1,
          }
        : { issueKind: "new_failure", occurrenceCount: 1 };
  } else {
    const { data: priorRows, error: priorError } = await admin
      .from("retail_regression_results")
      .select("status,failure_signature")
      .eq("scenario_id", input.scenarioId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (priorError) throw new Error(priorError.message);

    recurrence = classifyRegressionFailure({
      currentStatus: input.grade.status,
      currentFailureSignature: input.grade.failureSignature,
      prior: ((priorRows ?? []) as Array<{
        status: "pass" | "fail" | "error";
        failure_signature: string | null;
      }>).map((row) => ({
        status: row.status,
        failureSignature: row.failure_signature,
      })),
    });
  }

  const assistantText = input.execution.turns
    .map((turn) => turn.assistant)
    .filter(Boolean)
    .join("\n\n");

  const tools = input.execution.turns.flatMap((turn) =>
    turn.tools.map((tool) => ({
      caller: turn.caller,
      name: tool.name,
      args: tool.args,
    })),
  );

  const { error } = await admin.from("retail_regression_results").upsert(
    {
      run_id: input.runId,
      scenario_id: input.scenarioId,
      status: input.grade.status,
      reasons: input.grade.reasons,
      failure_signature: input.grade.failureSignature,
      issue_kind: recurrence.issueKind,
      occurrence_count: recurrence.occurrenceCount,
      duration_ms: input.execution.durationMs,
      transcript: input.execution.turns,
      tools,
      assistant_text: assistantText,
    },
    { onConflict: "run_id,scenario_id" },
  );

  if (error) throw new Error(error.message);
  return recurrence;
}

export async function finishRetailRegressionRun(input: {
  runId: string;
  status?: "completed" | "cancelled" | "error";
  passed: number;
  failed: number;
  errored: number;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("retail_regression_runs")
    .update({
      status: input.status ?? "completed",
      passed: Math.max(0, Math.trunc(input.passed)),
      failed: Math.max(0, Math.trunc(input.failed)),
      errored: Math.max(0, Math.trunc(input.errored)),
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.runId);

  if (error) throw new Error(error.message);
}
