import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCaraKnowledgeIndex } from "./cara-knowledge-index";
import {
  buildKnowledgeFolders,
  GENERAL_KNOWLEDGE_FOLDER_ID,
  groupEntriesByFolder,
  inferKnowledgeFolderId,
  resolveEntryFolderId,
  sortFolderEntries,
  UNSORTED_KNOWLEDGE_FOLDER_ID,
} from "./cara-knowledge-folders";

describe("cara-knowledge-folders", () => {
  it("orders general first and departments alphabetically", () => {
    const folders = buildKnowledgeFolders({
      storeDepartmentNames: ["Butcher", "Bakery"],
      serviceDepartmentNames: [],
    });

    assert.equal(folders[0]?.id, GENERAL_KNOWLEDGE_FOLDER_ID);
    assert.equal(folders[1]?.label, "Bakery");
    assert.equal(folders[2]?.label, "Butcher");
  });

  it("puts store facts in general and faqs in unsorted by default", () => {
    const folders = buildKnowledgeFolders({
      storeDepartmentNames: ["Bakery"],
      serviceDepartmentNames: [],
    });
    const index = buildCaraKnowledgeIndex({
      faqs: [{ question: "Do you do cakes?", answer: "Yes." }],
      servicesOffered: "Bakery",
      servicesNotOffered: "",
      businessRules: [],
      rawBusinessDescription: "Independent supermarket.",
      openingHours: "Mon-Sat 8-6",
      appliedTrainingItems: [],
      openTrainingItems: [],
    });

    const about = index.entries.find((entry) => entry.id === "fact-about");
    assert.equal(inferKnowledgeFolderId(about!, folders), GENERAL_KNOWLEDGE_FOLDER_ID);

    const faq = index.entries.find((entry) => entry.source === "faq");
    assert.equal(inferKnowledgeFolderId(faq!, folders), UNSORTED_KNOWLEDGE_FOLDER_ID);
  });

  it("respects persisted folder assignments over defaults", () => {
    const folders = buildKnowledgeFolders({
      storeDepartmentNames: ["Bakery"],
      serviceDepartmentNames: [],
    });
    const index = buildCaraKnowledgeIndex({
      faqs: [{ question: "Do you do cakes?", answer: "Yes, 48 hours notice." }],
      servicesOffered: "",
      servicesNotOffered: "",
      businessRules: [],
      appliedTrainingItems: [],
      openTrainingItems: [],
    });
    const faq = index.entries[0]!;
    const assignments = new Map([[faq.id, "bakery"]]);

    assert.equal(resolveEntryFolderId(faq, folders, assignments), "bakery");
  });

  it("sorts folder entries A–Z case-insensitively", () => {
    const sorted = sortFolderEntries(
      [
        {
          id: "b",
          category: "answers",
          title: "banana bread",
          body: "Yes",
          source: "faq",
        },
        {
          id: "a",
          category: "answers",
          title: "Apple tart",
          body: "Yes",
          source: "faq",
        },
      ],
      "az",
    );

    assert.deepEqual(sorted.map((entry) => entry.title), ["Apple tart", "banana bread"]);
  });

  it("sorts active temporal entries before other knowledge", () => {
    const sorted = sortFolderEntries(
      [
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
        },
      ],
      "az",
    );

    assert.equal(sorted[0]?.id, "temporal-1");
  });

  it("does not create department-name service entries in the index", () => {
    const index = buildCaraKnowledgeIndex({
      faqs: [],
      servicesOffered: "Bakery, Deli",
      servicesNotOffered: "",
      businessRules: [],
      appliedTrainingItems: [],
      openTrainingItems: [],
    });

    assert.equal(
      index.entries.some((entry) => entry.title === "Bakery"),
      false,
    );
  });

  it("groups entries into configured folders and unsorted", () => {
    const folders = buildKnowledgeFolders({
      storeDepartmentNames: ["Bakery"],
      serviceDepartmentNames: [],
    });
    const index = buildCaraKnowledgeIndex({
      faqs: [{ question: "Cake price?", answer: "From €20." }],
      servicesOffered: "Bakery",
      servicesNotOffered: "Catering",
      businessRules: ["Never quote prices over the phone"],
      rawBusinessDescription: "Town centre store.",
      appliedTrainingItems: [],
      openTrainingItems: [],
    });
    const grouped = groupEntriesByFolder(index.entries, folders, new Map());

    assert.ok((grouped.get(GENERAL_KNOWLEDGE_FOLDER_ID) ?? []).length >= 2);
    assert.ok((grouped.get(UNSORTED_KNOWLEDGE_FOLDER_ID) ?? []).length >= 1);
  });
});
