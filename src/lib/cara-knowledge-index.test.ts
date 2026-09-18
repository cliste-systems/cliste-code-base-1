import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCaraKnowledgeIndex,
  knowledgeEntriesForBrowse,
  searchCaraKnowledge,
  sortKnowledgeEntries,
} from "./cara-knowledge-index";

describe("cara-knowledge-index", () => {
  it("builds searchable FAQ and service entries", () => {
    const index = buildCaraKnowledgeIndex({
      faqs: [{ question: "Do you do communion cakes?", answer: "Yes, 48 hours notice." }],
      servicesOffered: "Bakery",
      servicesNotOffered: "Catering",
      businessRules: ["Never quote prices over the phone"],
      businessKnowledgeSummary: "Family bakery in Dublin.",
      rawBusinessDescription: "Independent supermarket in Donegal Town.",
      openingHours: "Mon-Sat 8-6",
      serviceArea: null,
      agentBaseTown: null,
      appliedTrainingItems: [],
      openTrainingItems: [],
    });

    assert.equal(index.entries.length, 6);
    assert.equal(index.entries.filter((entry) => entry.category === "answers").length, 1);

    const about = index.entries.find((entry) => entry.id === "fact-about");
    assert.ok(about?.editHref?.includes("#cara-business-description"));
    assert.equal(about?.editLabel, "Edit description");

    const rule = index.entries.find((entry) => entry.source === "rule");
    assert.equal(rule?.editHref, undefined);
  });

  it("hides profile-managed facts from browse lists", () => {
    const index = buildCaraKnowledgeIndex({
      faqs: [],
      servicesOffered: "",
      servicesNotOffered: "",
      businessRules: [],
      businessKnowledgeSummary: "Local supermarket on Quay Street.",
      rawBusinessDescription: "Independent supermarket in Donegal Town.",
      openingHours: "Mon-Sat 8-6",
      appliedTrainingItems: [],
      openTrainingItems: [],
    });

    assert.equal(index.entries.length, 3);
    assert.equal(knowledgeEntriesForBrowse(index.entries).length, 0);
  });

  it("sorts temporal knowledge to the top", () => {
    const sorted = sortKnowledgeEntries([
      {
        id: "faq-1",
        category: "answers",
        title: "Parking",
        body: "Free parking",
        source: "faq",
      },
      {
        id: "temporal-1",
        category: "facts",
        title: "Temporary opening hours",
        body: "8am–6pm",
        source: "temporal",
        updatedAt: "2026-09-17T10:00:00.000Z",
      },
    ]);

    assert.equal(sorted[0]?.id, "temporal-1");
  });

  it("groups search results into knows, related, and gaps", () => {
    const index = buildCaraKnowledgeIndex({
      faqs: [{ question: "Do you do communion cakes?", answer: "Yes, 48 hours notice." }],
      servicesOffered: "",
      servicesNotOffered: "",
      businessRules: [],
      appliedTrainingItems: [],
      openTrainingItems: [
        {
          id: "gap-1",
          organization_id: "org-1",
          status: "awaiting_answer",
          source: "call_gap",
          call_log_id: null,
          action_ticket_id: null,
          gap_summary: "communion cakes",
          caller_context: null,
          cara_question: "Do you make communion cakes?",
          owner_messages: [],
          proposed_patch: null,
          applied_patch: null,
          target_section: null,
          applied_at: null,
          applied_by: null,
          dismissed_at: null,
          occurrence_count: 1,
          last_seen_at: "2026-01-01T00:00:00.000Z",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const exact = searchCaraKnowledge(index, "communion cakes");
    assert.equal(exact.knows.length, 1);
    assert.equal(exact.gaps.length, 1);

    const partial = searchCaraKnowledge(index, "communion");
    assert.ok(partial.knows.length + partial.related.length >= 1);

    const missing = searchCaraKnowledge(index, "wedding cakes");
    assert.equal(missing.knows.length, 0);
  });
});
