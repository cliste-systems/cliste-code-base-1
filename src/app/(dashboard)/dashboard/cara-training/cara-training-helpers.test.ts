import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyDeferredToTrainingItem,
  buildTrainingCallFacts,
  buildExistenceFaqPatch,
  canReviewExistenceAnswer,
  clearDeferredFromTrainingItem,
  emptyExistenceAnswerForm,
  existenceDetailsForSubmit,
  restoreExistenceAnswerForm,
  restoreOwnerAnswerForEdit,
  sortOpenTrainingItems,
  toggleTrainingItemDeferred,
  trainingAnswerPattern,
  trainingDisplayQuestion,
  trainingItemCallHref,
  trainingItemIsDeferred,
  trainingListSubtitle,
  trainingUsesQuickAnswerControls,
  understoodPreviewLines,
} from "./cara-training-helpers";
import type { CaraTrainingListItem } from "./cara-training-helpers";

function sampleItem(
  overrides: Partial<CaraTrainingListItem> = {},
): CaraTrainingListItem {
  return {
    id: "1",
    organization_id: "org",
    status: "awaiting_answer",
    source: "call_gap",
    call_log_id: "call",
    action_ticket_id: null,
    gap_summary: "coin machine",
    caller_context: "Caller asked about a coin machine.",
    cara_question: "Do you have a coin machine available for customers?",
    owner_messages: [],
    proposed_patch: null,
    applied_patch: null,
    target_section: null,
    applied_at: null,
    applied_by: null,
    dismissed_at: null,
    occurrence_count: 1,
    last_seen_at: "2026-09-17T14:33:57.708Z",
    created_at: "2026-09-17T14:33:57.708Z",
    updated_at: "2026-09-17T14:33:57.708Z",
  ...overrides,
  };
}

describe("trainingItemCallHref", () => {
  it("builds a call history deep link when a call id exists", () => {
    assert.equal(
      trainingItemCallHref("abc-123"),
      "/dashboard/calls?call=abc-123",
    );
    assert.equal(trainingItemCallHref(null), null);
  });
});

describe("buildTrainingCallFacts", () => {
  it("formats call chips for the training detail header", () => {
    const facts = buildTrainingCallFacts(sampleItem(), {
      created_at: "2026-09-17T14:33:57.708Z",
      duration_seconds: 134,
      caller_number: "+353871234567",
    });
    assert.ok(facts);
    assert.match(facts?.whenLabel ?? "", /Sep/i);
    assert.equal(facts?.durationLabel, "2m 14s");
    assert.match(facts?.callerLabel ?? "", /353/);
  });
});

describe("training display helpers", () => {
  it("shows a clear question instead of a raw topic label", () => {
    const label = trainingDisplayQuestion(sampleItem());
    assert.match(label, /coin machine/i);
  });

  it("classifies coin machine as existence pattern", () => {
    assert.equal(trainingAnswerPattern(sampleItem()), "existence");
    assert.equal(trainingUsesQuickAnswerControls(sampleItem()), false);
  });

  it("uses written answers for facility location questions", () => {
    const toilets = sampleItem({
      cara_question: "Where are the customer toilets?",
      gap_summary: "Customer toilets",
      caller_context:
        "Caller asked where the customer toilets are — they thought they were in the mall corridor outside the shop.",
    });
    assert.equal(trainingAnswerPattern(toilets), "location");
    assert.equal(trainingUsesQuickAnswerControls(toilets), false);
  });
});

describe("buildExistenceFaqPatch", () => {
  it("creates FAQ answers instead of service chips", () => {
    const patch = buildExistenceFaqPatch({
      question: "Do we have a coin machine?",
      choice: "yes",
      details: "Yes — near the front tills.",
    });
    assert.equal(patch.kind, "faq");
    if (patch.kind === "faq") {
      assert.match(patch.answer, /front tills/i);
    }
  });

  it("requires conditions for depends answers", () => {
    assert.throws(() =>
      buildExistenceFaqPatch({
        question: "Do we have a coin machine?",
        choice: "depends",
      }),
    );
  });
});

