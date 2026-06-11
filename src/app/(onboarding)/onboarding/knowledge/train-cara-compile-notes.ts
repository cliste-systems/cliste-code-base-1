import type { AgentFaq } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import { normalizeCaraTrainingVoice } from "@/lib/cara-starter-notes";

import { polishFaqAnswer } from "./train-cara-review-polish";

export type CompileNotesInput = {
  businessName: string;
  about: string;
  servicesOffered: string;
  servicesNotOffered: string;
  openingHours: string;
  serviceArea: string;
  detailsToCollect: string;
  rules: string[];
  faqs: AgentFaq[];
};

function paragraph(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function formatFaqsForNotes(faqs: AgentFaq[]): string {
  const answered = faqs.filter(
    (faq) => faq.question.trim() && faq.answer.trim(),
  );
  if (answered.length === 0) return "";

  const lines = answered.map((faq) => {
    const question = faq.question.trim();
    const answer = polishFaqAnswer(faq.answer);
    return `If asked "${question}", I should say: ${answer}`;
  });
  return `Common questions:\n${lines.join("\n")}`;
}

export function compileCaraPhoneNotes(input: CompileNotesInput): string {
  const businessName = input.businessName.trim() || "this business";
  const parts: string[] = [];

  parts.push(`I'm Cara, the phone assistant for ${businessName}.`);

  const about = paragraph(input.about);
  if (about) parts.push(about);

  const services = paragraph(input.servicesOffered);
  if (services) {
    parts.push(`Services and request types we handle include: ${services}`);
  }

  const excluded = paragraph(input.servicesNotOffered);
  if (excluded) {
    parts.push(`I should not agree to: ${excluded}`);
  }

  const hours = paragraph(input.openingHours);
  if (hours) parts.push(`Opening hours: ${hours}`);

  const area = paragraph(input.serviceArea);
  if (area) parts.push(`Areas covered: ${area}`);

  const capture = paragraph(input.detailsToCollect);
  if (capture) {
    parts.push(`When callers ring, I should collect: ${capture}`);
  }

  const rules = input.rules.map((rule) => rule.trim()).filter(Boolean);
  if (rules.length > 0) {
    parts.push(
      `Important rules:\n${rules.map((rule) => `- ${rule}`).join("\n")}`,
    );
  }

  const faqBlock = formatFaqsForNotes(input.faqs);
  if (faqBlock) parts.push(faqBlock);

  parts.push(
    "If I'm unsure about anything, I should take a message and add it to the Action Inbox instead of guessing.",
  );

  return normalizeCaraTrainingVoice(parts.join("\n\n").trim());
}
