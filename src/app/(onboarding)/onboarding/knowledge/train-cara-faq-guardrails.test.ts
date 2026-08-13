import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyWeekSchedule } from "@/lib/business-hours";

import {
  buildTrainCaraFaqGuardContext,
  lintOnboardingFaq,
  sanitizeOnboardingFaqs,
} from "./train-cara-faq-guardrails";

describe("train-cara-faq-guardrails", () => {
  const hoursContext = buildTrainCaraFaqGuardContext({
    openingHoursSchedule: {
      ...emptyWeekSchedule(),
      tuesday: { open: true, start: "09:00", end: "18:00" },
    },
    open24_7: false,
    hoursNeverConfigured: false,
    locationAddress: "1 Main St",
    baseTown: "Dublin",
    locationCounty: "",
    locationEircode: "",
    serviceAreaItems: [],
    servicesOffered: "Cuts, colour",
    serviceCatalogCount: 2,
  });

  it("strips opening-hours FAQs when structured hours exist", () => {
    const out = sanitizeOnboardingFaqs(
      [
        { question: "What are your opening hours?", answer: "Tue 9–6" },
        { question: "Do you take walk-ins?", answer: "Yes before 4pm" },
      ],
      hoursContext,
    );
    assert.equal(out.length, 1);
    assert.match(out[0]!.question, /walk-ins/i);
  });

  it("blocks duplicate canonical hours question in the editor", () => {
    const warning = lintOnboardingFaq({
      faq: { question: "When are you open?", answer: "" },
      index: 0,
      faqs: [{ question: "When are you open?", answer: "" }],
      context: hoursContext,
    });
    assert.ok(warning?.blockDone);
    assert.match(warning!.message, /Hours step/i);
  });

  it("dedupes exact duplicate questions", () => {
    const out = sanitizeOnboardingFaqs(
      [
        { question: "Do you take walk-ins?", answer: "Yes" },
        { question: "Do you take walk-ins?", answer: "Yep" },
      ],
      hoursContext,
    );
    assert.equal(out.length, 1);
  });
});
