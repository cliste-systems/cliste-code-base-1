"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  TestTube2,
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
type Concurrency = 1 | 3 | 5;
type ResultFilter = "all" | "failing" | "passing";

type RunResult = RetailRegressionExecution &
  RetailRegressionGrade & {
    issueKind: "new_failure" | "recurring" | "regression_returned" | null;
    occurrenceCount: number;
  };

const REGRESSION_API = "/api/admin/demo-call/text-rehearsal/regression";
const DISCOVERY_API =
  "/api/admin/demo-call/text-rehearsal/regression/discovery";

async function postJson<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? "Discovery request failed.");
  }
  return data;
}

function discoveryFamily(scenario: RetailRegressionScenario): string {
  const tag = scenario.tags.find((value) =>
    value.startsWith("discovery-family:"),
  );
  return (tag?.split(":")[1] ?? "discovery").replace(/_/g, " ");
}

function issueLabel(result: RunResult): string | null {
  if (!result.issueKind) return null;
  if (result.issueKind === "new_failure") return "New failure";
  if (result.issueKind === "regression_returned") return "Regression returned";
  return `Recurring · occurrence ${result.occurrenceCount}`;
}

export function DemoRetailDiscoveryPanel({
  line,
}: {
  line: AdminDemoCallLine;
}) {
  const [count, setCount] = useState<DiscoveryCount>(100);
  const [concurrency, setConcurrency] = useState<Concurrency>(5);
  const [scenarios, setScenarios] = useState<RetailRegressionScenario[]>([]);
  const [results, setResults] = useState<Map<string, RunResult>>(new Map());
  const [generating, setGenerating] = useState(false);
  const [running, setRunning] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({
    done: 0,
    total: 0,
  });
  const [runProgress, setRunProgress] = useState({ done: 0, total: 0 });
  const [runId, setRunId] = useState<string | null>(null);
  const [runStartedAt, setRunStartedAt] = useState<string | null>(null);
  const [runCompletedAt, setRunCompletedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [promoted, setPromoted] = useState<Set<string>>(new Set());
  const [promoting, setPromoting] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ResultFilter>("failing");
  const stopRequested = useRef(false);

  const summary = useMemo(() => {
    const values = [...results.values()];
    return {
      passed: values.filter((row) => row.status === "pass").length,
      failed: values.filter((row) => row.status === "fail").length,
      errored: values.filter((row) => row.status === "error").length,
      recurring: values.filter((row) => row.issueKind === "recurring").length,
    };
  }, [results]);

  const visibleScenarios = useMemo(
    () =>
      scenarios.filter((scenario) => {
        const result = results.get(scenario.id);
        if (filter === "failing") {
          return result?.status === "fail" || result?.status === "error";
        }
        if (filter === "passing") return result?.status === "pass";
        return true;
      }),
    [filter, results, scenarios],
  );

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
    } catch (cause) {
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
          cause instanceof Error ? cause.message : "Discovery scenario failed.",
      };
    }

    const grade = gradeRetailRegressionScenario(scenario, execution);
    let recurrence: {
      issueKind: RunResult["issueKind"];
      occurrenceCount: number;
    } = { issueKind: null, occurrenceCount: 0 };

    try {
      recurrence = await postJson<{
        issueKind: RunResult["issueKind"];
        occurrenceCount: number;
      }>(REGRESSION_API, {
        action: "record_result",
        runId: activeRunId,
        scenarioId: scenario.id,
        grade,
        execution,
      });
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not save discovery result.";
      if (grade.status === "pass") {
        grade.status = "error";
        grade.failureSignature = message.toLowerCase();
      }
      grade.reasons.push(message);
    }

    return { ...execution, ...grade, ...recurrence };
  };

  const generateFreshScenarios = async (
    total: DiscoveryCount,
  ): Promise<RetailRegressionScenario[]> => {
    const generationId = crypto.randomUUID();
    const batchCount = Math.ceil(total / 20);
    const collected: RetailRegressionScenario[] = [];
    const recentOpenings: string[] = [];
    let nextBatch = 0;
    let generationError: Error | null = null;

    setGenerationProgress({ done: 0, total });

    const worker = async () => {
      while (!stopRequested.current && !generationError) {
        const batchIndex = nextBatch;
        nextBatch += 1;
        if (batchIndex >= batchCount) return;

        try {
          const remaining = total - batchIndex * 20;
          const batchSize = Math.min(20, remaining);
          const response = await postJson<{
            scenarios: RetailRegressionScenario[];
          }>(DISCOVERY_API, {
            action: "generate_batch",
            calledNumber: line.e164,
            generationId,
            batchIndex,
            count: batchSize,
            avoidExamples: recentOpenings.slice(-40),
          });

          collected.push(...response.scenarios);
          for (const scenario of response.scenarios) {
            const opening = scenario.turns[0]?.caller;
            if (opening) recentOpenings.push(opening);
          }
          setScenarios([...collected]);
          setGenerationProgress({
            done: Math.min(total, collected.length),
            total,
          });
        } catch (cause) {
          generationError =
            cause instanceof Error
              ? cause
              : new Error("Discovery generation failed.");
        }
      }
    };

    await Promise.all([worker(), worker()]);
    if (generationError) throw generationError;
    return collected.slice(0, total);
  };

  const runGeneratedScenarios = async (
    generated: RetailRegressionScenario[],
  ) => {
    if (generated.length === 0 || stopRequested.current) return;

    setRunning(true);
    setRunProgress({ done: 0, total: generated.length });
    const startedAt = new Date().toISOString();
    setRunStartedAt(startedAt);

    const start = await postJson<{ runId: string }>(REGRESSION_API, {
      action: "start_run",
      calledNumber: line.e164,
      total: generated.length,
    });
    setRunId(start.runId);

    const localResults = new Map<string, RunResult>();
    let nextIndex = 0;

    try {
      const worker = async () => {
        while (!stopRequested.current) {
          const index = nextIndex;
          nextIndex += 1;
          if (index >= generated.length) return;

          const scenario = generated[index]!;
          try {
            const result = await executeScenario(scenario, start.runId);
            localResults.set(scenario.id, result);
          } catch (cause) {
            const message =
              cause instanceof Error
                ? cause.message
                : "Could not record discovery scenario.";
            localResults.set(scenario.id, {
              status: "error",
              reasons: [message],
              failureSignature: message.toLowerCase(),
              issueKind: null,
              occurrenceCount: 0,
              durationMs: 0,
              error: message,
              turns: scenario.turns.map((turn) => ({
                caller: turn.caller,
                assistant: "",
                tools: [],
                transcriptLines: [`Caller: ${turn.caller}`],
                error: message,
              })),
            });
          }
          setResults(new Map(localResults));
          setRunProgress({
            done: localResults.size,
            total: generated.length,
          });
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
    } catch (cause) {
      const values = [...localResults.values()];
      await postJson(REGRESSION_API, {
        action: "finish_run",
        runId: start.runId,
        status: "error",
        passed: values.filter((row) => row.status === "pass").length,
        failed: values.filter((row) => row.status === "fail").length,
        errored: values.filter((row) => row.status === "error").length,
      }).catch(() => undefined);
      throw cause;
    } finally {
      setRunning(false);
    }
  };

  const startDiscovery = async () => {
    if (generating || running) return;

    stopRequested.current = false;
    setError(null);
    setCopied(false);
    setPromoted(new Set());
    setScenarios([]);
    setResults(new Map());
    setRunId(null);
    setRunStartedAt(null);
    setRunCompletedAt(null);
    setRunProgress({ done: 0, total: 0 });
    setGenerating(true);

    try {
      const generated = await generateFreshScenarios(count);
      setGenerating(false);
      if (!stopRequested.current) {
        await runGeneratedScenarios(generated);
      }
    } catch (cause) {
      setGenerating(false);
      setRunning(false);
      setError(
        cause instanceof Error ? cause.message : "Discovery run failed.",
      );
    }
  };

  const promoteScenario = async (scenarioId: string) => {
    if (promoted.has(scenarioId) || promoting.has(scenarioId)) return;

    setPromoting((current) => new Set(current).add(scenarioId));
    try {
      await postJson(DISCOVERY_API, {
        action: "promote",
        calledNumber: line.e164,
        scenarioId,
      });
      setPromoted((current) => new Set(current).add(scenarioId));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not promote scenario.",
      );
    } finally {
      setPromoting((current) => {
        const next = new Set(current);
        next.delete(scenarioId);
        return next;
      });
    }
  };

  const copyReport = async () => {
    if (scenarios.length === 0) return;
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

  return (
    <AdminSectionCard
      title="Discovery / Stress"
      description={`${line.orgName} · ${formatIrishE164Display(line.e164)} · fresh adversarial scenarios every run`}
      className="flex min-h-0 flex-1 flex-col"
      contentClassName="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <strong>Discovery is disposable by default.</strong> Generated cases
          are stored for evidence/history but do not enter the permanent
          regression bank unless you promote a failed case.
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-gray-600">
            Fresh tests
            <select
              value={count}
              disabled={busy}
              onChange={(event) =>
                setCount(Number(event.target.value) as DiscoveryCount)
              }
              className="rounded-md border border-gray-200 bg-white px-2 py-2 text-sm text-gray-900"
            >
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-gray-600">
            Parallel calls
            <select
              value={concurrency}
              disabled={busy}
              onChange={(event) =>
                setConcurrency(Number(event.target.value) as Concurrency)
              }
              className="rounded-md border border-gray-200 bg-white px-2 py-2 text-sm text-gray-900"
            >
              <option value={1}>1</option>
              <option value={3}>3</option>
              <option value={5}>5</option>
            </select>
          </label>

          <button
            type="button"
            disabled={busy}
            onClick={() => void startDiscovery()}
            className={adminPrimaryButtonClass}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3.5" aria-hidden />
            )}
            Generate & run {count}
          </button>

          {busy ? (
            <button
              type="button"
              onClick={() => {
                stopRequested.current = true;
              }}
              className={adminSecondaryButtonClass}
            >
              Stop after active work
            </button>
          ) : null}

          <button
            type="button"
            disabled={results.size === 0}
            onClick={() => void copyReport()}
            className={`${adminSecondaryButtonClass} ml-auto`}
          >
            <Clipboard className="size-3.5" aria-hidden />
            {copied ? "Copied" : "Copy discovery report"}
          </button>
        </div>

        {generating ? (
          <div className="shrink-0">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
              <span>
                Generating fresh scenarios · {generationProgress.done}/
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
                className="h-full bg-blue-700 transition-[width]"
                style={{
                  width: `${
                    generationProgress.total
                      ? (generationProgress.done / generationProgress.total) *
                        100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        ) : null}

        {running || runProgress.total > 0 ? (
          <div className="shrink-0">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
              <span>
                {running ? "Stress testing" : "Last discovery run"} ·{" "}
                {runProgress.done}/{runProgress.total}
              </span>
              <span>
                {runProgress.total
                  ? `${Math.round(
                      (runProgress.done / runProgress.total) * 100,
                    )}%`
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
          <div className="grid shrink-0 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Passed
              </p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {summary.passed}
              </p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-red-700">
                Failed
              </p>
              <p className="mt-1 text-2xl font-semibold text-red-900">
                {summary.failed}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                Errors
              </p>
              <p className="mt-1 text-2xl font-semibold text-amber-900">
                {summary.errored}
              </p>
            </div>
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
                Recurring patterns
              </p>
              <p className="mt-1 text-2xl font-semibold text-violet-900">
                {summary.recurring}
              </p>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="shrink-0 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        {scenarios.length > 0 ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {(["failing", "all", "passing"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium",
                  filter === value
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                )}
              >
                {value === "failing"
                  ? `Failures (${summary.failed + summary.errored})`
                  : value === "passing"
                    ? `Passing (${summary.passed})`
                    : `All (${scenarios.length})`}
              </button>
            ))}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200">
          {scenarios.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center p-6 text-center">
              <div>
                <TestTube2
                  className="mx-auto size-6 text-gray-400"
                  aria-hidden
                />
                <p className="mt-2 text-sm font-medium text-gray-900">
                  No discovery run yet
                </p>
                <p className="mt-1 max-w-lg text-xs text-gray-500">
                  Each run generates new caller situations across misleading
                  product names, departments, counter/pre-pack, Rewards prices,
                  Irish/STT wording, context switches, vague follow-ups and
                  awkward multi-turn calls.
                </p>
              </div>
            </div>
          ) : visibleScenarios.length === 0 ? (
            <p className="p-5 text-sm text-gray-500">
              Nothing matches this result filter yet.
            </p>
          ) : (
            visibleScenarios.map((scenario) => {
              const result = results.get(scenario.id);
              const issue = result ? issueLabel(result) : null;
              const isPromoted = promoted.has(scenario.id);
              const isPromoting = promoting.has(scenario.id);

              return (
                <details
                  key={scenario.id}
                  className="group border-b border-gray-200 last:border-b-0"
                >
                  <summary className="flex cursor-pointer list-none items-start gap-3 p-3 hover:bg-gray-50">
                    <div className="mt-0.5 shrink-0">
                      {!result ? (
                        <Loader2
                          className="size-4 animate-spin text-gray-400"
                          aria-hidden
                        />
                      ) : result.status === "pass" ? (
                        <CheckCircle2
                          className="size-4 text-emerald-700"
                          aria-hidden
                        />
                      ) : result.status === "fail" ? (
                        <XCircle
                          className="size-4 text-red-700"
                          aria-hidden
                        />
                      ) : (
                        <AlertTriangle
                          className="size-4 text-amber-700"
                          aria-hidden
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {scenario.title}
                        </p>
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-600">
                          {discoveryFamily(scenario)}
                        </span>
                        {issue ? (
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                              result?.issueKind === "new_failure"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800",
                            )}
                          >
                            {issue}
                          </span>
                        ) : null}
                        {isPromoted ? (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-800">
                            Permanent regression
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-gray-600">
                        Caller: {scenario.turns[0]?.caller}
                      </p>
                    </div>
                    {result ? (
                      <span className="shrink-0 text-xs text-gray-500">
                        {(result.durationMs / 1000).toFixed(1)}s
                      </span>
                    ) : null}
                  </summary>

                  <div className="space-y-3 border-t border-gray-100 bg-gray-50 p-4 text-xs">
                    <div>
                      <p className="font-medium text-gray-900">Pressure test</p>
                      <p className="mt-1 text-gray-600">
                        {scenario.expectations.summary}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-gray-900">Conversation</p>
                      <div className="mt-1 space-y-2 font-mono">
                        {scenario.turns.map((turn, index) => {
                          const actual = result?.turns[index];
                          return (
                            <div key={`${scenario.id}-turn-${index}`}>
                              <p className="text-blue-900">
                                Caller: {turn.caller}
                              </p>
                              {actual ? (
                                <>
                                  <p className="whitespace-pre-wrap text-gray-900">
                                    Cara: {actual.assistant || "(no reply)"}
                                  </p>
                                  {actual.tools.map((tool, toolIndex) => (
                                    <p
                                      key={`${scenario.id}-tool-${index}-${toolIndex}`}
                                      className="whitespace-pre-wrap text-violet-800"
                                    >
                                      [Tool] {tool.name}{" "}
                                      {JSON.stringify(tool.args)}
                                    </p>
                                  ))}
                                </>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {result?.reasons.length ? (
                      <div>
                        <p className="font-medium text-red-800">
                          Why it failed
                        </p>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-red-700">
                          {result.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {result &&
                    (result.status === "fail" ||
                      result.status === "error") ? (
                      <div className="flex items-center gap-2 border-t border-gray-200 pt-3">
                        <button
                          type="button"
                          disabled={isPromoted || isPromoting}
                          onClick={() => void promoteScenario(scenario.id)}
                          className={adminSecondaryButtonClass}
                        >
                          {isPromoting ? (
                            <Loader2
                              className="size-3.5 animate-spin"
                              aria-hidden
                            />
                          ) : isPromoted ? (
                            <CheckCircle2
                              className="size-3.5"
                              aria-hidden
                            />
                          ) : (
                            <RotateCcw className="size-3.5" aria-hidden />
                          )}
                          {isPromoted
                            ? "Added to permanent suite"
                            : "Promote to regression"}
                        </button>
                        <span className="text-gray-500">
                          Only promote genuine product/Cara failures, not a bad
                          generated expectation.
                        </span>
                      </div>
                    ) : null}
                  </div>
                </details>
              );
            })
          )}
        </div>
      </div>
    </AdminSectionCard>
  );
}
