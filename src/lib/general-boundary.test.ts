import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultWeekSchedule } from "@/lib/business-hours";

import {
  anythingElseLooksLikeLegacyBlob,
  buildHoursPromptBlock,
  ensureCompliantStoredGreeting,
  greetingMissingDisclosure,
  lintAnythingElse,
  migrateLegacyCaraBlobs,
} from "./general-boundary";

describe("migrateLegacyCaraBlobs", () => {
  it("keeps only novel facts when blob duplicates structured fields", () => {
    const blob = [
      "Services and request types we handle include: Plumbing, Heating",
      "Opening hours: Mon–Fri 9–5",
      "Areas covered: Dublin, Cork",
      "We have a blue door at the side entrance.",
    ].join("\n");

    const migrated = migrateLegacyCaraBlobs({
      businessKnowledgeSummary: blob,
      servicesOffered: "Plumbing, Heating",
      openingHours: "Mon–Fri 9–5",
      serviceArea: "Dublin, Cork",
      faqs: [],
      businessName: "Acme",
      assistantDisplayName: "Cara",
    });

    assert.match(migrated, /blue door/i);
    assert.doesNotMatch(migrated, /plumbing/i);
    assert.doesNotMatch(migrated, /opening hours/i);
    assert.doesNotMatch(migrated, /areas covered/i);
  });
});

describe("lintAnythingElse", () => {
  it("warns on hours-shaped text", () => {
    const warnings = lintAnythingElse("We're open Mon–Fri 9 to 5.");
    assert.equal(
      warnings.some((w) => w.id === "ae-hours"),
      true,
    );
  });
});

describe("anythingElseLooksLikeLegacyBlob", () => {
  it("detects blob-shaped content", () => {
    assert.equal(
      anythingElseLooksLikeLegacyBlob("Opening hours: Mon 9am – Fri 5pm"),
      true,
    );
  });
});

describe("greeting compliance", () => {
  it("detects missing disclosure", () => {
    assert.equal(
      greetingMissingDisclosure(
        "You're through to Acme — How can I help?",
        "Cara",
      ),
      true,
    );
  });

  it("re-inserts disclosure when stripped from stored greeting", () => {
    const fixed = ensureCompliantStoredGreeting({
      greeting: "You're through to Acme — How can I help?",
      businessName: "Acme",
      assistantDisplayName: "Cara",
    });
    assert.match(fixed, /AI assistant/i);
    assert.match(fixed, /recorded/i);
  });
});

describe("buildHoursPromptBlock", () => {
  it("uses take-a-message path when never configured", () => {
    const block = buildHoursPromptBlock({
      neverConfigured: true,
      open24_7: false,
      schedule: defaultWeekSchedule(),
      formattedHours: "",
    });
    assert.match(block ?? "", /not been provided/i);
  });

  it("states all closed when schedule saved with no open days", () => {
    const schedule = defaultWeekSchedule();
    for (const day of Object.keys(schedule) as (keyof typeof schedule)[]) {
      schedule[day] = { ...schedule[day], open: false };
    }
    const block = buildHoursPromptBlock({
      neverConfigured: false,
      open24_7: false,
      schedule,
      formattedHours: "Closed all week",
    });
    assert.match(block ?? "", /closed every day/i);
  });

  it("includes closed-day next-open instruction", () => {
    const block = buildHoursPromptBlock({
      neverConfigured: false,
      open24_7: false,
      schedule: defaultWeekSchedule(),
      formattedHours: "Mon–Fri 9–5",
    });
    assert.match(block ?? "", /next time we're open/i);
  });
});
