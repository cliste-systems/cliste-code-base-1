import { detectCanonicalQuestion } from "@/lib/answers-boundary";
import type { BusinessFileListItem } from "@/lib/business-files";

import {
  describeRouteAction,
  matchCallerRequest,
  type RouteMatchPreview,
} from "./route-match";
import {
  customRoutes,
  isSpeakToPersonBuiltin,
  type SavedRoute,
} from "./route-models";

export type JourneyTraceStep = {
  id: string;
  label: string;
  detail: string;
  tone: "neutral" | "success" | "muted" | "warn";
};

export function traceCallerJourney(
  utterance: string,
  routes: SavedRoute[],
  sendableFiles: BusinessFileListItem[],
): JourneyTraceStep[] {
  const trimmed = utterance.trim();
  const steps: JourneyTraceStep[] = [
    {
      id: "greet",
      label: "Greet",
      detail: "Cara answers with your opening line.",
      tone: "success",
    },
  ];

  if (!trimmed) {
    steps.push({
      id: "wait",
      label: "Listen",
      detail: "Enter what the caller says to preview the rest.",
      tone: "muted",
    });
    return steps;
  }

  const canonical = detectCanonicalQuestion(trimmed);
  if (canonical) {
    steps.push({
      id: "answer",
      label: "Answers from Setup",
      detail: `Question-shaped request — Cara answers from your ${canonical.setupLabel} setup, not a route.`,
      tone: "success",
    });
    return steps;
  }

  const custom = customRoutes(routes);
  const speakBuiltin = routes.find(isSpeakToPersonBuiltin);
  const matchable = [
    ...custom,
    ...(speakBuiltin ? [speakBuiltin] : []),
  ];

  let preview: RouteMatchPreview | null = matchCallerRequest(
    trimmed,
    matchable,
    sendableFiles,
  );

  const lower = trimmed.toLowerCase();
  const wantsPerson =
    /speak to|talk to|person|human|someone|put me through|manager/i.test(lower);

  if (!preview && wantsPerson && speakBuiltin) {
    preview = {
      route: speakBuiltin,
      score: 12,
      action: describeRouteAction(speakBuiltin, sendableFiles),
      usedFallback: false,
    };
  }

  if (preview && !preview.usedFallback) {
    const priority =
      custom.findIndex((r) => r.id === preview!.route.id) + 1;
    steps.push({
      id: "match",
      label: "Matched route",
      detail: `${preview.route.name}${priority > 0 ? ` (priority #${priority})` : " (built-in)"}`,
      tone: preview.ambiguous ? "warn" : "success",
    });
    if (preview.ambiguous) {
      steps.push({
        id: "clarify",
        label: "Clarify",
        detail: preview.ambiguous.message,
        tone: "warn",
      });
    }
    steps.push({
      id: "action",
      label: "Action",
      detail: preview.action,
      tone: "success",
    });
    return steps;
  }

  steps.push({
    id: "fallback",
    label: "No match",
    detail: "Takes a message with name, number, and your detail fields.",
    tone: "muted",
  });
  return steps;
}

export function samplePhrasesForAccount(
  routes: SavedRoute[],
  extraPhrases: readonly string[] = [],
): string[] {
  const custom = customRoutes(routes).map((r) => r.name.trim()).filter(Boolean);
  const phrases = [...custom];
  phrases.push("Can I speak to someone?");
  for (const phrase of extraPhrases) {
    phrases.push(phrase);
  }
  phrases.push("I need help with something else");
  return [...new Set(phrases)].slice(0, 5);
}
