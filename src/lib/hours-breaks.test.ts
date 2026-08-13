import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HOURS_BREAKS_JOINER,
  canAddHoursBreak,
  parseHoursBreaks,
  serializeHoursBreaks,
} from "./hours-breaks";

describe("hours-breaks", () => {
  it("round-trips multiple breaks", () => {
    const items = ["Lunch break 12–1pm", "Closed Easter Sunday"];
    const raw = serializeHoursBreaks(items);
    assert.equal(raw, items.join(HOURS_BREAKS_JOINER));
    assert.deepEqual(parseHoursBreaks(raw), items);
  });

  it("parses legacy single-line note as one chip", () => {
    assert.deepEqual(parseHoursBreaks("lunch break 12-1pm"), ["lunch break 12-1pm"]);
  });

  it("blocks when max items reached", () => {
    const items = Array.from({ length: 6 }, (_, i) => `Break ${i + 1}`);
    const result = canAddHoursBreak(items, "Another");
    assert.equal(result.ok, false);
  });
});
