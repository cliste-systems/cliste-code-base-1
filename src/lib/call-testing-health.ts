import type {
  CallCloseDiagnosticsPayload,
  CallTestHealthStatus,
  CallTestTranscriptQa,
} from "@/lib/call-testing-types";
import { assessTranscriptQuality } from "@/lib/call-transcript-qa";

export type ComputeCallTestHealthInput = {
  durationSeconds: number;
  diagnostics: CallCloseDiagnosticsPayload | null | undefined;
  transcript: string | null | undefined;
  transcriptReview?: string | null;
  businessName?: string | null;
};

function hasCallerLine(transcript: string | null | undefined): boolean {
  if (!transcript?.trim()) return false;
  return /^Caller:\s*.+/m.test(transcript);
}

function earlyPipelineErrors(
  diagnostics: CallCloseDiagnosticsPayload,
  withinMs: number,
  callStartedAtMs?: number,
): CallCloseDiagnosticsPayload["events"] {
  const events = diagnostics.events ?? [];
  if (!callStartedAtMs) {
    return events.filter(
      (e) =>
        e.level === "error" &&
        (e.tag.includes("tts") || e.tag.includes("llm") || e.tag.includes("pipeline")),
    );
  }
  return events.filter((e) => {
    if (e.level !== "error") return false;
    const offset = e.atMs - callStartedAtMs;
    if (offset > withinMs) return false;
    return (
      e.tag.includes("tts") ||
      e.tag.includes("llm") ||
      e.tag.includes("pipeline")
    );
  });
}

export function computeTranscriptQaForHealth(
  input: ComputeCallTestHealthInput,
): CallTestTranscriptQa {
  return (
    input.diagnostics?.transcriptQa ??
    assessTranscriptQuality({
      transcript: input.transcript,
      transcriptReview: input.transcriptReview,
      businessName: input.businessName,
      durationSeconds: input.durationSeconds,
    })
  );
}

export function computeCallTestHealth(
  input: ComputeCallTestHealthInput,
): { status: CallTestHealthStatus; reason: string } {
  const diagnostics = input.diagnostics;
  const transcriptQa = computeTranscriptQaForHealth(input);

  if (transcriptQa.needsReview) {
    return {
      status: "fail",
      reason: transcriptQa.summary || transcriptQa.issues[0] || "Transcript failed QA — needs review.",
    };
  }

  const greetingPlayed = diagnostics?.greetingPlayed === true;
  const errorCount =
    diagnostics?.events?.filter((e) => e.level === "error").length ?? 0;
  const firstEventAt = diagnostics?.events?.[0]?.atMs;
  const earlyErrors =
    diagnostics && firstEventAt != null
      ? earlyPipelineErrors(diagnostics, 10_000, firstEventAt)
      : [];

  if (!greetingPlayed) {
    return {
      status: "fail",
      reason: "Greeting never played — check TTS credentials and pipeline.",
    };
  }

  if (earlyErrors.some((e) => e.tag.includes("tts"))) {
    return {
      status: "fail",
      reason: "TTS failed before caller heard audio.",
    };
  }

  if (input.durationSeconds < 3 && errorCount > 0) {
    return {
      status: "fail",
      reason: "Call ended in under 3s with pipeline errors.",
    };
  }

  if (errorCount > 0) {
    return {
      status: "degraded",
      reason: `${errorCount} pipeline error(s) during the call.`,
    };
  }

  if (diagnostics && !diagnostics.disclosureConfirmed) {
    return {
      status: "degraded",
      reason: "AI disclosure not confirmed in greeting.",
    };
  }

  if (!hasCallerLine(input.transcript)) {
    return {
      status: "degraded",
      reason: "No caller speech captured in transcript.",
    };
  }

  if ((diagnostics?.transcriptIssues?.length ?? 0) > 0) {
    return {
      status: "degraded",
      reason: diagnostics!.transcriptIssues!.join(" "),
    };
  }

  if (!transcriptQa.acceptable) {
    return {
      status: "degraded",
      reason: transcriptQa.issues[0] ?? "Transcript quality below bar.",
    };
  }

  return { status: "pass", reason: "Greeting played, coherent conversation, no pipeline errors." };
}

export function healthStatusLabel(status: CallTestHealthStatus): string {
  switch (status) {
    case "pass":
      return "Pass";
    case "degraded":
      return "Degraded";
    case "fail":
      return "Fail";
  }
}

export function healthStatusTone(
  status: CallTestHealthStatus,
): "success" | "warning" | "danger" {
  switch (status) {
    case "pass":
      return "success";
    case "degraded":
      return "warning";
    case "fail":
      return "danger";
  }
}