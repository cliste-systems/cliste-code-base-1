import type { BusinessFileListItem } from "@/lib/business-files";

import {
  isFallbackRoute,
  routeKeywords,
  routeSummary,
  sortRoutesWithFallbackLast,
  type SavedRoute,
} from "./route-models";

/** Phrases that help score a route (dashboard preview; worker uses semantic matching). */
const TEMPLATE_MATCH_HINTS: Record<string, string[]> = {
  "booking-inquiry": [
    "book",
    "booking",
    "appointment",
    "schedule",
    "reservation",
    "reserve",
    "slot",
    "calendar",
    "reschedule",
    "cancel",
    "change",
  ],
  "speak-to-person": [
    "person",
    "human",
    "someone",
    "speak",
    "talk",
    "manager",
    "put me through",
  ],
  transfer: [
    "person",
    "human",
    "someone",
    "speak",
    "talk",
    "manager",
    "owner",
    "reception",
    "put me through",
  ],
  "form-application": [
    "form",
    "application",
    "apply",
    "finance",
    "credit",
    "intake",
    "enrol",
    "enroll",
  ],
  location: [
    "location",
    "direction",
    "directions",
    "address",
    "where are you",
    "find you",
    "parking",
    "eircode",
    "map",
    "located",
  ],
  brochure: [
    "price",
    "prices",
    "pricing",
    "brochure",
    "catalogue",
    "catalog",
    "menu",
    "list",
    "pdf",
    "cost",
    "how much",
  ],
  "quote-callback": [
    "quote",
    "estimate",
    "callback",
    "call me back",
    "ring back",
    "follow up",
    "get back to me",
  ],
  urgent: ["urgent", "emergency", "asap", "straight away", "immediately", "today"],
  email: ["email", "e-mail", "inbox", "send details"],
  whatsapp: ["whatsapp", "whats app", "text me", "message me on"],
  "cant-answer": ["don't know", "can't answer", "not sure", "no idea"],
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "i",
  "im",
  "i'm",
  "me",
  "my",
  "for",
  "to",
  "and",
  "or",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "do",
  "does",
  "did",
  "can",
  "could",
  "would",
  "should",
  "will",
  "just",
  "about",
  "with",
  "on",
  "in",
  "at",
  "of",
  "it",
  "that",
  "this",
  "what",
  "how",
  "when",
  "where",
  "why",
  "who",
  "please",
  "thanks",
  "hello",
  "hi",
  "hey",
  "looking",
  "want",
  "need",
  "get",
  "got",
  "have",
  "you",
  "your",
  "we",
  "our",
  "they",
  "them",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .split(/[^a-z0-9']+/)
    .map((t) => t.replace(/^'+|'+$/g, ""))
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function phraseInUtterance(utterance: string, phrase: string): boolean {
  const p = phrase.toLowerCase().trim();
  if (!p) return false;
  return utterance.toLowerCase().includes(p);
}

function scoreRoute(utterance: string, tokens: string[], route: SavedRoute): number {
  if (!route.active) return 0;

  let score = 0;
  const lower = utterance.toLowerCase();
  const phrases = routeKeywords(route)
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const phrase of phrases) {
    const pl = phrase.toLowerCase();
    if (phraseInUtterance(lower, phrase)) score += 12;
    for (const token of tokens) {
      if (pl.includes(token)) score += 5;
    }
    score += Math.min(phrase.length, 24) * 0.15;
  }

  for (const token of tokens) {
    const hints = TEMPLATE_MATCH_HINTS[route.templateId] ?? [];
    for (const hint of hints) {
      if (hint.includes(" ")) {
        if (phraseInUtterance(lower, hint)) score += 8;
      } else if (token === hint || hint.includes(token)) {
        score += 6;
      }
    }
  }

  return score;
}

export type RouteMatchPreview = {
  route: SavedRoute;
  score: number;
  action: string;
  usedFallback: boolean;
  ambiguous?: {
    otherRoute: SavedRoute;
    message: string;
  };
};

export function describeRouteAction(
  route: SavedRoute,
  sendableFiles: BusinessFileListItem[],
): string {
  switch (route.outcome) {
    case "send_link": {
      const url = route.url.trim();
      return url ? `Text link: ${url}` : "Text link (finish setup)";
    }
    case "send_file": {
      const file = sendableFiles.find((f) => f.id === route.businessFileId);
      return file ? `Text file: ${file.fileName}` : "Text file (choose in Setup)";
    }
    case "transfer":
      return route.transferDuringHoursOnly
        ? "Transfer during opening hours — otherwise take a message"
        : "Try to put them through — if no answer, take a message";
    case "action_inbox":
      return isFallbackRoute(route)
        ? "Take a message (Action Inbox)"
        : "Action Inbox — capture details for your team";
    case "email":
      return route.email.trim()
        ? `Collect details → email ${route.email.trim()}`
        : "Email request (add address in Settings)";
    case "whatsapp":
      return route.whatsapp.trim()
        ? "Hand off to WhatsApp"
        : "WhatsApp (add number in Settings)";
    default:
      return routeSummary(route);
  }
}

const MIN_MATCH_SCORE = 6;
const AMBIGUITY_SCORE_DELTA = 3;

type ScoredRoute = { route: SavedRoute; score: number; order: number };

/**
 * Preview which route wins. Uses the same priority rules as production:
 * routes are evaluated top-to-bottom; on a tie, higher position wins; more
 * specific triggers break close ties; genuinely ambiguous pairs surface a
 * clarifying-question hint.
 */
export function matchCallerRequest(
  utterance: string,
  routes: SavedRoute[],
  sendableFiles: BusinessFileListItem[],
): RouteMatchPreview | null {
  const trimmed = utterance.trim();
  if (!trimmed) return null;

  const tokens = tokenize(trimmed);
  const ordered = sortRoutesWithFallbackLast(routes);
  const active = ordered.filter((r) => r.active);
  if (active.length === 0) return null;

  const fallback = active.find(isFallbackRoute) ?? null;
  const specific = active.filter((r) => !isFallbackRoute(r));

  const scored: ScoredRoute[] = specific.map((route, order) => ({
    route,
    score: scoreRoute(trimmed, tokens, route),
    order,
  }));

  const qualifying = scored
    .filter((s) => s.score >= MIN_MATCH_SCORE)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.order - b.order;
    });

  if (qualifying.length === 0) {
    if (!fallback) return null;
    return {
      route: fallback,
      score: 0,
      action: describeRouteAction(fallback, sendableFiles),
      usedFallback: true,
    };
  }

  const winner = qualifying[0];
  const runnerUp = qualifying[1];

  let ambiguous: RouteMatchPreview["ambiguous"];
  if (
    runnerUp &&
    winner.score - runnerUp.score <= AMBIGUITY_SCORE_DELTA
  ) {
    ambiguous = {
      otherRoute: runnerUp.route,
      message: `“${routeKeywords(winner.route)}” and “${routeKeywords(runnerUp.route)}” both match — Cara asks one short clarifying question, then uses route order (higher wins).`,
    };
  }

  return {
    route: winner.route,
    score: winner.score,
    action: describeRouteAction(winner.route, sendableFiles),
    usedFallback: false,
    ambiguous,
  };
}
