import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildErasedCallerHistoryInsight,
  buildCallerHistoryInsight,
  formatCallerHistoryDateLabel,
} from "./caller-history-insight";
import {
  resolveCallHistoryStatus,
} from "./call-history-status";

const NOW = new Date("2026-09-15T12:00:00.000Z");

function call(
  id: string,
  createdAt: string,
  overrides: Partial<{
    callerName: string | null;
    outcome: string;
    aiSummary: string | null;
    durationSeconds: number;
  }> = {},
) {
  return {
    id,
    createdAt,
    callerName: overrides.callerName ?? null,
    outcome: overrides.outcome ?? "answered",
    aiSummary: overrides.aiSummary ?? "General enquiry about opening hours.",
    durationSeconds: overrides.durationSeconds ?? 90,
  };
}

describe("caller-history-insight", () => {
  it("returns erased insight without security profiling", () => {
    const insight = buildErasedCallerHistoryInsight({
      callerDataErasedAt: "2026-09-15T16:22:20.569Z",
      callerDataErasedByLabel: "Garreth Ferry",
      callerDataErasedReason: "Customer wanted",
    });
    assert.equal(insight.kind, "erased");
    assert.match(insight.overview, /Garreth Ferry/);
    assert.equal("security" in insight, false);
  });

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
    assert.equal(
      insight.recentCalls[0]?.summary,
      "Asked about bakery cake order.",
    );
    assert.equal(insight.recentCalls[0]?.statusLabel, "Resolved");
    assert.equal(insight.recentCalls[0]?.statusTone, "resolved");
    assert.match(insight.overview, /3 calls/);
    assert.match(insight.overview, /Mostly/);
    assert.match(insight.overview, /bakery orders/i);
    assert.doesNotMatch(insight.overview, /Recent calls were about/i);
    assert.doesNotMatch(insight.overview, /usually call about/i);
    assert.doesNotMatch(insight.overview, /frequent caller over the past week/i);
    assert.equal(insight.security.level, "low");
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

  it("builds a Cara overview for repeat callers", () => {
    const insight = buildCallerHistoryInsight({
      callerNumber: "+353871234567",
      calls: [
        call("c", "2026-09-15T11:00:00.000Z", {
          callerName: "Mark",
          aiSummary: "Birthday cake order for seven people.",
        }),
        call("b", "2026-09-14T11:00:00.000Z", {
          callerName: "Mark",
          aiSummary: "Follow-up on bakery order.",
        }),
      ],
      openTickets: [],
      isBlocked: false,
      now: NOW,
    });

    assert.equal(insight.kind, "repeat");
    if (insight.kind !== "repeat") return;
    assert.match(insight.overview, /Mark has made 2 calls/);
    assert.match(insight.overview, /Mostly bakery orders/i);
    assert.doesNotMatch(insight.overview, /birthday cake/i);
    assert.doesNotMatch(insight.overview, /…/);
    assert.equal(insight.security.level, "low");
  });

  it("uses real call details and avoids repeating security flags in Cara's read", () => {
    const calls = [
      call("latest", "2026-09-15T15:00:00.000Z", {
        callerName: "Brendan",
        aiSummary:
          "The caller enquired about the availability of toilets in the store. The query was resolved successfully.",
      }),
      call("cake-mark", "2026-09-15T13:00:00.000Z", {
        callerName: "Brendan",
        outcome: "action_created",
        aiSummary:
          "Mark called to order a birthday cake for 7 people with the message Happy birthday, Francis.",
      }),
      call("cake-moira", "2026-09-15T12:40:00.000Z", {
        callerName: "Brendan",
        outcome: "action_created",
        aiSummary: "Caller ordered a birthday cake for Moira.",
      }),
      ...Array.from({ length: 8 }, (_, index) =>
        call(`older-${index}`, new Date(NOW.getTime() - (index + 1) * 3_600_000).toISOString(), {
          callerName: "Brendan",
          aiSummary: `General enquiry ${index}.`,
        }),
      ),
    ];

    const insight = buildCallerHistoryInsight({
      callerNumber: "+353872715938",
      calls,
      openTickets: [
        { status: "open", summary: "Delivery complaint", departmentSlug: "management" },
        { status: "open", summary: "Cake order", departmentSlug: "bakery" },
        { status: "open", summary: "Cake order 2", departmentSlug: "bakery" },
        { status: "open", summary: "Stock check", departmentSlug: "shop-floor" },
        { status: "open", summary: "Hours query", departmentSlug: "customer-care" },
        { status: "open", summary: "Refund request", departmentSlug: "management" },
      ],
      isBlocked: false,
      now: NOW,
    });

    assert.equal(insight.kind, "repeat");
    if (insight.kind !== "repeat") return;
    assert.match(insight.overview, /Brendan has made 11 calls/i);
    assert.match(insight.overview, /Mostly general enquiries/i);
    assert.match(insight.overview, /6 open requests/i);
    assert.doesNotMatch(insight.overview, /toilets/i);
    assert.doesNotMatch(insight.overview, /birthday cake/i);
    assert.doesNotMatch(insight.overview, /Moira|Francis|Mark called/i);
    assert.doesNotMatch(insight.overview, /information request, general enquiry/i);
    assert.doesNotMatch(insight.overview, /Cara has flagged them as a frequent caller/i);
    assert.doesNotMatch(insight.overview, /called several times in the last 24 hours/i);
    assert.doesNotMatch(insight.overview, /open complaint tickets linked to this number/i);
    assert.doesNotMatch(insight.overview, /\.,/);
    assert.doesNotMatch(insight.overview, /\.\./);
  });

  it("summarises call themes without specific details", () => {
    const insight = buildCallerHistoryInsight({
      callerNumber: "+353872715938",
      calls: [
        call("a", "2026-09-15T15:00:00.000Z", {
          callerName: "Brendan",
          aiSummary:
            "The caller enquired about the availability of toilets. The query was resolved successfully.",
        }),
        call("b", "2026-09-15T13:00:00.000Z", {
          callerName: "Brendan",
          outcome: "action_created",
          aiSummary: "Mark called to order a birthday cake for 7 people.",
        }),
        call("c", "2026-09-15T12:00:00.000Z", {
          callerName: "Brendan",
          outcome: "action_created",
          aiSummary: "Moira called to order a birthday cake for 17 people.",
        }),
      ],
      openTickets: [],
      isBlocked: false,
      now: NOW,
    });

    assert.equal(insight.kind, "repeat");
    if (insight.kind !== "repeat") return;
    assert.equal(
      insight.overview,
      "Brendan has made 3 calls today. Mostly bakery orders and store information.",
    );
  });

  it("includes security prefix for blocked callers", () => {
    const insight = buildCallerHistoryInsight({
      callerNumber: "+353871234567",
      calls: [
        call("a", "2026-09-15T10:00:00.000Z"),
        call("b", "2026-09-14T10:00:00.000Z"),
      ],
      openTickets: [],
      isBlocked: true,
      now: NOW,
    });
    if (insight.kind === "erased") {
      assert.fail("expected non-erased insight");
    }
    assert.equal(insight.security.level, "high");
    assert.match(insight.overview, /high risk/i);
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

  it("marks resolved, follow-up, and failure statuses", () => {
    assert.deepEqual(
      resolveCallHistoryStatus({
        outcome: "answered",
        summary: "Asked about opening hours and got the information needed.",
      }),
      { label: "Resolved", tone: "resolved" },
    );
    assert.deepEqual(
      resolveCallHistoryStatus({
        outcome: "action_created",
        summary: "Birthday cake order for seven people.",
      }),
      { label: "Order", tone: "follow_up" },
    );
    assert.deepEqual(
      resolveCallHistoryStatus({
        outcome: "callback_requested",
        summary: "Caller asked us to ring them back about stock.",
      }),
      { label: "Callback", tone: "follow_up" },
    );
    assert.deepEqual(
      resolveCallHistoryStatus({
        outcome: "answered",
        summary: "Caller wants to speak to the manager about a delivery issue",
        hasOpenAction: true,
      }),
      { label: "Complaint", tone: "review" },
    );
    assert.deepEqual(
      resolveCallHistoryStatus({
        outcome: "failed",
        summary: "Call ended before Cara could help.",
      }),
      { label: "Review", tone: "review" },
    );
    assert.deepEqual(
      resolveCallHistoryStatus({
        outcome: "answered",
        summary: "Caller hung up before giving details.",
      }),
      { label: "Review", tone: "review" },
    );
    assert.deepEqual(
      resolveCallHistoryStatus({
        outcome: "answered",
        summary:
          "The caller called to greet the business and ask how the assistant was doing. No specific request was made. The call ended without any action taken.",
      }),
      { label: "Review", tone: "review" },
    );
    assert.deepEqual(
      resolveCallHistoryStatus({
        outcome: "answered",
        summary: null,
        postCallStatus: "complete",
      }),
      { label: "Resolved", tone: "resolved" },
    );
    assert.deepEqual(
      resolveCallHistoryStatus({
        outcome: "answered",
        summary: "General enquiry.",
        postCallStatus: "failed",
      }),
      { label: "Review", tone: "review" },
    );
    assert.deepEqual(
      resolveCallHistoryStatus({
        outcome: "answered",
        summary: "Birthday cake order for Mark.",
        hasOpenAction: true,
      }),
      { label: "Order", tone: "follow_up" },
    );
  });
});
