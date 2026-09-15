import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assessCallerSecurityLevel,
  callerSecurityOverviewPrefix,
  type CallerSecurityCallInput,
} from "./caller-security-level";

const NOW = new Date("2026-09-15T12:00:00.000Z");

function call(
  overrides: Partial<CallerSecurityCallInput> & { createdAt: string },
): CallerSecurityCallInput {
  return {
    outcome: "answered",
    aiSummary: "General enquiry about opening hours.",
    durationSeconds: 90,
    ...overrides,
  };
}

describe("caller-security-level", () => {
  it("returns high for blocked callers", () => {
    const assessment = assessCallerSecurityLevel({
      isBlocked: true,
      abuseHitCount: 0,
      openFollowUps: 0,
      securityFlags: ["blocked"],
      calls: [call({ createdAt: "2026-09-15T10:00:00.000Z" })],
      now: NOW,
    });
    assert.equal(assessment.level, "high");
    assert.equal(assessment.recommendation, "Consider blocking this caller from the call actions below.");
  });

  it("returns high for repeated spam outcomes", () => {
    const assessment = assessCallerSecurityLevel({
      isBlocked: false,
      abuseHitCount: 0,
      openFollowUps: 0,
      securityFlags: [],
      calls: [
        call({ createdAt: "2026-09-15T10:00:00.000Z", outcome: "spam_or_abuse" }),
        call({ createdAt: "2026-09-14T10:00:00.000Z", outcome: "spam_or_abuse" }),
      ],
      now: NOW,
    });
    assert.equal(assessment.level, "high");
  });

  it("returns elevated for frequent short hang-ups with high volume", () => {
    const calls = Array.from({ length: 5 }, (_, index) =>
      call({
        createdAt: new Date(NOW.getTime() - index * 60 * 60 * 1000).toISOString(),
        durationSeconds: 8,
        outcome: "answered",
        aiSummary: "Hung up after greeting.",
      }),
    );
    const assessment = assessCallerSecurityLevel({
      isBlocked: false,
      abuseHitCount: 0,
      openFollowUps: 0,
      securityFlags: ["frequent_caller", "high_volume_today"],
      calls,
      now: NOW,
    });
    assert.equal(assessment.level, "elevated");
  });

  it("returns low for a normal repeat customer", () => {
    const assessment = assessCallerSecurityLevel({
      isBlocked: false,
      abuseHitCount: 0,
      openFollowUps: 0,
      securityFlags: [],
      calls: [
        call({ createdAt: "2026-09-15T10:00:00.000Z", aiSummary: "Birthday cake order." }),
        call({ createdAt: "2026-09-10T10:00:00.000Z", aiSummary: "Opening hours on Sunday." }),
      ],
      now: NOW,
    });
    assert.equal(assessment.level, "low");
    assert.equal(assessment.recommendation, null);
  });

  it("builds an overview prefix for elevated risk", () => {
    const assessment = assessCallerSecurityLevel({
      isBlocked: false,
      abuseHitCount: 0,
      openFollowUps: 0,
      securityFlags: [],
      calls: [
        call({
          createdAt: "2026-09-15T10:00:00.000Z",
          outcome: "spam_or_abuse",
        }),
      ],
      now: NOW,
    });
    const prefix = callerSecurityOverviewPrefix(assessment);
    assert.match(prefix ?? "", /elevated risk/i);
  });
});
