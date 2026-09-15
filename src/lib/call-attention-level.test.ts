import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  attentionRowAccent,
  resolveAttentionTag,
  resolveCallAttentionLevel,
  resolveTicketAttentionLevel,
  isUrgentActionCategory,
} from "./call-attention-level";

describe("resolveCallAttentionLevel", () => {
  it("returns routine for handled calls with no open follow-up", () => {
    assert.equal(
      resolveCallAttentionLevel({
        hasOpenAction: false,
        postCallStatus: "complete",
        outcome: "answered",
        aiSummary: "Caller asked what time the shop closes.",
      }),
      "routine",
    );
  });

  it("returns follow_up for department orders with open tickets", () => {
    assert.equal(
      resolveCallAttentionLevel({
        hasOpenAction: true,
        postCallStatus: "complete",
        outcome: "action_created",
        aiSummary: "Birthday cake order for Saturday — bakery team to confirm.",
      }),
      "follow_up",
    );
  });

  it("returns urgent for complaints", () => {
    assert.equal(
      resolveCallAttentionLevel({
        hasOpenAction: true,
        postCallStatus: "complete",
        outcome: "action_created",
        followUpSummary: "Caller was unhappy about out-of-date bread — wants manager callback.",
      }),
      "urgent",
    );
  });

  it("returns urgent for explicit urgent language", () => {
    assert.equal(
      resolveCallAttentionLevel({
        hasOpenAction: true,
        postCallStatus: "complete",
        outcome: "callback_requested",
        followUpSummary: "Urgent callback needed about click and collect order.",
      }),
      "urgent",
    );
  });

  it("returns urgent when post-call processing failed", () => {
    assert.equal(
      resolveCallAttentionLevel({
        hasOpenAction: false,
        postCallStatus: "failed",
        outcome: "answered",
      }),
      "urgent",
    );
  });
});

describe("resolveTicketAttentionLevel", () => {
  it("returns urgent for complaint tickets", () => {
    assert.equal(resolveTicketAttentionLevel("complaint", "open"), "urgent");
  });

  it("returns follow_up for open bakery orders", () => {
    assert.equal(resolveTicketAttentionLevel("follow_up", "open"), "follow_up");
  });

  it("returns routine for resolved tickets", () => {
    assert.equal(resolveTicketAttentionLevel("complaint", "resolved"), "routine");
  });
});

describe("resolveAttentionTag", () => {
  it("shows Complaint in red for complaint tickets", () => {
    const tag = resolveAttentionTag({
      level: "urgent",
      category: "complaint",
    });
    assert.equal(tag?.label, "Complaint");
    assert.match(tag?.tagClassName ?? "", /red/);
  });

  it("shows Urgent for explicit urgent language", () => {
    const tag = resolveAttentionTag({
      level: "urgent",
      category: "urgent",
    });
    assert.equal(tag?.label, "Urgent");
  });

  it("shows Order for bakery orders", () => {
    const tag = resolveAttentionTag({
      level: "follow_up",
      category: "order",
    });
    assert.equal(tag?.label, "Order");
    assert.match(tag?.tagClassName ?? "", /amber/);
  });

  it("shows Request for generic department items", () => {
    const tag = resolveAttentionTag({
      level: "follow_up",
      category: "follow_up",
    });
    assert.equal(tag?.label, "Request");
    assert.match(tag?.tagClassName ?? "", /amber/);
  });
});
