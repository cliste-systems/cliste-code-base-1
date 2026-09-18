import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyDemoTrainingAnswer,
  applyDemoTrainingConfirm,
  applyDemoTrainingDismiss,
  buildCaraTrainingDemoItems,
  CARA_TRAINING_DEMO_ITEM_IDS,
} from "./cara-training-demo-items";
import { classifyTrainingAdmission } from "./cara-training-admission";

describe("demo training actions", () => {
  it("only includes teachable demo rows", () => {
    for (const item of buildCaraTrainingDemoItems()) {
      const admission = classifyTrainingAdmission({
        gapSummary: item.gap_summary,
        callerContext: item.caller_context,
        caraQuestion: item.cara_question,
        source: item.source,
      });
      assert.equal(admission.admit, true, item.cara_question);
    }
  });

  it("answers a demo item locally without Supabase", () => {
    const item = buildCaraTrainingDemoItems().find(
      (row) => row.id === CARA_TRAINING_DEMO_ITEM_IDS.clickCollectToCarPark,
    );
    assert.ok(item);

    const result = applyDemoTrainingAnswer(item!, "Yes — staff can bring it to marked bays.");
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.item.status, "draft_ready");
    assert.equal(result.item.proposed_patch?.kind, "faq");
    if (result.item.proposed_patch?.kind === "faq") {
      assert.match(result.item.proposed_patch.answer, /marked bays/i);
    }
  });

  it("confirms and dismisses demo items locally", () => {
    const item = buildCaraTrainingDemoItems()[0];
    const answered = applyDemoTrainingAnswer(item, "Yes — beside the front tills.");
    assert.equal(answered.ok, true);
    if (!answered.ok) return;

    const confirmed = applyDemoTrainingConfirm(answered.item);
    assert.equal(confirmed.ok, true);
    if (!confirmed.ok) return;
    assert.equal(confirmed.item.status, "applied");

    const dismissed = applyDemoTrainingDismiss(item);
    assert.equal(dismissed.ok, true);
    if (!dismissed.ok) return;
    assert.equal(dismissed.item.status, "dismissed");
  });
});