describe("existence answer form helpers", () => {
  it("requires explanation before reviewing depends answers", () => {
    assert.equal(
      canReviewExistenceAnswer(sampleItem(), {
        ...emptyExistenceAnswerForm(),
        choice: "depends",
        dependsExplanation: "   ",
      }),
      false,
    );
    assert.equal(
      canReviewExistenceAnswer(sampleItem(), {
        ...emptyExistenceAnswerForm(),
        choice: "depends",
        dependsExplanation: "Only on weekdays.",
      }),
      true,
    );
  });

  it("allows existence yes answers without optional details", () => {
    assert.equal(
      canReviewExistenceAnswer(sampleItem(), {
        ...emptyExistenceAnswerForm(),
        choice: "yes",
      }),
      true,
    );
    assert.equal(
      existenceDetailsForSubmit({
        ...emptyExistenceAnswerForm(),
        choice: "yes",
        yesNoDetails: " Near the front tills. ",
      }),
      "Near the front tills.",
    );
  });

  it("requires location details for where questions", () => {
    const toilets = sampleItem({
      cara_question: "Where are the customer toilets?",
      gap_summary: "Customer toilets",
      caller_context:
        "Caller asked where the customer toilets are — they thought they were in the mall corridor outside the shop.",
    });
    assert.equal(
      canReviewExistenceAnswer(toilets, {
        ...emptyExistenceAnswerForm(),
        choice: "yes",
      }),
      false,
    );
    assert.equal(
      canReviewExistenceAnswer(toilets, {
        ...emptyExistenceAnswerForm(),
        choice: "yes",
        yesNoDetails: "In the mall corridor, just outside the shop.",
      }),
      true,
    );
    assert.equal(
      canReviewExistenceAnswer(toilets, {
        ...emptyExistenceAnswerForm(),
        choice: "no",
        yesNoDetails: "We don't have customer toilets on site.",
      }),
      true,
    );
  });

  it("restores draft-ready existence answers from original employee input", () => {
    const item = sampleItem({
      status: "draft_ready",
      owner_messages: [
        {
          role: "user",
          content: "Yes — toilets beside barbr shop outside ours in mall",
          at: "2026-09-17T14:33:57.708Z",
        },
        {
          role: "assistant",
          content:
            "Understood: The customer toilets are in the mall, outside the shop, beside the barbershop.",
          at: "2026-09-17T14:33:57.708Z",
        },
      ],
      proposed_patch: {
        kind: "faq",
        question: "Where are the customer toilets?",
        answer:
          "The customer toilets are in the mall, outside the shop, beside the barbershop.",
      },
    });
    const restored = restoreExistenceAnswerForm(item);
    assert.equal(restored.choice, "yes");
    assert.match(restored.yesNoDetails ?? "", /barbr shop/i);
    assert.equal(
      restoreOwnerAnswerForEdit(item),
      "Yes — toilets beside barbr shop outside ours in mall",
    );
  });
});

describe("understoodPreviewLines", () => {
  it("shows clarified facts without question labels", () => {
    const lines = understoodPreviewLines({
      kind: "faq",
      question: "Where are the customer toilets?",
      answer:
        "The customer toilets are in the mall, outside the shop, beside the barbershop.",
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0] ?? "", /barbershop/i);
    assert.doesNotMatch(lines[0] ?? "", /Question:/i);
  });
});

describe("trainingItemIsDeferred", () => {
  it("marks and clears deferred items locally", () => {
    const deferred = applyDeferredToTrainingItem(sampleItem());
    assert.equal(trainingItemIsDeferred(deferred), true);
    assert.match(trainingListSubtitle(deferred), /To check later/i);

    const restored = clearDeferredFromTrainingItem(deferred);
    assert.equal(trainingItemIsDeferred(restored), false);

    const toggled = toggleTrainingItemDeferred(sampleItem());
    assert.equal(trainingItemIsDeferred(toggled), true);
    assert.equal(trainingItemIsDeferred(toggleTrainingItemDeferred(toggled)), false);
  });

  it("detects deferred awaiting items and sorts them first", () => {
    const deferred = sampleItem({
      owner_messages: [
        {
          role: "assistant",
          content: "Deferred — manager will check and answer later.",
          at: "2026-09-17T10:00:00.000Z",
        },
      ],
      last_seen_at: "2026-09-17T10:00:00.000Z",
    });
    const fresh = sampleItem({
      id: "2",
      last_seen_at: "2026-09-17T15:00:00.000Z",
    });
    assert.equal(trainingItemIsDeferred(deferred), true);
    assert.equal(trainingItemIsDeferred(fresh), false);
    assert.equal(sortOpenTrainingItems([fresh, deferred])[0]?.id, deferred.id);
  });
});
