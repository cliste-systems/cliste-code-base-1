export type RetailRegressionCategory =
  | "openings"
  | "products"
  | "prices"
  | "stock"
  | "offers"
  | "departments"
  | "knowledge"
  | "clarification"
  | "multi_turn"
  | "edge_cases";

export type RetailRegressionTurn = {
  caller: string;
};

export type RetailRegressionExpectation = {
  summary: string;
  requiredTool?: string;
  forbiddenTools?: string[];
  requiredIntent?: string;
  queryMustInclude?: string[];
  queryMustIncludeAny?: string[];
  forbiddenQueryTerms?: string[];
  requiredServiceArea?: string;
  forbiddenServiceAreas?: string[];
  assistantMustIncludeAny?: string[];
  assistantMustNotInclude?: string[];
  mustAskClarifyingQuestion?: boolean;
  noError?: boolean;
};

export type RetailRegressionScenario = {
  id: string;
  slug: string;
  title: string;
  category: RetailRegressionCategory;
  tags: string[];
  turns: RetailRegressionTurn[];
  expectations: RetailRegressionExpectation;
  active: boolean;
  source: "built_in" | "manual" | "variant";
  history?: RetailRegressionScenarioHistory;
};

export type RetailRegressionScenarioHistory = {
  lastStatus: "pass" | "fail" | "error" | null;
  lastRunAt: string | null;
  recentStatuses: Array<"pass" | "fail" | "error">;
  totalRuns: number;
  totalFailures: number;
  consecutiveFailures: number;
};

export type RetailRegressionTurnExecution = {
  caller: string;
  assistant: string;
  tools: { name: string; args: Record<string, unknown> }[];
  transcriptLines: string[];
  error?: string | null;
};

export type RetailRegressionExecution = {
  turns: RetailRegressionTurnExecution[];
  durationMs: number;
  error?: string | null;
};

export type RetailRegressionGrade = {
  status: "pass" | "fail" | "error";
  reasons: string[];
  failureSignature: string | null;
};

export type RetailRegressionPersistedResult = RetailRegressionGrade & {
  scenarioId: string;
  issueKind: "new_failure" | "recurring" | "regression_returned" | null;
  occurrenceCount: number;
  createdAt: string;
};

