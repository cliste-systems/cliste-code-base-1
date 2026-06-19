import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  firstBlockingKnowledgeLint,
  lintCaraKnowledge,
  lintExtractedKnowledgeLists,
} from "./cara-knowledge-lint";
import { snapshotFromLists } from "./cara-knowledge-snapshot";

describe("cara-knowledge-lint", () => {
  it("blocks duplicate business rules", () => {
    const snapshot = snapshotFromLists({
      businessRules: ["Never quote prices", "never quote prices"],
    });

    const blocker = firstBlockingKnowledgeLint(snapshot, { focusField: "rules" });
    assert.ok(blocker);
    assert.match(blocker!.message, /duplicate/i);
  });

  it("blocks never-quote rule against FAQ prices", () => {
    const snapshot = snapshotFromLists({
      businessRules: ["Never quote prices over the phone"],
      faqs: [
        {
          question: "How much is a cut?",
          answer: "Cuts start from €40.",
        },
      ],
    });

    const blocker = firstBlockingKnowledgeLint(snapshot, { focusField: "faqs" });
    assert.ok(blocker);
    assert.match(blocker!.message, /never to quote prices/i);
  });

  it("blocks service listed as offered and excluded", () => {
    const snapshot = snapshotFromLists({
      servicesOffered: "Haircuts, Colour",
      servicesNotOffered: "Colour, Laser",
    });

    const blocker = firstBlockingKnowledgeLint(snapshot, {
      focusField: "services",
    });
    assert.ok(blocker);
    assert.match(blocker!.message, /offered and not offered/i);
  });

  it("blocks extracted rules that fail compliance lint", () => {
    const snapshot = snapshotFromLists({});
    const issues = lintExtractedKnowledgeLists({
      businessRules: ["Take their card details over the phone"],
      snapshot,
    });

    assert.ok(issues.some((issue) => issue.severity === "block"));
  });

  it("warns on near-duplicate rules without blocking", () => {
    const snapshot = snapshotFromLists({
      businessRules: ["deposit required", "deposit required for colour"],
    });

    const issues = lintCaraKnowledge(snapshot, { focusField: "rules" });
    assert.ok(issues.some((issue) => issue.severity === "warn"));
    assert.equal(firstBlockingKnowledgeLint(snapshot, { focusField: "rules" }), null);
  });

  it("does not warn on offered chips when service catalog is active", () => {
    const snapshot = snapshotFromLists({
      servicesOffered: "Balayage, Full Balayage",
      serviceCatalog: [
        {
          id: "svc-1",
          name: "Balayage",
          category: null,
          price: 80,
          durationMinutes: 90,
          description: null,
          aiVoiceNotes: null,
          policyFlags: [],
          source: "manual",
        },
        {
          id: "svc-2",
          name: "Full Balayage",
          category: null,
          price: 95,
          durationMinutes: 120,
          description: null,
          aiVoiceNotes: null,
          policyFlags: [],
          source: "manual",
        },
      ],
    });

    const issues = lintCaraKnowledge(snapshot, { focusField: "services" });
    assert.equal(
      issues.some((issue) => issue.id === "catalog-active-offered-chips"),
      false,
    );
    assert.equal(
      issues.some((issue) => issue.id.startsWith("near-dup-servicesOffered")),
      false,
    );
  });

  it("warns when answer-enabled price list overlaps populated catalog", () => {
    const snapshot = snapshotFromLists({
      serviceCatalog: [
        {
          id: "svc-1",
          name: "Cut",
          category: null,
          price: 45,
          durationMinutes: 30,
          description: null,
          aiVoiceNotes: null,
          policyFlags: [],
          source: "manual",
        },
      ],
      businessFiles: [
        {
          id: "file-1",
          fileName: "prices.pdf",
          fileType: "pdf",
          mimeType: "application/pdf",
          sizeBytes: 1000,
          answerEnabled: true,
          sendEnabled: false,
          documentKind: "price_list",
          title: null,
          caraDescription: null,
          whenToUse: null,
          processingStatus: "ready",
          extractedText: "Cut €40",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const issues = lintCaraKnowledge(snapshot);
    const overlap = issues.find((issue) =>
      issue.id.startsWith("cross-file-catalog-"),
    );
    assert.ok(overlap);
    assert.equal(overlap!.severity, "warn");
    assert.equal(firstBlockingKnowledgeLint(snapshot), null);
  });

  it("warns when answer-enabled faq document overlaps populated FAQs", () => {
    const snapshot = snapshotFromLists({
      faqs: [{ question: "Hours?", answer: "Mon–Fri 9–5" }],
      businessFiles: [
        {
          id: "file-2",
          fileName: "faqs.pdf",
          fileType: "pdf",
          mimeType: "application/pdf",
          sizeBytes: 1000,
          answerEnabled: true,
          sendEnabled: false,
          documentKind: "faq_document",
          title: null,
          caraDescription: null,
          whenToUse: null,
          processingStatus: "ready",
          extractedText: "Q&A",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const issues = lintCaraKnowledge(snapshot);
    const overlap = issues.find((issue) => issue.id.startsWith("cross-file-faq-"));
    assert.ok(overlap);
    assert.equal(overlap!.severity, "warn");
  });

  it("warns on dual structured and legacy hours", () => {
    const snapshot = snapshotFromLists({
      openingHours: "Mon 9am – Fri 5pm",
      openingHoursLegacy: "Open weekdays 9 to 5",
      hoursNeverConfigured: false,
    });

    const issues = lintCaraKnowledge(snapshot);
    const overlap = issues.find((issue) => issue.id === "cross-dual-hours");
    assert.ok(overlap);
    assert.equal(overlap!.severity, "warn");
  });

  it("warns on duplicate service name across catalog and supplement", () => {
    const snapshot = snapshotFromLists({
      serviceCatalog: [
        {
          id: "svc-1",
          name: "Balayage",
          category: null,
          price: 80,
          durationMinutes: 90,
          description: null,
          aiVoiceNotes: null,
          policyFlags: [],
          source: "manual",
        },
      ],
      serviceCatalogSupplement: {
        supplementalServices: ["Balayage"],
        generalNotes: "",
      },
    });

    const issues = lintCaraKnowledge(snapshot);
    assert.ok(
      issues.some((issue) => issue.id.startsWith("cross-svc-name-supplement-")),
    );
  });
});
