import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildHomeCallTimesBuckets,
  homeCallTimesReadyForChart,
  homeCallTimesTotal,
} from "./dashboard-home-call-times";

describe("homeCallTimesReadyForChart", () => {
  it("is false for a single busy hour with few calls", () => {
    const buckets = buildHomeCallTimesBuckets([
      "2026-06-19T15:00:00.000Z",
      "2026-06-19T15:05:00.000Z",
      "2026-06-19T15:10:00.000Z",
      "2026-06-19T15:15:00.000Z",
    ]);
    assert.equal(homeCallTimesReadyForChart(buckets), false);
  });

  it("is true once enough calls accumulate", () => {
    const buckets = buildHomeCallTimesBuckets(
      Array.from({ length: 5 }, (_, index) =>
        new Date(Date.UTC(2026, 5, 19, 15, index)).toISOString(),
      ),
    );
    assert.equal(homeCallTimesReadyForChart(buckets), true);
  });

  it("spreads buckets across business hours instead of one bar", () => {
    const buckets = buildHomeCallTimesBuckets([
      "2026-06-19T15:00:00.000Z",
    ]);
    assert.equal(buckets.length, 11);
    assert.equal(buckets.find((b) => b.label === "4pm")?.value, 1);
  });

  it("buckets by Dublin local hour and ignores late-night UTC spikes", () => {
    const buckets = buildHomeCallTimesBuckets([
      "2026-08-23T23:00:00.000Z",
      "2026-08-23T08:00:00.000Z",
      "2026-08-23T09:00:00.000Z",
    ]);
    assert.equal(buckets.find((b) => b.label === "9am")?.value, 1);
    assert.equal(buckets.find((b) => b.label === "10am")?.value, 1);
    assert.equal(homeCallTimesTotal(buckets), 2);
  });
});
