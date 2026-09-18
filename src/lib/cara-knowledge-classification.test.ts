import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCaraKnowledgeIndex } from "./cara-knowledge-index";
import {
  buildKnowledgeFolders,
  GENERAL_KNOWLEDGE_FOLDER_ID,
  UNSORTED_KNOWLEDGE_FOLDER_ID,
} from "./cara-knowledge-folders";
import {
  ALL_KNOWLEDGE_GROUP_ID,
} from "./cara-knowledge-topics";
import {
  entryDepartmentIds,
  entryNeedsSorting,
  filterBrowseEntries,
  formatEntryGroupLabels,
  inferDepartmentIdsFromText,
  resolveDisplayClassification,
  resolveFilterClassification,
  resolvePersistedClassification,
  suggestClassificationForEntry,
  suggestClassificationForTrainingPatch,
  suggestKnowledgeAssignment,
  trainingItemClassificationDraft,
  type EntryClassification,
} from "./cara-knowledge-classification";

describe("cara-knowledge-classification", () => {
  const folders = buildKnowledgeFolders({
    storeDepartmentNames: ["Bakery", "Butcher", "Deli"],
    serviceDepartmentNames: [],
  });

  it("suggests general hours for built-in opening hours facts", () => {
    const index = buildCaraKnowledgeIndex({
      faqs: [],
      servicesOffered: "",
      servicesNotOffered: "",
      businessRules: [],
      openingHours: "Mon–Sat: 8am–9pm\nSunday: 9am–6pm",
      appliedTrainingItems: [],
      openTrainingItems: [],
    });
    const hoursEntry = index.entries.find((entry) => entry.id === "fact-hours");
    assert.ok(hoursEntry);
    const classification = suggestClassificationForEntry(hoursEntry!, folders);
    assert.equal(classification.folderId, GENERAL_KNOWLEDGE_FOLDER_ID);
    assert.ok(classification.topicLabels.includes("hours-location"));
  });

  it("suggests general store information for the knowledge summary fact", () => {
    const index = buildCaraKnowledgeIndex({
      faqs: [],
      servicesOffered: "",
      servicesNotOffered: "",
      businessRules: [],
      businessKnowledgeSummary: "Local supermarket on Quay Street.",
      appliedTrainingItems: [],
      openTrainingItems: [],
    });
    const summaryEntry = index.entries.find((entry) => entry.id === "fact-summary");
    assert.ok(summaryEntry);
    const classification = suggestClassificationForEntry(summaryEntry!, folders);
    assert.equal(classification.folderId, GENERAL_KNOWLEDGE_FOLDER_ID);
  });

  it("suggests facilities for ATM questions under general topics", () => {
    const suggestion = suggestKnowledgeAssignment(
      "There is an ATM beside the entrance.",
      folders,
    );
    assert.equal(suggestion.folderId, GENERAL_KNOWLEDGE_FOLDER_ID);
    assert.ok(suggestion.topicLabels.includes("facilities-accessibility"));
    assert.match(suggestion.summary, /Facilities/i);
  });

  it("suggests bakery for cake-order notices", () => {
    const suggestion = suggestKnowledgeAssignment(
      "Communion cakes need 48 hours notice.",
      folders,
    );
    assert.ok(
      suggestion.departmentIds.includes("bakery") ||
        inferDepartmentIdsFromText("Communion cakes", folders).includes("bakery"),
    );
  });

  it("resolves meat counter wording to butcher department", () => {
    const ids = inferDepartmentIdsFromText(
      "Ask the meat counter about lamb.",
      folders,
    );
    assert.ok(ids.includes("meat-counter"));
  });

  it("does not route home delivery questions to Deli", () => {
    const suggestion = suggestKnowledgeAssignment(
      "Do you deliver to addresses outside town?\nyeah around 10km",
      folders,
    );
    assert.notEqual(suggestion.folderId, "deli");
    assert.equal(suggestion.folderId, GENERAL_KNOWLEDGE_FOLDER_ID);
    assert.ok(suggestion.topicLabels.includes("services-payments"));
  });

  it("supports one entry visible under multiple department filters", () => {
    const index = buildCaraKnowledgeIndex({
      faqs: [
        {
          question: "Do you do sandwich platters?",
          answer: "Yes, from the deli counter and bakery.",
        },
      ],
      servicesOffered: "",
      servicesNotOffered: "",
      businessRules: [],
      appliedTrainingItems: [],
      openTrainingItems: [],
    });
    const entry = index.entries[0]!;
    const classification = {
      folderId: "deli",
      departmentIds: ["deli", "bakery"],
      topicLabels: [],
    };

    const deliMatches = filterBrowseEntries(
      index.entries,
      folders,
      new Map([[entry.id, classification]]),
      new Map(),
      {
        groupId: "deli",
        topicId: null,
        query: "",
        sort: "az",
      },
    );
    const bakeryMatches = filterBrowseEntries(
      index.entries,
      folders,
      new Map([[entry.id, classification]]),
      new Map(),
      {
        groupId: "bakery",
        topicId: null,
        query: "",
        sort: "az",
      },
    );

    assert.equal(deliMatches.length, 1);
    assert.equal(bakeryMatches.length, 1);
    assert.equal(entryDepartmentIds(entry, folders, classification).length, 2);
  });

  it("labels explicit negative toilet answers without inventing a no", () => {
    const index = buildCaraKnowledgeIndex({
      faqs: [
        {
          question: "Do you have customer toilets?",
          answer: "No customer toilets on site.",
        },
      ],
      servicesOffered: "",
      servicesNotOffered: "",
      businessRules: [],
      appliedTrainingItems: [],
      openTrainingItems: [],
    });
    const entry = index.entries[0]!;
    const classification = resolvePersistedClassification(entry, folders, {
      folderId: GENERAL_KNOWLEDGE_FOLDER_ID,
      departmentIds: [],
      topicLabels: ["facilities-accessibility"],
    });
    const labels = formatEntryGroupLabels(entry, folders, classification);
    assert.ok(labels.some((label) => /Facilities/i.test(label)));
    assert.match(entry.body, /No customer toilets/);
  });

  it("keeps unknown facility questions in needs sorting when unassigned", () => {
    const index = buildCaraKnowledgeIndex({
      faqs: [{ question: "Do you have a prayer room?", answer: "Not sure yet." }],
      servicesOffered: "",
      servicesNotOffered: "",
      businessRules: [],
      appliedTrainingItems: [],
      openTrainingItems: [],
    });
    const entry = index.entries[0]!;
    const classification = resolvePersistedClassification(entry, folders, undefined);
    assert.equal(classification.folderId, UNSORTED_KNOWLEDGE_FOLDER_ID);
  });

  it("filters all knowledge by default", () => {
    const index = buildCaraKnowledgeIndex({
      faqs: [{ question: "Parking?", answer: "Free on-site parking." }],
      servicesOffered: "",
      servicesNotOffered: "",
      businessRules: [],
      rawBusinessDescription: "Town store",
      appliedTrainingItems: [],
      openTrainingItems: [],
    });
    const visible = filterBrowseEntries(
      index.entries,
      folders,
      new Map(),
      new Map(),
      {
        groupId: ALL_KNOWLEDGE_GROUP_ID,
        topicId: null,
        query: "",
        sort: "az",
      },
    );
    assert.equal(visible.length, 1);
    assert.equal(visible[0]?.title, "Parking?");
  });

  it("suggests general facilities for mall toilets FAQ while it stays in needs sorting", () => {
    const index = buildCaraKnowledgeIndex({
      faqs: [
        {
          question: "Do you have toilets?",
          answer: "yeah we have toilets in the mall, just outside the shop",
        },
      ],
      servicesOffered: "",
      servicesNotOffered: "",
      businessRules: [],
      appliedTrainingItems: [],
      openTrainingItems: [],
    });
    const entry = index.entries[0]!;
    const classifications = new Map<string, EntryClassification>();
    const legacyAssignments = new Map<string, string>();

    const suggested = suggestClassificationForEntry(entry, folders);
    assert.equal(suggested.folderId, GENERAL_KNOWLEDGE_FOLDER_ID);
    assert.ok(suggested.topicLabels.includes("facilities-accessibility"));
    assert.match(entry.body, /outside the shop/);
    assert.ok(
      entryNeedsSorting(entry, folders, classifications, legacyAssignments),
    );

    const needsSortingMatches = filterBrowseEntries(
      index.entries,
      folders,
      classifications,
      legacyAssignments,
      {
        groupId: UNSORTED_KNOWLEDGE_FOLDER_ID,
        topicId: null,
        query: "",
        sort: "az",
      },
    );
    const generalMatches = filterBrowseEntries(
      index.entries,
      folders,
      classifications,
      legacyAssignments,
      {
        groupId: GENERAL_KNOWLEDGE_FOLDER_ID,
        topicId: null,
        query: "",
        sort: "az",
      },
    );

    assert.equal(needsSortingMatches.length, 1);
    assert.equal(generalMatches.length, 0);
  });

  it("persists confirmed classification for existing unassigned entries after save", () => {
    const index = buildCaraKnowledgeIndex({
      faqs: [
        {
          question: "Do you have toilets?",
          answer: "yeah we have toilets in the mall, just outside the shop",
        },
      ],
      servicesOffered: "",
      servicesNotOffered: "",
      businessRules: [],
      appliedTrainingItems: [],
      openTrainingItems: [],
    });
    const entry = index.entries[0]!;
    const persisted = suggestClassificationForEntry(entry, folders);
    const classifications = new Map([[entry.id, persisted]]);

    assert.equal(
      entryNeedsSorting(entry, folders, classifications, new Map()),
      false,
    );

    const generalMatches = filterBrowseEntries(
      index.entries,
      folders,
      classifications,
      new Map(),
      {
        groupId: GENERAL_KNOWLEDGE_FOLDER_ID,
        topicId: "facilities-accessibility",
        query: "",
        sort: "az",
      },
    );
    const needsSortingMatches = filterBrowseEntries(
      index.entries,
      folders,
      classifications,
      new Map(),
      {
        groupId: UNSORTED_KNOWLEDGE_FOLDER_ID,
        topicId: null,
        query: "",
        sort: "az",
      },
    );

    assert.equal(generalMatches.length, 1);
    assert.equal(needsSortingMatches.length, 0);
    assert.match(entry.body, /outside the shop/);
  });

  it("persists confirmed Teach Cara classification on the training item draft", () => {
    const patch = {
      kind: "faq" as const,
      question: "Do you have toilets?",
      answer: "yeah we have toilets in the mall, just outside the shop",
    };
    const draft = trainingItemClassificationDraft(
      {
        knowledge_folder_id: GENERAL_KNOWLEDGE_FOLDER_ID,
        knowledge_department_ids: [],
        knowledge_topic_labels: ["facilities-accessibility"],
        proposed_patch: patch,
      },
      folders,
    );

    assert.equal(draft.folderId, GENERAL_KNOWLEDGE_FOLDER_ID);
    assert.deepEqual(draft.topicLabels, ["facilities-accessibility"]);
    assert.equal(
      suggestClassificationForTrainingPatch(patch, folders).folderId,
      GENERAL_KNOWLEDGE_FOLDER_ID,
    );
  });

  it("does not overwrite explicit manual assignments with automatic suggestions", () => {
    const index = buildCaraKnowledgeIndex({
      faqs: [
        {
          question: "Do you have toilets?",
          answer: "yeah we have toilets in the mall, just outside the shop",
        },
      ],
      servicesOffered: "",
      servicesNotOffered: "",
      businessRules: [],
      appliedTrainingItems: [],
      openTrainingItems: [],
    });
    const entry = index.entries[0]!;
    const manual = {
      folderId: "bakery",
      departmentIds: ["bakery"],
      topicLabels: [],
    };
    const classifications = new Map([[entry.id, manual]]);

    const display = resolveDisplayClassification(
      entry,
      folders,
      classifications,
      new Map(),
    );
    const filterClassification = resolveFilterClassification(
      entry,
      folders,
      classifications,
      new Map(),
    );

    assert.deepEqual(display, manual);
    assert.deepEqual(filterClassification, manual);
    assert.notEqual(
      suggestClassificationForEntry(entry, folders).folderId,
      manual.folderId,
    );
  });
});
