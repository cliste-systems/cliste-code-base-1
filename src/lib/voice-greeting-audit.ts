import "server-only";

import { headers } from "next/headers";

import {
  buildSecurityEventContext,
  logSecurityEvent,
} from "@/lib/security-events";

export type VoiceGreetingAuditSource =
  | "onboarding_review"
  | "onboarding_save"
  | "agent_setup"
  | "voice_preview";

export async function auditVoiceGreetingSecurityEvent(input: {
  source: VoiceGreetingAuditSource;
  outcome: "failure" | "rate_limited";
  actorUserId: string;
  organizationId: string;
  eventType:
    | "voice_greeting_guardrail_blocked"
    | "voice_greeting_rate_limited"
    | "voice_greeting_invalid_format";
  introIssue?: boolean;
  closingIssue?: boolean;
  introLength?: number;
  closingLength?: number;
  scriptLength?: number;
}): Promise<void> {
  const h = await headers();
  const ctx = buildSecurityEventContext(h);

  await logSecurityEvent(ctx, {
    eventType: input.eventType,
    outcome: input.outcome,
    actorUserId: input.actorUserId,
    metadata: {
      source: input.source,
      organizationId: input.organizationId,
      introIssue: input.introIssue ?? false,
      closingIssue: input.closingIssue ?? false,
      introLength: input.introLength ?? null,
      closingLength: input.closingLength ?? null,
      scriptLength: input.scriptLength ?? null,
    },
  });
}
