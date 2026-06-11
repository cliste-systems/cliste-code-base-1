import type { AgentFaq } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";

import {
  buildReviewRules,
  parseReviewChipList,
} from "./train-cara-review-display";
import {
  buildBlendedAboutSpeech,
  buildReviewAvailabilitySpeech,
  buildReviewCallsSpeech,
  buildReviewExclusionsSpeech,
  buildReviewFaqItems,
  buildReviewFaqsSpeech,
  buildReviewServicesSpeech,
  type ReviewFaqItem,
} from "./train-cara-review-prose";

export type { ReviewFaqItem };

export type ReviewPageId =
  | "about"
  | "services"
  | "exclusions"
  | "availability"
  | "calls"
  | "faqs";

export type ReviewPage = {
  id: ReviewPageId;
  title: string;
  subtitle: string;
  intro: string;
  body: string;
  /** Structured Q&A — used instead of prose `body` on the FAQs review page. */
  faqItems?: ReviewFaqItem[];
};

export type ReviewPageContent = {
  about: string;
  services: string[];
  exclusions: string[];
  hours: string;
  coverage: string;
  captureDetails: string;
  rules: string[];
  faqs: AgentFaq[];
};

export function buildReviewPageContent(input: {
  about: string;
  servicesOffered: string;
  servicesNotOffered: string;
  openingHours: string;
  serviceArea: string;
  detailsToCollect: string;
  businessRules: string[];
  faqs: AgentFaq[];
}): ReviewPageContent {
  return {
    about: input.about.trim(),
    services: parseReviewChipList(input.servicesOffered),
    exclusions: parseReviewChipList(input.servicesNotOffered, { stripNegation: true }),
    hours: input.openingHours.trim(),
    coverage: input.serviceArea.trim(),
    captureDetails: input.detailsToCollect.trim(),
    rules: buildReviewRules(input.businessRules),
    faqs: input.faqs.filter((faq) => faq.question.trim() || faq.answer.trim()),
  };
}

function pushSpeechPage(
  pages: ReviewPage[],
  id: ReviewPageId,
  title: string,
  subtitle: string,
  speech: { intro: string; body: string } | null,
) {
  if (!speech?.body.trim()) return;
  pages.push({
    id,
    title,
    subtitle,
    intro: speech.intro,
    body: speech.body,
  });
}

export function buildReviewPages(
  content: ReviewPageContent,
  businessName: string,
): ReviewPage[] {
  const name = businessName.trim() || "your business";
  const pages: ReviewPage[] = [];

  pushSpeechPage(
    pages,
    "about",
    `About ${name}`,
    "How I'll describe the business when callers ask.",
    buildBlendedAboutSpeech(content.about, name),
  );

  pushSpeechPage(
    pages,
    "services",
    "What I can help with",
    "The jobs and requests I'll handle on the phone.",
    buildReviewServicesSpeech(content.services),
  );

  pushSpeechPage(
    pages,
    "exclusions",
    "What I'll pass on",
    "Work I'll decline or refer elsewhere.",
    buildReviewExclusionsSpeech(content.exclusions),
  );

  pushSpeechPage(
    pages,
    "availability",
    "When and where",
    "Hours, coverage, and availability I'll explain on calls.",
    buildReviewAvailabilitySpeech(content.hours, content.coverage, content.about),
  );

  pushSpeechPage(
    pages,
    "calls",
    "How I handle calls",
    "What I'll collect and the rules I'll follow.",
    buildReviewCallsSpeech(content.captureDetails, content.rules, content.about),
  );

  const faqItems = buildReviewFaqItems(content.faqs);
  const faqSpeech = buildReviewFaqsSpeech(content.faqs);
  if (faqSpeech && faqItems.length > 0) {
    pages.push({
      id: "faqs",
      title: "Questions I'm ready for",
      subtitle: "Common caller questions and how I'll answer them.",
      intro: faqSpeech.intro,
      body: "",
      faqItems,
    });
  }

  return pages;
}
