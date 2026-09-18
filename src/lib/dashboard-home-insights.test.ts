import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildHomeCallsToReviewRows,
  countHomeCallsToReview,
} from "./dashboard-home-calls-to-review";
import { buildHomeTopTopicRows } from "./dashboard-home-top-topics";

describe("dashboard-home-top-topics", () => {
  it("groups retail topics from summaries and training gaps", () => {
    const rows = buildHomeTopTopicRows({
      callSummaries: [
        "Caller asked about steak offers this week.",
        "Asked if toilet roll was on special.",
      ],
      ticketSummaries: ["Real Rewards points query"],
      trainingGaps: ["Toilet roll offers", "Butcher order — prep for collection"],
      limit: 4,
    });

    assert.ok(rows.some((row) => row.label === "Offers & promotions"));
    assert.ok(rows.some((row) => row.label === "Real Rewards"));
    assert.ok(rows.some((row) => row.label.includes("Butcher")));
  });
});

describe("dashboard-home-calls-to-review", () => {
  it("lists calls flagged for review", () => {
    const calls = [
      {
        id: "call-1",
        created_at: "2026-09-16T00:22:40.856956+00",
        outcome: "answered",
        ai_summary: "The caller hung up right after Cara's greeting.",
        call_resolution: "incomplete",
        caller_number: "+353872715938",
      },
      {
        id: "call-2",
        created_at: "2026-09-16T00:05:30.324608+00",
        outcome: "answered",
        ai_summary: "Caller asked about opening hours and left satisfied.",
        call_resolution: "resolved",
        caller_number: "+353871234567",
      },
    ];

    const rows = buildHomeCallsToReviewRows({
      calls,
      formatTime: () => "12h ago",
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, "call-1");
    assert.equal(countHomeCallsToReview(calls), 1);
  });
});
