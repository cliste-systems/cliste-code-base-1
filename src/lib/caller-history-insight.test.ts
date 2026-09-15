import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCallerHistoryInsight,
  formatCallerHistoryDateLabel,
} from "./caller-history-insight";

const NOW = new Date("2026-09-15T12:00:00.000Z");

function call(
  id: string,
  createdAt: string,
  overrides: Partial<{
    callerName: string | null;
    outcome: string;
    aiSummary: string | null;
  }> = {},
) {
  return {
    id,
    createdAt,
    callerName: overrides.callerName ?? null,
    outcome: overrides.outcome ?? "answered",
    aiSummary: overrides.aiSummary ?? "General enquiry about opening hours.",
  };
}

describe("caller-history-insight", () => {
  it("returns anonymous for withheld numbers", () => {
    const insight = buildCallerHistoryInsight({
      callerNumber: "+anonymous",
      calls: [],
      openTickets: [],
      isBlocked: false,
      now: NOW,
    });
    assert.equal(insight.kind, "anonymous");
  });

  it("returns first_call for a single prior call", () => {
    const insight = buildCallerHistoryInsight({
      callerNumber: "+353871234567",
      calls: [call("a", "2026-09-15T10:00:00.000Z")],
      openTickets: [],
      isBlocked: false,
      now: NOW,
    });
    assert.equal(insight.kind, "first_call");
    if (insight.kind !== "first_call") return;
    assert.deepEqual(insight.securityFlags, []);
  });

  it("builds repeat caller stats and recent calls", () => {
    const insight = buildCallerHistoryInsight({
      callerNumber: "+353871234567",
      calls: [
        call("c", "2026-09-15T11:00:00.000Z", {
          aiSummary: "Asked about bakery cake order.",
        }),
        call("b", "2026-09-10T11:00:00.000Z", {
          aiSummary: "Opening hours on Sunday.",
        }),
        call("a", "2026-09-01T11:00:00.000Z", {
          aiSummary: "Meat counter pre-order.",
        }),
      ],
      openTickets: [{ status: "open", summary: "Cake order", departmentSlug: "bakery" }],
      isBlocked: false,
      now: NOW,
    });

    assert.equal(insight.kind, "repeat");
    if (insight.kind !== "repeat") return;
    assert.equal(insight.totalCalls, 3);
    assert.equal(insight.openFollowUps, 1);
    assert.equal(insight.recentCalls.length, 3);
    assert.equal(insight.recentCalls[0]?.id, "c");
    assert.equal(insight.recentCalls[0]?.intentLabel, "General enquiry");
  });

  it("flags frequent caller, high volume, multiple names, and open complaints", () => {
    const calls = Array.from({ length: 5 }, (_, index) =>
      call(`id-${index}`, new Date(NOW.getTime() - index * 60 * 60 * 1000).toISOString(), {
        callerName: index % 2 === 0 ? "Sarah" : "Sarah Murphy",
      }),
    );

    const insight = buildCallerHistoryInsight({
      callerNumber: "+353871234567",
      calls,
      openTickets: [
        {
          status: "open",
          summary: "Caller wants to speak to the manager about a delivery issue",
          departmentSlug: "management",
        },
      ],
      isBlocked: true,
      now: NOW,
    });

    assert.equal(insight.kind, "repeat");
    if (insight.kind !== "repeat") return;
    assert.ok(insight.securityFlags.includes("blocked"));
    assert.ok(insight.securityFlags.includes("frequent_caller"));
    assert.ok(insight.securityFlags.includes("high_volume_today"));
    assert.ok(insight.securityFlags.includes("multiple_names"));
    assert.ok(insight.securityFlags.includes("open_complaints"));
  });

  it("formats today and yesterday labels", () => {
    assert.equal(
      formatCallerHistoryDateLabel("2026-09-15T08:00:00.000Z", NOW),
      "today",
    );
    assert.equal(
      formatCallerHistoryDateLabel("2026-09-14T08:00:00.000Z", NOW),
      "yesterday",
    );
  });
});
