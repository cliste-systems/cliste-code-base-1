import "server-only";

import { resolveAdminDemoCallLine } from "@/lib/admin-demo-call";
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

  const { data: priorRows, error: priorError } = await admin
    .from("retail_regression_results")
    .select("status,failure_signature")
    .eq("scenario_id", input.scenarioId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (priorError) throw new Error(priorError.message);

  const recurrence = classifyRegressionFailure({
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


export async function createRetailDiscoveryScenarios(input: {
  calledNumber: string;
  drafts: Array<{
    discoveryKey: string;
    title: string;
    category: RetailRegressionScenario["category"];
    tags: string[];
    turns: RetailRegressionScenario["turns"];
    expectations: RetailRegressionScenario["expectations"];
  }>;
}): Promise<RetailRegressionScenario[]> {
  const line = await requireRegressionLine(input.calledNumber);
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const rows = input.drafts.map((draft) => ({
    organization_id: line.orgId,
    slug: `discovery-${draft.discoveryKey}`,
    title: draft.title,
    category: draft.category,
    tags: [...new Set(["discovery", ...draft.tags])],
    turns: draft.turns,
    expectations: draft.expectations,
    source: "variant" as const,
    active: false,
    updated_at: now,
  }));

  const { data, error } = await admin
    .from("retail_regression_scenarios")
    .insert(rows)
    .select("id,slug,title,category,tags,turns,expectations,source,active");

  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<Record<string, unknown>>).map(asScenario);
}

export async function promoteRetailDiscoveryScenario(input: {
  calledNumber: string;
  scenarioId: string;
}): Promise<RetailRegressionScenario> {
  const line = await requireRegressionLine(input.calledNumber);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("retail_regression_scenarios")
    .update({
      source: "manual",
      active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.scenarioId)
    .eq("organization_id", line.orgId)
    .eq("source", "variant")
    .select("id,slug,title,category,tags,turns,expectations,source,active")
    .single();

  if (error) throw new Error(error.message);
  return asScenario(data as Record<string, unknown>);
}
