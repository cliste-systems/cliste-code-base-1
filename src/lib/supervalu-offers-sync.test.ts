import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isSupervaluOfferWeekStale,
  shouldSkipThursdayOffersSync,
} from "./supervalu-offers-sync";

describe("supervalu-offers-sync", () => {
  it("detects stale offer weeks", () => {
    assert.equal(
      isSupervaluOfferWeekStale(
        { offerWeekStart: "2026-09-10", offerWeekEnd: "2026-09-16" },
        new Date("2026-09-20T12:00:00Z"),
      ),
      true,
    );
    assert.equal(
      isSupervaluOfferWeekStale(
        { offerWeekStart: "2026-09-17", offerWeekEnd: "2026-09-23" },
        new Date("2026-09-20T12:00:00Z"),
      ),
      false,
    );
  });

  it("skips repeat Thursday crons after a successful same-day sync", () => {
    assert.equal(
      shouldSkipThursdayOffersSync(
        {
          syncedAt: "2026-09-24T01:10:00.000Z",
          offerCount: 2000,
          offerWeekStart: "2026-09-24",
          offerWeekEnd: "2026-09-30",
        },
        new Date("2026-09-24T06:05:00.000Z"),
      ),
      true,
    );
    assert.equal(
      shouldSkipThursdayOffersSync(
        {
          syncedAt: "2026-09-18T07:00:00.000Z",
          offerCount: 2000,
          offerWeekStart: "2026-09-17",
          offerWeekEnd: "2026-09-23",
        },
        new Date("2026-09-24T06:05:00.000Z"),
      ),
      false,
    );
  });
});