function normalize(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function allTools(execution: RetailRegressionExecution) {
  return execution.turns.flatMap((turn) => turn.tools);
}

function allAssistant(execution: RetailRegressionExecution): string {
  return normalize(execution.turns.map((turn) => turn.assistant).join("\n"));
}

function toolArgText(tool: { name: string; args: Record<string, unknown> }): string {
  return normalize(JSON.stringify(tool.args));
}

function queryValue(tool: { name: string; args: Record<string, unknown> }): string {
  const value =
    tool.args.query ??
    tool.args.searchQuery ??
    tool.args.search_query ??
    tool.args.product ??
    "";
  return normalize(value);
}

function serviceAreaValue(tool: { name: string; args: Record<string, unknown> }): string {
  const value =
    tool.args.serviceArea ??
    tool.args.service_area ??
    tool.args.fulfillment ??
    tool.args.fulfilment ??
    tool.args.department ??
    tool.args.area ??
    "";
  return normalize(value);
}

function intentValue(tool: { name: string; args: Record<string, unknown> }): string {
  return normalize(tool.args.intent ?? "");
}

function hasClarifyingQuestion(text: string): boolean {
  const normalized = normalize(text);
  return (
    normalized.includes("?") ||
    /\b(which|what type|what kind|counter or|pre[- ]?pack|fresh or|brand|size|do you mean)\b/i.test(
      normalized,
    )
  );
}

export function gradeRetailRegressionScenario(
  scenario: Pick<RetailRegressionScenario, "expectations">,
  execution: RetailRegressionExecution,
): RetailRegressionGrade {
  const exp = scenario.expectations;
  const reasons: string[] = [];
  const tools = allTools(execution);
  const assistant = allAssistant(execution);
  const errors = execution.turns
    .map((turn) => turn.error)
    .filter((value): value is string => Boolean(value));

  if (execution.error) errors.push(execution.error);

  if ((exp.noError ?? true) && errors.length > 0) {
    reasons.push(`Execution error: ${errors.join(" | ")}`);
  }

  if (exp.requiredTool) {
    const matching = tools.filter((tool) => tool.name === exp.requiredTool);
    if (matching.length === 0) {
      reasons.push(`Expected tool ${exp.requiredTool} was not called.`);
    } else {
      if (exp.requiredIntent) {
        const found = matching.some(
          (tool) => intentValue(tool) === normalize(exp.requiredIntent),
        );
        if (!found) {
          reasons.push(`Expected intent "${exp.requiredIntent}" was not sent to ${exp.requiredTool}.`);
        }
      }

      if (exp.queryMustInclude?.length) {
        const found = matching.some((tool) => {
          const query = queryValue(tool);
          return exp.queryMustInclude!.every((term) => query.includes(normalize(term)));
        });
        if (!found) {
          reasons.push(
            `Product query did not preserve all required terms: ${exp.queryMustInclude.join(", ")}.`,
          );
        }
      }

      if (exp.queryMustIncludeAny?.length) {
        const found = matching.some((tool) => {
          const query = queryValue(tool);
          return exp.queryMustIncludeAny!.some((term) => query.includes(normalize(term)));
        });
        if (!found) {
          reasons.push(
            `Product query did not contain any expected term: ${exp.queryMustIncludeAny.join(", ")}.`,
          );
        }
      }

      if (exp.forbiddenQueryTerms?.length) {
        const bad = matching.find((tool) => {
          const query = queryValue(tool);
          return exp.forbiddenQueryTerms!.some((term) => query.includes(normalize(term)));
        });
        if (bad) {
          reasons.push(
            `Product query contained a forbidden term: ${exp.forbiddenQueryTerms.join(", ")}.`,
          );
        }
      }

      if (exp.requiredServiceArea) {
        const found = matching.some(
          (tool) => serviceAreaValue(tool) === normalize(exp.requiredServiceArea),
        );
        if (!found) {
          reasons.push(`Expected service area "${exp.requiredServiceArea}" was not used.`);
        }
      }

      if (exp.forbiddenServiceAreas?.length) {
        const bad = matching.find((tool) => {
          const area = serviceAreaValue(tool);
          const text = toolArgText(tool);
          return exp.forbiddenServiceAreas!.some((term) => {
            const normalized = normalize(term);
            return area.includes(normalized) || text.includes(`"${normalized}"`);
          });
        });
        if (bad) {
          reasons.push(
            `Tool was routed into a forbidden service area: ${exp.forbiddenServiceAreas.join(", ")}.`,
          );
        }
      }
    }
  }

  for (const toolName of exp.forbiddenTools ?? []) {
    if (tools.some((tool) => tool.name === toolName)) {
      reasons.push(`Forbidden tool ${toolName} was called.`);
    }
  }

  if (exp.assistantMustIncludeAny?.length) {
    const found = exp.assistantMustIncludeAny.some((term) =>
      assistant.includes(normalize(term)),
    );
    if (!found) {
      reasons.push(
        `Cara's reply did not contain any expected signal: ${exp.assistantMustIncludeAny.join(", ")}.`,
      );
    }
  }

  if (exp.assistantMustNotInclude?.length) {
    const bad = exp.assistantMustNotInclude.find((term) =>
      assistant.includes(normalize(term)),
    );
    if (bad) {
      reasons.push(`Cara's reply contained forbidden wording: "${bad}".`);
    }
  }

  if (
    exp.mustAskClarifyingQuestion &&
    !execution.turns.some((turn) => hasClarifyingQuestion(turn.assistant))
  ) {
    reasons.push("Cara should have asked a clarifying question before answering.");
  }

  if (errors.length > 0 && reasons.length === 0) {
    reasons.push(`Execution error: ${errors.join(" | ")}`);
  }

  const status: RetailRegressionGrade["status"] =
    errors.length > 0 ? "error" : reasons.length > 0 ? "fail" : "pass";

  const failureSignature =
    status === "pass"
      ? null
      : reasons
          .map((reason) => normalize(reason).replace(/[0-9a-f]{8,}/g, "<id>"))
          .sort()
          .join(" || ");

  return { status, reasons, failureSignature };
}

export function classifyRegressionFailure(input: {
  currentStatus: "pass" | "fail" | "error";
  currentFailureSignature: string | null;
  prior: Array<{
    status: "pass" | "fail" | "error";
    failureSignature: string | null;
  }>;
}): {
  issueKind: "new_failure" | "recurring" | "regression_returned" | null;
  occurrenceCount: number;
} {
  if (input.currentStatus === "pass") {
    return { issueKind: null, occurrenceCount: 0 };
  }

  const previousFailures = input.prior.filter((row) => row.status !== "pass");
  const sameSignatureCount = previousFailures.filter(
    (row) =>
      input.currentFailureSignature &&
      row.failureSignature === input.currentFailureSignature,
  ).length;

  if (previousFailures.length === 0) {
    return { issueKind: "new_failure", occurrenceCount: 1 };
  }

  const previous = input.prior[0];
  if (previous?.status === "pass") {
    return {
      issueKind: "regression_returned",
      occurrenceCount: Math.max(1, sameSignatureCount + 1),
    };
  }

  return {
    issueKind: "recurring",
    occurrenceCount: Math.max(2, sameSignatureCount + 1),
  };
}

export function formatRetailRegressionReport(input: {
  storeLabel: string;
  calledNumber: string;
  runId: string | null;
  startedAt: string;
  completedAt?: string | null;
  scenarios: RetailRegressionScenario[];
  results: Map<
    string,
    RetailRegressionExecution &
      RetailRegressionGrade & {
        issueKind?: "new_failure" | "recurring" | "regression_returned" | null;
        occurrenceCount?: number;
      }
  >;
}): string {
  const completed = [...input.results.values()];
  const passed = completed.filter((row) => row.status === "pass").length;
  const failed = completed.filter((row) => row.status === "fail").length;
  const errored = completed.filter((row) => row.status === "error").length;

  const lines = [
    "# HelloCara Retail Regression Report",
    "",
    `Store: ${input.storeLabel}`,
    `Called number: ${input.calledNumber}`,
    `Run ID: ${input.runId ?? "local/not saved"}`,
    `Started: ${input.startedAt}`,
    `Completed: ${input.completedAt ?? "in progress"}`,
    `Summary: ${passed} passed · ${failed} failed · ${errored} errors · ${completed.length}/${input.scenarios.length} completed`,
    "",
  ];

  for (const scenario of input.scenarios) {
    const result = input.results.get(scenario.id);
    if (!result) continue;
    const marker =
      result.status === "pass" ? "PASS" : result.status === "fail" ? "FAIL" : "ERROR";
    lines.push(
      `## [${marker}] ${scenario.title} (${scenario.slug})`,
      `Category: ${scenario.category}`,
      `Expected: ${scenario.expectations.summary}`,
    );

    if (result.issueKind) {
      lines.push(
        `History flag: ${result.issueKind} · occurrence ${result.occurrenceCount ?? 1}`,
      );
    }

    for (const reason of result.reasons) lines.push(`- Failure: ${reason}`);

    result.turns.forEach((turn, index) => {
      lines.push(
        "",
        `Turn ${index + 1} caller: ${turn.caller}`,
        `Cara: ${turn.assistant || "(no reply)"}`,
      );
      for (const tool of turn.tools) {
        lines.push(`Tool: ${tool.name} ${JSON.stringify(tool.args)}`);
      }
      if (turn.error) lines.push(`Turn error: ${turn.error}`);
    });

    lines.push("");
  }

  return lines.join("\n");
}
