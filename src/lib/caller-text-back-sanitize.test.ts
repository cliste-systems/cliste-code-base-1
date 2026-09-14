import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  finalizeCallerTextBackMiddle,
  heuristicSanitizeCallerTextBackMiddle,
  parseCallerTextBackReviewJson,
} from "./caller-text-back-sanitize";

describe("heuristicSanitizeCallerTextBackMiddle", () => {
  it("replaces em dashes with commas", () => {
    assert.equal(
      heuristicSanitizeCallerTextBackMiddle(
        "we can have it ready — collection after 5",
      ),
      "We can have it ready, collection after 5",
    );
  });

  it("removes em dashes on finalize", () => {
    assert.equal(
      finalizeCallerTextBackMiddle("Ready tomorrow — thanks"),
      "Ready tomorrow, thanks",
    );
  });
});

describe("parseCallerTextBackReviewJson", () => {
  it("reads message from json payload", () => {
    assert.equal(
      parseCallerTextBackReviewJson(
        JSON.stringify({ message: "Your order will be ready at 4pm." }),
      ),
      "Your order will be ready at 4pm.",
    );
  });
});
