import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCallsPageHref } from "./calls-page-href";

const NOW = new Date("2026-09-15T12:00:00.000Z");

describe("calls-page-href", () => {
  it("builds href with date for yesterday calls", () => {
    assert.equal(
      buildCallsPageHref(
        {
          callLogId: "abc-123",
          callCreatedAt: "2026-09-14T17:37:00.000Z",
        },
        NOW,
      ),
      "/dashboard/calls?call=abc-123&date=2026-09-14",
    );
  });

  it("omits date param for calls today", () => {
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

  it("supports explicit date without a call id", () => {
    assert.equal(
      buildCallsPageHref({ date: "2026-09-10" }, NOW),
      "/dashboard/calls?date=2026-09-10",
    );
  });
});
