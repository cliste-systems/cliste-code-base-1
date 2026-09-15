import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  callerDataErasureSummary,
  isCallerDataErased,
} from "@/lib/caller-data-erasure";
import { ticketCallerLabel } from "@/lib/dashboard-feed-time";

describe("caller-data-erasure", () => {
  it("detects erasure from call log audit fields", () => {
    assert.equal(
      isCallerDataErased({
        callerDataErasedAt: "2026-09-15T16:22:20.569Z",
        callerDataErasedByLabel: "Garreth Ferry",
        callerDataErasedReason: "Customer wanted",
      }),
      true,
    );
  });

  it("detects erasure from generic audit fields", () => {
    assert.equal(
      isCallerDataErased({
        erasedAt: "2026-09-15T16:22:20.569Z",
      }),
      true,
    );
  });

  it("returns false when no erasure timestamp is present", () => {
    assert.equal(isCallerDataErased({ callerDataErasedByLabel: "Staff" }), false);
  });

  it("builds a readable erasure summary", () => {
    const summary = callerDataErasureSummary({
      callerDataErasedAt: "2026-09-15T16:22:20.569Z",
      callerDataErasedByLabel: "Garreth Ferry",
      callerDataErasedReason: "Customer wanted",
    });
    assert.match(summary, /Garreth Ferry/);
    assert.match(summary, /Customer wanted/);
  });

  it("treats erased sentinel numbers as erased in feed labels", () => {
    assert.equal(
      ticketCallerLabel({
        caller_name: "Moira",
        caller_number: "+000000000000",
      }),
      "Caller data erased",
    );
  });
});
