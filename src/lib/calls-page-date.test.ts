import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  callsPageDateForTimestamp,
  formatCallsPageDateParam,
  getCallsPageDayBoundsIso,
  isCallsPageToday,
  parseCallsPageDateParam,
} from "./calls-page-date";

const NOW = new Date("2026-09-15T12:00:00.000Z");

describe("calls-page-date", () => {
  it("defaults to today in Dublin when date param is missing", () => {
    assert.equal(formatCallsPageDateParam(parseCallsPageDateParam(undefined, NOW), NOW), "2026-09-15");
  });

  it("parses explicit YYYY-MM-DD params as Dublin calendar days", () => {
    assert.equal(
      formatCallsPageDateParam(parseCallsPageDateParam("2026-09-14", NOW), NOW),
      "2026-09-14",
    );
  });

  it("returns inclusive/exclusive day bounds in UTC", () => {
    const { lowerInclusive, upperExclusive } = getCallsPageDayBoundsIso(
      parseCallsPageDateParam("2026-09-14", NOW),
    );
    assert.equal(lowerInclusive, "2026-09-13T23:00:00.000Z");
    assert.equal(upperExclusive, "2026-09-14T23:00:00.000Z");
  });

  it("maps call timestamps to their Dublin calendar date", () => {
    assert.equal(
      callsPageDateForTimestamp("2026-09-14T17:37:00.000Z", NOW),
      "2026-09-14",
    );
    assert.equal(
      callsPageDateForTimestamp("2026-09-15T10:00:00.000Z", NOW),
      "2026-09-15",
    );
  });

  it("detects today", () => {
    assert.equal(isCallsPageToday(parseCallsPageDateParam(undefined, NOW), NOW), true);
    assert.equal(isCallsPageToday(parseCallsPageDateParam("2026-09-14", NOW), NOW), false);
  });
});
