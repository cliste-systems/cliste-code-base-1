import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyTemporalBusinessRuleOverrides,
  applyTemporalServicesNotOfferedOverrides,
} from "./cara-knowledge-temporal-prompt";
import type { TemporalUpdateRecord } from "./cara-knowledge-temporal";

function temporalRow(
  partial: Partial<TemporalUpdateRecord> & Pick<TemporalUpdateRecord, "subjectType" | "body">,
): TemporalUpdateRecord {
  return {
    id: "temp-1",
    organizationId: "org-1",
    title: partial.title ?? "Temporary update",
    body: partial.body,
    subjectType: partial.subjectType,
    subjectRef: partial.subjectRef ?? null,
    subjectScope: partial.subjectScope ?? {},
    overridePreview: partial.overridePreview ?? null,
    durationMode: partial.durationMode ?? "limited",
    effectiveAt: partial.effectiveAt ?? "2026-09-17T08:00:00.000Z",
    expiresAt: partial.expiresAt ?? "2026-09-18T00:00:00.000Z",
    reviewReminderAt: null,
    endedAt: null,
    cancelledAt: null,
    hoursOverrideId: null,
    trainingItemId: null,
    classification: {},
    createdAt: "2026-09-17T08:00:00.000Z",
    updatedAt: "2026-09-17T08:00:00.000Z",
  };
}

describe("cara-knowledge-temporal-prompt", () => {
  it("prepends explicit temporary opening-hours rule", () => {
    const rules = applyTemporalBusinessRuleOverrides(
      ["We close at 9pm on weekdays."],
      [
        temporalRow({
          subjectType: "opening_hours",
          subjectRef: "fact-hours",
          body: "8am–6pm",
        }),
      ],
      new Date("2026-09-17T12:00:00.000Z"),
    );
    assert.match(rules[0] ?? "", /TEMPORARY OPENING HOURS/i);
    assert.match(rules[0] ?? "", /8am–6pm/);
  });

  it("removes not-offered items overridden by a temporary promo", () => {
    const filtered = applyTemporalServicesNotOfferedOverrides(
      "Sirloin steak, Catering",
      [
        temporalRow({
          subjectType: "price",
          body: "Sirloin steak 50% off at €12 per kg this week.",
        }),
      ],
      new Date("2026-09-17T12:00:00.000Z"),
    );
    assert.equal(filtered, "Catering");
  });
});
