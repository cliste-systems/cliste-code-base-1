import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detectTrainingAnswerAmbiguity,
  formatTrainingUnderstandingAssistantMessage,
  inferTrainingAnswerPattern,
  needsTrainingUnderstandingDraft,
} from "./cara-training-understanding-guards";

describe("detectTrainingAnswerAmbiguity", () => {
  it("flags contradictory yes/no selection", () => {
    assert.match(
      detectTrainingAnswerAmbiguity({
        ownerAnswer: "yes we do",
        caraQuestion: "Do we have a coin machine?",
        quickChoice: "no",
      }) ?? "",
      /selected No/i,
    );
  });

  it("does not hard-code domain-specific ambiguity checks", () => {
    assert.equal(
      detectTrainingAnswerAmbiguity({
        ownerAnswer: "open till 5 or 6",
        caraQuestion: "What time do you close?",
      }),
      null,
    );
    assert.equal(
      detectTrainingAnswerAmbiguity({
        ownerAnswer: "We close at 5pm on Monday the 17th.",
        caraQuestion: "What should callers know about closing times?",
      }),
      null,
    );
    assert.equal(
      detectTrainingAnswerAmbiguity({
        ownerAnswer: "we close at 1m",
        caraQuestion: "What should callers know about closing times?",
      }),
      null,
    );
  });

  it("allows clear location answers", () => {
    assert.equal(
      detectTrainingAnswerAmbiguity({
        ownerAnswer: "toilets beside barbr shop outside ours in mall",
        caraQuestion: "Where are the customer toilets?",
        quickChoice: "yes",
      }),
      null,
    );
  });
});

describe("needsTrainingUnderstandingDraft", () => {
  it("skips LLM for bare yes/no", () => {
    assert.equal(
      needsTrainingUnderstandingDraft({ ownerAnswer: "Yes.", quickChoice: "yes" }),
      false,
    );
    assert.equal(
      needsTrainingUnderstandingDraft({ ownerAnswer: "No.", quickChoice: "no" }),
      false,
    );
  });

  it("requires LLM for substantive notes", () => {
    assert.equal(
      needsTrainingUnderstandingDraft({
        ownerAnswer: "beside the tills",
        quickChoice: "yes",
      }),
      true,
    );
    assert.equal(
      needsTrainingUnderstandingDraft({
        ownerAnswer: "48 hrs notice otherwise ask bakery",
        quickChoice: "depends",
      }),
      true,
    );
  });
});

describe("inferTrainingAnswerPattern", () => {
  it("classifies toilet location questions", () => {
    assert.equal(
      inferTrainingAnswerPattern({
        gapSummary: "Customer toilets",
        caraQuestion: "Where are the customer toilets?",
        callerContext: "Caller asked where the toilets are.",
      }),
      "location",
    );
  });
});

describe("formatTrainingUnderstandingAssistantMessage", () => {
  it("stores understood text in assistant history", () => {
    assert.equal(
      formatTrainingUnderstandingAssistantMessage(
        "The customer toilets are in the mall, outside the shop, beside the barbershop.",
      ),
      "Understood: The customer toilets are in the mall, outside the shop, beside the barbershop.",
    );
  });
});
