export type TranscriptQaResult = {
  acceptable: boolean;
  needsReview: boolean;
  agentWentSilent: boolean;
  callerUnanswered: boolean;
  wrongContextDetected: boolean;
  issues: string[];
  summary: string;
};

const CALLER_PREFIX = /^Caller:\s*/i;
const ASSISTANT_PREFIX = /^Assistant:\s*/i;

function transcriptLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function callerLines(text: string): string[] {
  return transcriptLines(text).filter((l) => CALLER_PREFIX.test(l));
}

function assistantLines(text: string): string[] {
  return transcriptLines(text).filter((l) => ASSISTANT_PREFIX.test(l));
}

function lastSpeaker(text: string): "caller" | "assistant" | "other" | null {
  const lines = transcriptLines(text);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]!;
    if (CALLER_PREFIX.test(line)) return "caller";
    if (ASSISTANT_PREFIX.test(line)) return "assistant";
  }
  return lines.length > 0 ? "other" : null;
}

function trailingCallerLinesWithoutReply(text: string): number {
  const lines = transcriptLines(text);
  let count = 0;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]!;
    if (CALLER_PREFIX.test(line)) {
      count += 1;
      continue;
    }
    if (ASSISTANT_PREFIX.test(line)) break;
    break;
  }
  return count;
}

const UNANSWERED_CALLER_PATTERNS = [
  /\bcan you hear me\b/i,
  /\bhello\??\b/i,
  /\bare you there\b/i,
  /\banyone there\b/i,
  /\bstill there\b/i,
];

export function assessTranscriptQuality(input: {
  transcript: string | null | undefined;
  transcriptReview?: string | null;
  aiSummary?: string | null;
  durationSeconds?: number;
  businessName?: string | null;
}): TranscriptQaResult {
  const text =
    input.transcriptReview?.trim() ||
    input.transcript?.trim() ||
    "";
  const issues: string[] = [];

  if (!text) {
    return {
      acceptable: false,
      needsReview: true,
      agentWentSilent: true,
      callerUnanswered: false,
      wrongContextDetected: false,
      issues: ["Transcript is empty — nothing to review."],
      summary: "No transcript captured.",
    };
  }

  const callers = callerLines(text);
  const assistants = assistantLines(text);

  const trailingCaller = trailingCallerLinesWithoutReply(text);
  const agentWentSilent =
    callers.length > 0 &&
    (lastSpeaker(text) === "caller" || trailingCaller >= 2);

  if (agentWentSilent) {
    issues.push(
      "Cara stopped replying — caller spoke but assistant did not respond again.",
    );
  }

  const tailCallerText = callers.slice(-3).join(" ");
  const callerUnanswered = UNANSWERED_CALLER_PATTERNS.some((re) =>
    re.test(tailCallerText),
  );
  if (callerUnanswered) {
    issues.push(
      "Caller asked if Cara could hear them or repeated hello — likely one-way audio or silence.",
    );
  }

  if (/\[cut off\]/i.test(text)) {
    issues.push("Disclosure or speech was cut off mid-sentence.");
  }

  const business = (input.businessName ?? "").toLowerCase();
  const isRetail =
    business.includes("supervalu") ||
    business.includes("retail") ||
    business.includes("grocery");
  const wrongSalonCue =
    isRetail && /\bsalon\b/i.test(text) && !business.includes("salon");
  if (wrongSalonCue) {
    issues.push(
      "Wrong business context in speech (salon mentioned on a retail line).",
    );
  }

  if (callers.length === 0 && (input.durationSeconds ?? 0) > 5) {
    issues.push("Caller never appears in transcript despite call duration.");
  }

  if (assistants.length === 0) {
    issues.push("No assistant lines in transcript.");
  }

  const duplicateAssistant = new Set<string>();
  for (const line of assistants) {
    const norm = line.toLowerCase().replace(/\s+/g, " ");
    if (duplicateAssistant.has(norm)) {
      issues.push("Duplicate assistant lines — possible loop or stuck reply.");
      break;
    }
    duplicateAssistant.add(norm);
  }

  const wrongContextDetected = wrongSalonCue;
  const needsReview =
    agentWentSilent ||
    callerUnanswered ||
    issues.length > 0 ||
    !input.transcriptReview?.trim();

  const acceptable = issues.length === 0 && callers.length > 0 && assistants.length > 0;

  let summary = "Conversation looks coherent.";
  if (agentWentSilent) {
    summary = "Call quality failed — Cara went silent after the caller spoke.";
  } else if (callerUnanswered) {
    summary = "Caller could not get a response — needs engineering review.";
  } else if (issues.length > 0) {
    summary = issues[0] ?? "Transcript quality issues detected.";
  }

  return {
    acceptable,
    needsReview,
    agentWentSilent,
    callerUnanswered,
    wrongContextDetected,
    issues,
    summary,
  };
}
