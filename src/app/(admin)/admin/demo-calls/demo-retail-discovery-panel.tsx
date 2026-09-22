"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Loader2,
  Play,
  Save,
  Sparkles,
  StopCircle,
  XCircle,
} from "lucide-react";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import {
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-interactive";
import type { AdminDemoCallLine } from "@/lib/admin-demo-call-lines";
import { formatIrishE164Display } from "@/lib/admin-demo-call-lines";
import {
  formatRetailRegressionReport,
  gradeRetailRegressionScenario,
  type RetailRegressionExecution,
  type RetailRegressionGrade,
  type RetailRegressionScenario,
} from "@/lib/retail-regression";
import {
  runIsolatedTextRehearsalConversation,
  startTextRehearsalSession,
} from "@/lib/text-rehearsal-client";
import { cn } from "@/lib/utils";

type DiscoveryCount = 100 | 250 | 500;
type RunResult = RetailRegressionExecution &
  RetailRegressionGrade & {
    issueKind: "new_failure" | "recurring" | "regression_returned" | null;
    occurrenceCount: number;
  };

const REGRESSION_API = "/api/admin/demo-call/text-rehearsal/regression";
const DISCOVERY_API = "/api/admin/demo-call/text-rehearsal/discovery";

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}

export function DemoRetailDiscoveryPanel({ line }: { line: AdminDemoCallLine }) {
  const [targetCount, setTargetCount] = useState<DiscoveryCount>(100);
  const [scenarios, setScenarios] = useState<RetailRegressionScenario[]>([]);
  const [results, setResults] = useState<Map<string, RunResult>>(new Map());
  const [generating, setGenerating] = useState(false);
  const [running, setRunning] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ done: 0, total: 0 });
  const [runProgress, setRunProgress] = useState({ done: 0, total: 0 });
  const [concurrency, setConcurrency] = useState<1 | 3 | 5>(3);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStartedAt, setRunStartedAt] = useState<string | null>(null);
  const [runCompletedAt, setRunCompletedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [promoted, setPromoted] = useState<Set<string>>(new Set());
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const stopRequested = useRef(false);

  const summary = useMemo(() => {
    const values = [...results.values()];
    return {
      passed: values.filter((row) => row.status === "pass").length,
      failed: values.filter((row) => row.status === "fail").length,
      errored: values.filter((row) => row.status === "error").length,
    };
  }, [results]);

  const executeScenario = async (
    scenario: RetailRegressionScenario,
    activeRunId: string,
  ): Promise<RunResult> => {
    const started = performance.now();
    let execution: RetailRegressionExecution;

    try {
      const session = await startTextRehearsalSession(line.e164);
      const turnResults = await runIsolatedTextRehearsalConversation({
        session,
        callerTurns: scenario.turns.map((turn) => turn.caller),
      });

      execution = {
        durationMs: Math.max(0, Math.round(performance.now() - started)),
        turns: turnResults.map((turn) => ({
          caller: turn.caller,
          assistant: turn.assistant,
          tools: turn.tools,
          transcriptLines: turn.transcriptLines,
          error: turn.error ?? null,
        })),
        error: turnResults.find((turn) => turn.error)?.error ?? null,
      };
    } catch (runError) {
      execution = {
        durationMs: Math.max(0, Math.round(performance.now() - started)),
        turns: scenario.turns.map((turn) => ({
          caller: turn.caller,
          assistant: "",
          tools: [],
          transcriptLines: [`Caller: ${turn.caller}`],
          error: null,
        })),
        error:
          runError instanceof Error
            ? runError.message
            : "Discovery scenario execution failed.",
      };
    }

    const grade = gradeRetailRegressionScenario(scenario, execution);
    let recurrence: Pick<RunResult, "issueKind" | "occurrenceCount"> = {
      issueKind: null,
      occurrenceCount: 0,
    };

    try {
      recurrence = await postJson<Pick<RunResult, "issueKind" | "occurrenceCount">>(
        REGRESSION_API,
        {
          action: "record_result",
          runId: activeRunId,
          scenarioId: scenario.id,
          grade,
          execution,
        },
      );
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Could not save discovery result.";
      if (grade.status === "pass") {
        grade.status = "error";
        grade.reasons.push(message);
        grade.failureSignature = grade.reasons.join(" || ").toLowerCase();
      } else {
        grade.reasons.push(message);
      }
    }

    return { ...execution, ...grade, ...recurrence };
  };

  const runGenerated = async (generated: RetailRegressionScenario[]) => {
    if (!generated.length) return;

    stopRequested.current = false;
    setRunning(true);
    setRunProgress({ done: 0, total: generated.length });
    const startedAt = new Date().toISOString();
    setRunStartedAt(startedAt);
    setRunCompletedAt(null);

    const localResults = new Map<string, RunResult>();
    let nextIndex = 0;
    let activeRunId: string | null = null;

    try {
      const start = await postJson<{ runId: string }>(REGRESSION_API, {
        action: "start_run",
        calledNumber: line.e164,
        total: generated.length,
      });
      activeRunId = start.runId;
      setRunId(start.runId);

      const worker = async () => {
        while (!stopRequested.current) {
          const index = nextIndex;
          nextIndex += 1;
          if (index >= generated.length) return;

          const scenario = generated[index]!;
          const result = await executeScenario(scenario, start.runId);
          localResults.set(scenario.id, result);
          setResults(new Map(localResults));
          setRunProgress({ done: localResults.size, total: generated.length });
        }
      };

      await Promise.all(
        Array.from(
          { length: Math.min(concurrency, generated.length) },
          () => worker(),
        ),
      );

      const values = [...localResults.values()];
      await postJson(REGRESSION_API, {
        action: "finish_run",
        runId: start.runId,
        status: stopRequested.current ? "cancelled" : "completed",
        passed: values.filter((row) => row.status === "pass").length,
        failed: values.filter((row) => row.status === "fail").length,
        errored: values.filter((row) => row.status === "error").length,
      });
      setRunCompletedAt(new Date().toISOString());
    } catch (runError) {
      setError(
        runError instanceof Error ? runError.message : "Discovery run failed.",
      );
      if (activeRunId) {
        const values = [...localResults.values()];
        await postJson(REGRESSION_API, {
          action: "finish_run",
          runId: activeRunId,
          status: "error",
          passed: values.filter((row) => row.status === "pass").length,
          failed: values.filter((row) => row.status === "fail").length,
          errored: values.filter((row) => row.status === "error").length,
        }).catch(() => undefined);
      }
    } finally {
      setRunning(false);
    }
  };

  const generateAndRun = async () => {
    if (generating || running) return;

    setError(null);
    setScenarios([]);
    setResults(new Map());
    setPromoted(new Set());
    setRunId(null);
    setRunStartedAt(null);
    setRunCompletedAt(null);
    stopRequested.current = false;

    setGenerationProgress({ done: 0, total: targetCount });
    setGenerating(true);

    const generated: RetailRegressionScenario[] = [];

    try {
      let batchIndex = 1;
      const maxBatches = Math.ceil(targetCount / 10) * 2;
      while (
        generated.length < targetCount &&
        batchIndex <= maxBatches &&
        !stopRequested.current
      ) {
        const remaining = targetCount - generated.length;
        const safeCount: 10 | 15 | 20 | 25 =
          remaining >= 25
            ? 25
            : remaining >= 20
              ? 20
              : remaining >= 15
                ? 15
                : 10;

        const response = await postJson<{ scenarios: RetailRegressionScenario[] }>(
          DISCOVERY_API,
          {
            action: "generate",
            calledNumber: line.e164,
            count: safeCount,
            batchIndex,
          },
        );

        const needed = targetCount - generated.length;
        generated.push(...response.scenarios.slice(0, needed));
        setScenarios([...generated]);
        setGenerationProgress({
          done: Math.min(generated.length, targetCount),
          total: targetCount,
        });
        batchIndex += 1;
      }

      if (!stopRequested.current && generated.length < targetCount) {
        throw new Error(
          `Only ${generated.length}/${targetCount} usable discovery scenarios were generated. Run again to retry.`,
        );
      }
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Discovery generation failed.",
      );
    } finally {
      setGenerating(false);
    }

    if (!stopRequested.current && generated.length > 0) {
      await runGenerated(generated);
    }
  };

  const promoteScenario = async (scenarioId: string) => {
    if (promoted.has(scenarioId) || promotingId) return;
    setPromotingId(scenarioId);
    setError(null);
    try {
      await postJson(DISCOVERY_API, {
        action: "promote",
        calledNumber: line.e164,
        scenarioId,
      });
      setPromoted((previous) => new Set(previous).add(scenarioId));
    } catch (promoteError) {
      setError(
        promoteError instanceof Error
          ? promoteError.message
          : "Could not promote discovery scenario.",
      );
    } finally {
      setPromotingId(null);
    }
  };

  const copyReport = async () => {
    if (!scenarios.length || !results.size) return;
    const report = formatRetailRegressionReport({
      storeLabel: line.orgName,
      calledNumber: line.e164,
      runId,
      startedAt: runStartedAt ?? new Date().toISOString(),
      completedAt: runCompletedAt,
      scenarios,
      results,
    });
    await navigator.clipboard.writeText(report);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const busy = generating || running;
  const failedScenarios = scenarios.filter((scenario) => {
    const result = results.get(scenario.id);
    return result?.status === "fail" || result?.status === "error";
  });

  return (
    <AdminSectionCard
      title="Discovery / Stress"
      description={`${line.orgName} · ${formatIrishE164Display(line.e164)} · fresh adversarial scenarios every run`}
      className="flex min-h-0 flex-1 flex-col"
      contentClassName="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-slate-900">
                Find failures we have not written tests for yet
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                AI creates brand-new Irish supermarket calls, including odd products,
                STT-like wording, category collisions, changing intent, vague choices,
                multi-question calls and awkward 2–4 turn follow-ups. Failed cases stay
                outside the permanent bank until you promote them.
              </p>
            </div>
            <Sparkles className="size-5 text-slate-500" aria-hidden />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {([100, 250, 500] as const).map((count) => (
            <button
              key={count}
              type="button"
              disabled={busy}
              onClick={() => setTargetCount(count)}
              className={cn(
                adminSecondaryButtonClass,
                targetCount === count &&
                  "border-gray-900 bg-gray-900 text-white hover:bg-gray-800",
              )}
            >
              {count} fresh tests
            </button>
          ))}

          <button
            type="button"
            disabled={busy}
            onClick={() => void generateAndRun()}
            className={adminPrimaryButtonClass}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Play className="size-3.5" aria-hidden />
            )}
            Generate & run {targetCount}
          </button>

          {busy ? (
            <button
              type="button"
              onClick={() => {
                stopRequested.current = true;
              }}
              className={adminSecondaryButtonClass}
            >
              <StopCircle className="size-3.5" aria-hidden />
              Stop after active work
            </button>
          ) : null}

          <label className="ml-auto flex items-center gap-2 text-xs text-gray-600">
            Parallel
            <select
              value={concurrency}
              disabled={busy}
              onChange={(event) =>
                setConcurrency(Number(event.target.value) as 1 | 3 | 5)
              }
              className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900"
            >
              <option value={1}>1</option>
              <option value={3}>3</option>
              <option value={5}>5</option>
            </select>
          </label>

          <button
            type="button"
            disabled={!results.size}
            onClick={() => void copyReport()}
            className={adminSecondaryButtonClass}
          >
            <Clipboard className="size-3.5" aria-hidden />
            {copied ? "Copied" : "Copy full report"}
          </button>
        </div>

        {generationProgress.total > 0 ? (
          <div className="shrink-0">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
              <span>
                {generating ? "Generating" : "Generated"} · {generationProgress.done}/
                {generationProgress.total}
              </span>
              <span>
                {generationProgress.total
                  ? `${Math.round(
                      (generationProgress.done / generationProgress.total) * 100,
                    )}%`
                  : "0%"}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full bg-gray-900 transition-[width]"
                style={{
                  width: `${
                    generationProgress.total
                      ? (generationProgress.done / generationProgress.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        ) : null}

        {runProgress.total > 0 ? (
          <div className="shrink-0">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
              <span>
                {running ? "Stress testing Cara" : "Last discovery run"} ·{" "}
                {runProgress.done}/{runProgress.total}
              </span>
              <span>
                {runProgress.total
                  ? `${Math.round((runProgress.done / runProgress.total) * 100)}%`
                  : "0%"}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full bg-gray-900 transition-[width]"
                style={{
                  width: `${
                    runProgress.total
                      ? (runProgress.done / runProgress.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        ) : null}

        {results.size > 0 ? (
          <div className="grid shrink-0 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Passed</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {summary.passed}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                New failures
              </p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {summary.failed}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Errors</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {summary.errored}
              </p>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="shrink-0 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        {results.size > 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200">
            {(failedScenarios.length ? failedScenarios : scenarios).map((scenario) => {
              const result = results.get(scenario.id);
              if (!result) return null;
              const isPromoted = promoted.has(scenario.id);

              return (
                <details
                  key={scenario.id}
                  className="group border-b border-gray-200 last:border-b-0"
                  open={result.status !== "pass"}
                >
                  <summary className="flex cursor-pointer list-none items-start gap-3 p-3 hover:bg-gray-50">
                    <div className="mt-0.5 shrink-0">
                      {result.status === "pass" ? (
                        <CheckCircle2 className="size-4 text-emerald-700" aria-hidden />
                      ) : result.status === "error" ? (
                        <AlertTriangle className="size-4 text-amber-700" aria-hidden />
                      ) : (
                        <XCircle className="size-4 text-red-700" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {scenario.title}
                        </p>
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-600">
                          {scenario.category.replace(/_/g, " ")}
                        </span>
                        {isPromoted ? (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-800">
                            Permanent regression
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-gray-600">
                        Caller: {scenario.turns[0]?.caller}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">
                      {(result.durationMs / 1000).toFixed(1)}s
                    </span>
                  </summary>

                  <div className="space-y-3 border-t border-gray-100 bg-gray-50 p-4 text-xs">
                    <div>
                      <p className="font-medium text-gray-900">Expected</p>
                      <p className="mt-1 text-gray-600">
                        {scenario.expectations.summary}
                      </p>
                    </div>

                    <div className="space-y-2 font-mono">
                      {result.turns.map((turn, index) => (
                        <div key={`${scenario.id}-turn-${index}`}>
                          <p className="text-blue-900">Caller: {turn.caller}</p>
                          <p className="whitespace-pre-wrap text-gray-900">
                            Cara: {turn.assistant || "(no reply)"}
                          </p>
                          {turn.tools.map((tool, toolIndex) => (
                            <p
                              key={`${scenario.id}-tool-${toolIndex}`}
                              className="whitespace-pre-wrap text-violet-800"
                            >
                              [Tool] {tool.name} {JSON.stringify(tool.args)}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>

                    {result.reasons.length ? (
                      <div>
                        <p className="font-medium text-red-800">Why it failed</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-red-700">
                          {result.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {result.status !== "pass" ? (
                      <button
                        type="button"
                        disabled={isPromoted || promotingId === scenario.id}
                        onClick={() => void promoteScenario(scenario.id)}
                        className={adminSecondaryButtonClass}
                      >
                        {promotingId === scenario.id ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Save className="size-3.5" aria-hidden />
                        )}
                        {isPromoted ? "Added to regression bank" : "Promote to regression"}
                      </button>
                    ) : null}
                  </div>
                </details>
              );
            })}
          </div>
        ) : scenarios.length > 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Generated scenarios
            </p>
            <div className="mt-2 space-y-2">
              {scenarios.slice(-50).map((scenario) => (
                <div key={scenario.id} className="rounded-md bg-white p-2 text-xs">
                  <p className="font-medium text-gray-900">{scenario.title}</p>
                  <p className="mt-0.5 text-gray-600">{scenario.turns[0]?.caller}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
            Pick 100, 250 or 500 and start a fresh discovery run.
          </div>
        )}
      </div>
    </AdminSectionCard>
  );
}
