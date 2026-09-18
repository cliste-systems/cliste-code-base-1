import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  enrichTrainingItemsWithCallLinks,
  resolveTrainingCallLogId,
} from "./cara-training-call-link";
import type { CaraTrainingItemRow } from "./cara-training-types";

function sampleItem(
  overrides: Partial<CaraTrainingItemRow> = {},
): CaraTrainingItemRow {
  return {
    id: "1",
    organization_id: "org",
    status: "awaiting_answer",
    source: "call_gap",
    call_log_id: null,
    action_ticket_id: null,
    gap_summary: "Customer toilets",
    caller_context:
      "Caller asked where the customer toilets are in the mall corridor.",
    cara_question: "Where are the customer toilets?",
    owner_messages: [],
    proposed_patch: null,
    applied_patch: null,
    target_section: null,
    applied_at: null,
    applied_by: null,
    dismissed_at: null,
    occurrence_count: 1,
    last_seen_at: "2026-09-17T14:12:00.000Z",
    created_at: "2026-09-17T14:12:00.000Z",
    updated_at: "2026-09-17T14:12:00.000Z",
    ...overrides,
  };
}

describe("resolveTrainingCallLogId", () => {
  it("matches a call summary near last_seen_at", () => {
    const item = sampleItem();
    const callId = resolveTrainingCallLogId(item, [
      {
        id: "call-toilets",
        ai_summary:
          "Brendan asked where the customer toilets are in the mall outside the shop.",
        created_at: "2026-09-17T14:11:58.000Z",
      },
    ]);

    assert.equal(callId, "call-toilets");
  });

  it("leaves items alone when a call link already exists", () => {
    const item = sampleItem({ call_log_id: "existing" });
    assert.equal(
      resolveTrainingCallLogId(item, [
        {
          id: "other",
          ai_summary: "Customer toilets in the mall corridor.",
          created_at: "2026-09-17T14:11:58.000Z",
        },
      ]),
      "existing",
    );
  });
});

describe("enrichTrainingItemsWithCallLinks", () => {
  it("adds call_log_id for display when missing", () => {
    const [enriched] = enrichTrainingItemsWithCallLinks([sampleItem()], [
      {
        id: "call-toilets",
        ai_summary: "Caller asked where the customer toilets are.",
        created_at: "2026-09-17T14:12:01.000Z",
      },
    ]);

    assert.equal(enriched?.call_log_id, "call-toilets");
  });
});
