import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { landlineDivertInstructions } from "./landline-divert-instructions";

describe("landlineDivertInstructions", () => {
  it("returns Eir portal steps for forward_all", () => {
    const blocks = landlineDivertInstructions(
      "eir",
      "+353749389378",
      "forward_all",
    );
    assert.ok(blocks.length >= 1);
    assert.match(blocks[0]!.title, /Eir/i);
  });
});
