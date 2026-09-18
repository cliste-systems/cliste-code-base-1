import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyTrainingAdmission,
  hasReusableQuestionEvidence,
  isCustomerOperationalRequest,
  trainingQuestionDedupeKey,
} from "./cara-training-admission";
import { isRoutineHandoff } from "./cara-training-types";

describe("cara-training-admission", () => {
  it("admits coin machine as existence knowledge", () => {
    const result = classifyTrainingAdmission({
      gapSummary: "coin machine",
      callerContext: "Do you have a coin machine for change?",
      caraQuestion: "Do you have a coin machine available for customers?",
      source: "call_gap",
    });
    assert.equal(result.admit, true);
    if (result.admit) {
      assert.match(result.displayQuestion, /coin machine/i);
      assert.equal(result.answerPattern, "existence");
    }
  });

  it("rejects butcher customer orders as operational", () => {
    const summary =
      "Butcher order — prep for collection\nOrder: 7 Sirloin Steaks\nCollecting: Brendan\nWhen: After 7 o'clock";
    assert.equal(isCustomerOperationalRequest(summary), true);
    assert.equal(isRoutineHandoff(summary), true);
    const result = classifyTrainingAdmission({
      gapSummary: summary,
      callerContext: summary,
      caraQuestion: "What reusable information should Cara know for similar calls?",
      source: "action_inbox",
    });
    assert.equal(result.admit, false);
  });

  it("admits cake notice policy despite bakery wording", () => {
    const text = "How much notice is needed for a personalised celebration cake?";
    assert.equal(isRoutineHandoff(text), false);
    assert.equal(hasReusableQuestionEvidence(text), true);
    const result = classifyTrainingAdmission({
      gapSummary: text,
      source: "call_gap",
    });
    assert.equal(result.admit, true);
    if (result.admit) {
      assert.equal(result.answerPattern, "policy");
    }
  });

  it("rejects refund callback requests as operational", () => {
    const text =
      "Caller said the ham they bought yesterday tasted off and asked someone to call them back about a refund.";
    assert.equal(isCustomerOperationalRequest(text), true);
    const result = classifyTrainingAdmission({
      gapSummary: "Refund callback for ham",
      callerContext: text,
      caraQuestion: "What should Cara do when a caller wants a refund callback about ham?",
      source: "call_gap",
    });
    assert.equal(result.admit, false);
    if (!result.admit) {
      assert.equal(result.reason, "operational");
    }
  });

  it("keeps different coin-machine questions separate for dedupe", () => {
    const existence = trainingQuestionDedupeKey({
      gapSummary: "coin machine",
      caraQuestion: "Do we have a coin machine?",
    });
    const fee = trainingQuestionDedupeKey({
      gapSummary: "coin machine fee",
      caraQuestion: "What fee does the coin machine charge?",
    });
    assert.notEqual(existence, fee);
  });
});
