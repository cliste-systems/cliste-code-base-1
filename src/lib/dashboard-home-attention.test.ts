import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildHomeAttentionItems,
  isCallNeedingHomeAttention,
} from "./dashboard-home-attention";

describe("dashboard home post-call attention", () => {
  it("flags partial and failed post_call_status for home attention", () => {
    assert.equal(isCallNeedingHomeAttention("answered", "partial"), true);
    assert.equal(isCallNeedingHomeAttention("answered", "failed"), true);
    assert.equal(isCallNeedingHomeAttention("answered", "complete"), false);
  });

  it("builds processing issue attention rows", () => {
    const items = buildHomeAttentionItems({
      openTickets: [],
      calls: [
        {
          id: "call-1",
          created_at: "2026-06-20T17:28:00.000Z",
          outcome: "action_created",
          caller_number: "+353872715938",
          caller_name: "Brendan",
          post_call_status: "partial",
        },
      ],
      callerLabel: (row) => row.caller_name ?? row.caller_number ?? "Unknown",
      callOutcomeLabel: () => "Enquiry captured",
      formatTime: () => "Today",
    });

    assert.equal(items.length, 1);
    assert.equal(items[0]?.badge, "Processing issue");
    assert.match(items[0]?.href ?? "", /call=call-1/);
  });
});
