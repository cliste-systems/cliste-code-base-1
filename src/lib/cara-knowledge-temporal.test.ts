import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTemporalWindow,
  findTemporalConflicts,
  formatRemainingDuration,
  formatTemporalCountdown,
  resolveTemporalLifecycle,
  rowToTemporalUpdate,
  validateTemporalWindow,
} from "./cara-knowledge-temporal";
import {
  buildHoursOverrideForDraft,
  suggestTemporalSubject,
} from "./cara-knowledge-temporal-subjects";
import { defaultWeekSchedule, serializeBusinessHours } from "./business-hours";

describe("cara-knowledge-temporal", () => {
  it("builds end-of-today window in business timezone", () => {
    const now = new Date("2026-03-17T14:30:00.000Z");
    const window = buildTemporalWindow(
      {
        durationMode: "limited",
        startChoice: "now",
        endChoice: "end_of_today",
      },
      "Europe/Dublin",
      now,
    );
    assert.ok(window.expiresAt);
    assert.equal(validateTemporalWindow(window, "limited").ok, true);
  });

  it("detects early closing override suggestion", () => {
    const suggestion = suggestTemporalSubject({
      text: "We're closing at 5pm today.",
      businessHours: serializeBusinessHours(defaultWeekSchedule()),
      openingHoursText: "Mon–Sat 9am–10pm",
      timezone: "Europe/Dublin",
      now: new Date("2026-03-17T12:00:00.000Z"),
    });
    assert.equal(suggestion.subjectType, "opening_hours");
    assert.equal(suggestion.subjectRef, "fact-hours");
    assert.match(String(suggestion.overridePreview?.temporaryBody), /5pm/i);
  });

  it("parses full temporary hours range for override schedule", () => {
    const result = buildHoursOverrideForDraft({
      draft: {
        durationMode: "limited",
        startChoice: "now",
        endChoice: "end_of_today",
        reviewReminderChoice: "none",
        subjectType: "opening_hours",
        subjectRef: "fact-hours",
        subjectScope: { dayKey: "thursday", scope: "today" },
        overridePreview: null,
        title: "Temporary opening hours",
        body: "8am–6pm",
        classification: { folderId: "facts", departmentIds: [], topicLabels: [] },
      },
      businessHours: serializeBusinessHours(defaultWeekSchedule()),
      timezone: "Europe/Dublin",
      now: new Date("2026-09-17T12:00:00.000Z"),
    });
    assert.ok(result);
    assert.equal(result?.schedule.thursday.end, "18:00");
    assert.equal(result?.schedule.thursday.start, "08:00");
  });

  it("formats remaining duration without negative values", () => {
    assert.equal(formatRemainingDuration(-1000), "Less than a minute");
    assert.match(
      formatRemainingDuration(3 * 60 * 60 * 1000 + 24 * 60 * 1000),
      /3h 24m/,
    );
    assert.match(formatRemainingDuration(18 * 60 * 1000), /18m/);
  });

  it("marks scheduled updates separately from active temporary ones", () => {
    const row = rowToTemporalUpdate({
      id: "abc",
      organization_id: "org",
      title: "Temporary opening hours",
      body: "9am–5pm",
      subject_type: "opening_hours",
      subject_ref: "fact-hours",
      subject_scope: {},
      override_preview: null,
      duration_mode: "limited",
      effective_at: "2026-03-18T09:00:00.000Z",
      expires_at: "2026-03-18T17:00:00.000Z",
      review_reminder_at: null,
      ended_at: null,
      cancelled_at: null,
      hours_override_id: null,
      training_item_id: null,
      classification: {},
      created_at: "2026-03-17T12:00:00.000Z",
      updated_at: "2026-03-17T12:00:00.000Z",
    });
    const countdown = formatTemporalCountdown(
      row,
      "Europe/Dublin",
      new Date("2026-03-17T12:00:00.000Z"),
    );
    assert.equal(countdown.isScheduled, true);
    assert.equal(
      resolveTemporalLifecycle(row, new Date("2026-03-17T12:00:00.000Z")),
      "scheduled",
    );
  });

  it("finds overlapping conflicts for the same subject", () => {
    const existing = [
      rowToTemporalUpdate({
        id: "one",
        organization_id: "org",
        title: "Hours",
        body: "Close early",
        subject_type: "opening_hours",
        subject_ref: "fact-hours",
        subject_scope: {},
        override_preview: null,
        duration_mode: "limited",
        effective_at: "2026-03-17T09:00:00.000Z",
        expires_at: "2026-03-17T22:00:00.000Z",
        review_reminder_at: null,
        ended_at: null,
        cancelled_at: null,
        hours_override_id: null,
        training_item_id: null,
        classification: {},
        created_at: "2026-03-17T08:00:00.000Z",
        updated_at: "2026-03-17T08:00:00.000Z",
      }),
    ];
    const conflicts = findTemporalConflicts(
      existing,
      {
        subjectRef: "fact-hours",
        subjectType: "opening_hours",
        effectiveAt: new Date("2026-03-17T12:00:00.000Z"),
        expiresAt: new Date("2026-03-17T18:00:00.000Z"),
      },
      new Date("2026-03-17T12:00:00.000Z"),
    );
    assert.equal(conflicts.length, 1);
  });
});
