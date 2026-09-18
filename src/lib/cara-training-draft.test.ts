import assert from "node:assert/strict";
import test from "node:test";

import { ownerInitiatedTeachMetadata } from "./cara-training-owner-initiated";

test("ownerInitiatedTeachMetadata stores owner text without LLM follow-up", () => {
  const meta = ownerInitiatedTeachMetadata({
    ownerDescription: "We're closing at 6pm today instead of 9pm.",
    temporalTitle: "Temporary opening hours",
  });

  assert.equal(meta.gapSummary, "Temporary opening hours");
  assert.equal(meta.caraQuestion, "We're closing at 6pm today instead of 9pm.");
  assert.doesNotMatch(meta.caraQuestion, /appointment/i);
  assert.doesNotMatch(meta.caraQuestion, /transaction/i);
});
