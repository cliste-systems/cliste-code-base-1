import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ATTENTION_TAG_AMBER_CLASS,
  ATTENTION_TAG_RED_CLASS,
} from "@/lib/call-attention-level";
import {
  CALL_HISTORY_STATUS_BADGE_CLASSES,
  resolveCallHistoryListStatus,
  resolveCallHistoryNeedsAttention,
} from "./call-history-status";

describe("resolveCallHistoryListStatus", () => {
  it("uses red styling for complaints with open actions", () => {
    const status = resolveCallHistoryListStatus({
      outcome: "action_created",
      aiSummary: "Customer complaint about missing delivery.",
      postCallStatus: "complete",
      hasOpenAction: true,
    });

    assert.equal(status.label, "Complaint");
    assert.equal(status.tone, "review");
    assert.equal(CALL_HISTORY_STATUS_BADGE_CLASSES[status.tone], ATTENTION_TAG_RED_CLASS);
  });

  it("uses amber styling for orders with open actions", () => {
    const status = resolveCallHistoryListStatus({
      outcome: "action_created",
      aiSummary: "Birthday cake order for Saturday.",
      postCallStatus: "complete",
      hasOpenAction: true,
    });

    assert.equal(status.label, "Order");
    assert.equal(status.tone, "follow_up");
    assert.equal(CALL_HISTORY_STATUS_BADGE_CLASSES[status.tone], ATTENTION_TAG_AMBER_CLASS);
  });

  it("uses red styling for urgent follow-ups", () => {
    const status = resolveCallHistoryListStatus({
      outcome: "callback_requested",
      aiSummary: "Urgent callback — stock issue on shelf.",
      postCallStatus: "complete",
      hasOpenAction: true,
    });

    assert.equal(status.label, "Urgent");
    assert.equal(status.tone, "review");
  });
});

describe("resolveCallHistoryNeedsAttention", () => {
  it("counts follow-up outcomes even without a linked open ticket", () => {
    assert.equal(
      resolveCallHistoryNeedsAttention({
        outcome: "action_created",
        aiSummary: "Birthday cake order for seven people.",
        postCallStatus: "complete",
        hasOpenAction: false,
      }),
      true,
    );
  });

  it("does not count resolved answered calls", () => {
    assert.equal(
      resolveCallHistoryNeedsAttention({
        outcome: "answered",
        aiSummary: "Asked about opening hours and got the information needed.",
        postCallStatus: "complete",
        hasOpenAction: false,
      }),
      false,
    );
  });

  it("counts incomplete social-only calls that ended without an errand", () => {
    const summary =
      "The caller called to greet the business and ask how the assistant was doing. No specific request was made. The call ended without any action taken.";
    const status = resolveCallHistoryListStatus({
      outcome: "answered",
      aiSummary: summary,
      postCallStatus: "complete",
      hasOpenAction: false,
      callResolution: "incomplete",
    });

    assert.equal(status.label, "Review");
    assert.equal(status.tone, "review");
    assert.equal(
      resolveCallHistoryNeedsAttention({
        outcome: "answered",
        aiSummary: summary,
        postCallStatus: "complete",
        hasOpenAction: false,
        callResolution: "incomplete",
      }),
      true,
    );
  });

  it("prefers post-call callResolution over summary regex for resolved calls", () => {
    const status = resolveCallHistoryListStatus({
      outcome: "answered",
      aiSummary: "The call ended without any action required.",
      postCallStatus: "complete",
      hasOpenAction: false,
      callResolution: "resolved",
    });

    assert.equal(status.label, "Resolved");
    assert.equal(status.tone, "resolved");
  });
});
