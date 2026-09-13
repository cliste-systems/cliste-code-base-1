import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  trainingAnswerPlaceholder,
  trainingQuickResolveMode,
} from "./cara-training-helpers";

describe("trainingQuickResolveMode", () => {
  it("uses free text for opening hours and bank holidays", () => {
    assert.equal(
      trainingQuickResolveMode("St Patrick's Day opening hours"),
      "free_text",
    );
    assert.equal(trainingQuickResolveMode("Bank holiday opening hours"), "free_text");
  });

  it("uses service_offer for short service labels", () => {
    assert.equal(trainingQuickResolveMode("Hair extensions"), "service_offer");
    assert.equal(trainingQuickResolveMode("Balayage"), "service_offer");
  });

  it("defaults ambiguous topics to free text", () => {
    assert.equal(
      trainingQuickResolveMode("Something unusual about our delivery policy for large orders"),
      "free_text",
    );
  });
});

describe("trainingAnswerPlaceholder", () => {
  it("suggests hours wording for structured hours topics", () => {
    assert.match(
      trainingAnswerPlaceholder("St Patrick's Day opening hours"),
      /St Patrick/i,
    );
  });
});
