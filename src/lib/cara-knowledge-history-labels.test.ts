import assert from "node:assert/strict";
import test from "node:test";

import {
  enrichHistoryItem,
  formatHistoryActionLabel,
  formatHistoryCategoryLabel,
  inferPatchHistoryCategory,
} from "./cara-knowledge-history-labels";

test("formatHistoryActionLabel distinguishes teach from call learning", () => {
  assert.equal(
    formatHistoryActionLabel("learned", "owner_initiated"),
    "You taught Cara",
  );
  assert.equal(
    formatHistoryActionLabel("learned", "call_gap"),
    "Learned from a call",
  );
});

test("formatHistoryCategoryLabel humanizes technical categories", () => {
  assert.equal(formatHistoryCategoryLabel("opening_hours"), "Opening hours");
  assert.equal(
    formatHistoryCategoryLabel("policies", "We have 50 staff members."),
    "Store facts",
  );
  assert.equal(formatHistoryCategoryLabel("facts"), "Store facts");
});

test("inferPatchHistoryCategory classifies staff facts outside policies", () => {
  assert.equal(
    inferPatchHistoryCategory({
      kind: "business_rule",
      rule: "We have 50 staff members.",
    }),
    "facts",
  );
});

test("enrichHistoryItem hides code-like subtitles", () => {
  const item = enrichHistoryItem({
    id: "evt-1",
    kind: "learned",
    title: "We have 50 staff members.",
    subtitle: "policies",
    category: "policies",
    source: "owner_initiated",
    createdAt: "2026-09-17T12:55:00.000Z",
  });

  assert.equal(item.actionLabel, "You taught Cara");
  assert.equal(item.categoryLabel, "Store facts");
  assert.equal(item.sourceHint, null);
  assert.equal(item.subtitle, undefined);
});
