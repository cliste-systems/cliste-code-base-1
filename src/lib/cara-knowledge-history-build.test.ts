import assert from "node:assert/strict";
import test from "node:test";

import type { CaraKnowledgeEventRow } from "@/lib/cara-knowledge-events";
import type { TemporalUpdateRecord } from "@/lib/cara-knowledge-temporal";
import { buildCaraKnowledgeHistoryTimeline } from "@/lib/cara-knowledge-history-build";

test("buildCaraKnowledgeHistoryTimeline merges events, temporal rows, and training", () => {
  const events: CaraKnowledgeEventRow[] = [
    {
      id: "evt-1",
      organization_id: "org-1",
      event_type: "temporal_started",
      category: "opening_hours",
      title: "Temporary opening hours",
      payload: { temporalUpdateId: "temp-1" },
      source: "owner_initiated",
      actor_id: null,
      call_log_id: null,
      training_item_id: "train-1",
      created_at: "2026-09-17T12:30:00.000Z",
    },
    {
      id: "evt-2",
      organization_id: "org-1",
      event_type: "learned",
      category: "facts",
      title: "Delivery area",
      payload: {},
      source: "call_gap",
      actor_id: null,
      call_log_id: "call-1",
      training_item_id: "train-2",
      created_at: "2026-09-17T11:00:00.000Z",
    },
  ];

  const temporalRows: TemporalUpdateRecord[] = [
    {
      id: "temp-1",
      organizationId: "org-1",
      title: "Temporary opening hours",
      body: "8am–6pm",
      subjectType: "opening_hours",
      subjectRef: "fact-hours",
      subjectScope: {},
      overridePreview: null,
      durationMode: "limited",
      effectiveAt: "2026-09-17T12:30:00.000Z",
      expiresAt: "2026-09-17T23:59:59.000Z",
      reviewReminderAt: null,
      hoursOverrideId: null,
      trainingItemId: "train-1",
      classification: {
        folderId: "unsorted",
        departmentIds: [],
        topicLabels: [],
      },
      createdAt: "2026-09-17T12:30:00.000Z",
      updatedAt: "2026-09-17T12:30:00.000Z",
      endedAt: null,
      cancelledAt: null,
    },
    {
      id: "temp-2",
      organizationId: "org-1",
      title: "Closed for maintenance",
      body: "Closed until 3pm",
      subjectType: "notice",
      subjectRef: null,
      subjectScope: {},
      overridePreview: null,
      durationMode: "limited",
      effectiveAt: "2026-09-16T09:00:00.000Z",
      expiresAt: "2026-09-16T15:00:00.000Z",
      reviewReminderAt: null,
      hoursOverrideId: null,
      trainingItemId: "train-3",
      classification: {
        folderId: "unsorted",
        departmentIds: [],
        topicLabels: [],
      },
      createdAt: "2026-09-16T09:00:00.000Z",
      updatedAt: "2026-09-16T09:00:00.000Z",
      endedAt: "2026-09-16T14:00:00.000Z",
      cancelledAt: null,
    },
  ];

  const trainingRows: Record<string, unknown>[] = [
    {
      id: "train-1",
      status: "applied",
      source: "owner_initiated",
      gap_summary: "Today's closing time",
      applied_at: "2026-09-17T12:30:00.000Z",
      applied_patch: {
        kind: "faq",
        question: "What are today's opening hours?",
        answer: "8am–6pm",
      },
    },
    {
      id: "train-4",
      status: "applied",
      source: "owner_initiated",
      gap_summary: "Parking",
      applied_at: "2026-09-15T10:00:00.000Z",
      applied_patch: {
        kind: "faq",
        question: "Is there parking?",
        answer: "Yes, free parking out front.",
      },
    },
  ];

  const timeline = buildCaraKnowledgeHistoryTimeline({
    events,
    temporalRows,
    trainingRows,
  });

  assert.equal(timeline.length, 5);
  assert.equal(timeline[0].kind, "temporal_started");
  assert.equal(timeline[0].id, "event-evt-1");
  assert.ok(!timeline.some((item) => item.id === "temporal-temp-1-started"));
  assert.ok(timeline.some((item) => item.id === "temporal-temp-2-started"));
  assert.ok(timeline.some((item) => item.id === "temporal-temp-2-ended"));
  assert.ok(!timeline.some((item) => item.id === "training-train-1-applied"));
  assert.ok(timeline.some((item) => item.id === "training-train-4-applied"));
  const taught = timeline.find((item) => item.id === "event-evt-2");
  assert.equal(taught?.actionLabel, "Learned from a call");
  const temporal = timeline.find((item) => item.id === "event-evt-1");
  assert.equal(temporal?.categoryLabel, "Opening hours");
});
