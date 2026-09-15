import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCallsPageHref,
  dashboardMetricRangeForTimestamp,
} from "./calls-page-href";

const NOW = new Date("2026-09-15T12:00:00.000Z");

describe("calls-page-href", () => {
  it("maps timestamps to the smallest covering range", () => {
    assert.equal(
      dashboardMetricRangeForTimestamp("2026-09-15T10:00:00.000Z", NOW),
      "today",
    );
    assert.equal(
      dashboardMetricRangeForTimestamp("2026-09-14T17:00:00.000Z", NOW),
      "7d",
    );
    assert.equal(
      dashboardMetricRangeForTimestamp("2026-08-01T10:00:00.000Z", NOW),
      "4w",
    );
  });

  it("builds href with range for yesterday calls", () => {
    assert.equal(
      buildCallsPageHref(
        {
          callLogId: "abc-123",
          callCreatedAt: "2026-09-14T17:37:00.000Z",
        },
        NOW,
      ),
      "/dashboard/calls?call=abc-123&range=7d",
    );
  });

  it("omits range param for calls today", () => {
    assert.equal(
      buildCallsPageHref(
        {
          callLogId: "abc-123",
          callCreatedAt: "2026-09-15T10:00:00.000Z",
        },
        NOW,
      ),
      "/dashboard/calls?call=abc-123",
    );
  });
});
