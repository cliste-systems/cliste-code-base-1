import {
  CARA_BASELINE_HANDLE_OPTIONS,
  ensureRequiredHandleOptions,
  type CaraHandleOptionId,
} from "@/app/(onboarding)/onboarding/knowledge/train-cara-constants";

export type CaraGoal = "faq_only" | "full_agent";

export const CARA_GOAL_DEFAULT: CaraGoal = "full_agent";

export const FULL_AGENT_HANDLE_OPTIONS = [
  "send_link",
  "email_request",
  "send_whatsapp",
] as const satisfies readonly CaraHandleOptionId[];

export type CaraGoalChoice = {
  id: CaraGoal;
  label: string;
  tagline: string;
  description: string;
};

export const CARA_GOAL_CHOICES: readonly CaraGoalChoice[] = [
  {
    id: "faq_only",
    label: "Answer common questions",
    tagline: "FAQ voice agent",
    description:
      "Cara answers calls about hours, location, and your FAQs — and takes messages.",
  },
  {
    id: "full_agent",
    label: "Answer questions & follow up",
    tagline: "Full call handling",
    description:
      "Cara can also text booking links, email your team, and send WhatsApp follow-ups.",
  },
] as const;

export function parseCaraGoal(raw: unknown): CaraGoal {
  return raw === "faq_only" ? "faq_only" : CARA_GOAL_DEFAULT;
}

export function handleOptionsForCaraGoal(goal: CaraGoal): CaraHandleOptionId[] {
  if (goal === "faq_only") {
    return [...CARA_BASELINE_HANDLE_OPTIONS];
  }
  return ensureRequiredHandleOptions([...FULL_AGENT_HANDLE_OPTIONS]);
}
