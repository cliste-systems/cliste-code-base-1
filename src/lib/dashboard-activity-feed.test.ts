import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDashboardActivityFeed } from "./dashboard-activity-feed";
import { activityFeedCallerLabel } from "./dashboard-feed-time";
import { formatActivityFeedBadge } from "./dashboard-live-activity";

describe("activityFeedCallerLabel", () => {
  it("shows phone number instead of caller name", () => {
    assert.equal(
      activityFeedCallerLabel({
        caller_name: "Mark",
        caller_number: "+353872715938",
      }),
      "+353 87 271 5938",
    );
  });
});

describe("formatActivityFeedBadge", () => {
  it("classifies birthday cake orders", () => {
    assert.equal(
      formatActivityFeedBadge({
        summary:
          "Stephen called to order a birthday cake for Sean with blue icing.",
      }),
      "Order",
    );
  });

  it("classifies complaints", () => {
    assert.equal(
      formatActivityFeedBadge({
        summary: "Complaint — product return for chicken bought last week.",
      }),
      "Complaint",
    );
  });

  it("falls back to Call when there is no summary", () => {
    assert.equal(
      formatActivityFeedBadge({ outcome: "answered" }),
      "Call",
    );
  });
});

describe("buildDashboardActivityFeed", () => {
  it("uses phone labels and request-type badges", () => {
    const rows = buildDashboardActivityFeed({
      calls: [],
      tickets: [
        {
          id: "t1",
          created_at: "2026-09-17T12:00:00.000Z",
          caller_name: "Brendan",
          caller_number: "+353872715938",
          summary: "Birthday cake order for Friday collection.",
        },
      ],
      formatTime: () => "1 hour ago",
    });

    assert.equal(rows[0]?.title, "+353 87 271 5938");
    assert.equal(rows[0]?.badge, "Order");
  });
});
