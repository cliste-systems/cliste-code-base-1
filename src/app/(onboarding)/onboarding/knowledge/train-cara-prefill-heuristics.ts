import type { AgentFaq } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";

export function extractAreaHintFromAbout(about: string): string {
  const basedIn = about.match(/\bbased in ([^.,\n]+)/i);
  if (basedIn?.[1]) return basedIn[1].trim();

  const cover = about.match(/\bcover(?:s|ing)?\s+([^.,\n]+)/i);
  if (cover?.[1]) return cover[1].trim();

  const inMatch = about.match(/\bin ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);
  if (inMatch?.[1]) return inMatch[1].trim();

  return "";
}

export type FaqSuggestionContext = {
  businessType: string;
  niche: string;
  about: string;
  servicesOffered: string;
  serviceArea: string;
  openingHours: string;
  servicesNotOffered: string;
};

export function deterministicFaqSuggestions(
  context: FaqSuggestionContext,
): string[] {
  const blob = [
    context.about,
    context.servicesOffered,
    context.serviceArea,
    context.openingHours,
    context.servicesNotOffered,
  ]
    .join(" ")
    .toLowerCase();

  const suggestions: string[] = [];

  if (/emergency|urgent|callout|24\s*\/\s*7|burst|leak/i.test(blob)) {
    suggestions.push("Do you offer emergency callouts?");
  }
  if (context.serviceArea.trim() || /cover|area|county|km|radius/i.test(blob)) {
    suggestions.push("What areas do you cover?");
  }
  if (/price|pricing|cost|fee|quote|€|\$/i.test(blob)) {
    suggestions.push("How much does it cost?");
  }
  if (/hour|open|mon|tue|wed|thu|fri|sat|sun|weekend|closed/i.test(blob)) {
    suggestions.push("Are you open on weekends?");
  }
  if (/appointment|book|availability|wait|come out|response/i.test(blob)) {
    suggestions.push("How quickly can someone come out?");
  }

  if (suggestions.length < 3) {
    suggestions.push(
      "How do I get started?",
      "What should I expect on a first call?",
      "Can you help with my request?",
    );
  }

  const seen = new Set<string>();
  return suggestions.filter((question) => {
    const key = question.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

export function mergeFaqSuggestions(
  existing: AgentFaq[],
  suggestions: string[],
): AgentFaq[] {
  const used = new Set(
    existing.map((faq) => faq.question.trim().toLowerCase()),
  );
  const additions: AgentFaq[] = [];
  for (const question of suggestions) {
    const key = question.toLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    additions.push({ question, answer: "" });
    if (additions.length >= 5) break;
  }
  return [...existing, ...additions];
}
