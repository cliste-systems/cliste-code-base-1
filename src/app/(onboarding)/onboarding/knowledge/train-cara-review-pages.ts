import type { AgentFaq } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";

import {
  buildReviewAvailabilitySpeech,
  buildReviewCallsSpeech,
  buildReviewExclusionsSpeech,
  buildReviewFaqItems,
  buildReviewFaqsSpeech,
  buildReviewServicesSpeech,
  type ReviewFaqItem,
} from "./train-cara-review-prose";
import { parseReviewChipList } from "./train-cara-review-display";

export type { ReviewFaqItem };

export type ReviewPageId =
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
  faqs: AgentFaq[];
};

export function buildReviewPageContent(input: {
  about: string;
  servicesOffered: string;
  servicesNotOffered: string;
  openingHours: string;
  serviceArea: string;
  detailsToCollect: string;
  faqs: AgentFaq[];
}): ReviewPageContent {
  return {
    about: input.about.trim(),
    services: parseReviewChipList(input.servicesOffered),
    exclusions: parseReviewChipList(input.servicesNotOffered, { stripNegation: true }),
    hours: input.openingHours.trim(),
    coverage: input.serviceArea.trim(),
    captureDetails: input.detailsToCollect.trim(),
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
  _businessName: string,
): ReviewPage[] {
  const pages: ReviewPage[] = [];

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
    "What I'll collect on calls.",
    buildReviewCallsSpeech(content.captureDetails, content.about),
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
