import {
  CARA_BASELINE_HANDLE_OPTIONS,
  ensureRequiredHandleOptions,
  type CaraHandleOptionId,
} from "@/app/(onboarding)/onboarding/knowledge/train-cara-constants";

export type CaraGoal = "faq_only" | "full_agent";

export const CARA_GOAL_DEFAULT: CaraGoal = "full_agent";

export const FULL_AGENT_HANDLE_OPTIONS = [
  "send_link",
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
    label: "Answer calls about your business",
    tagline: "Questions & messages",
    description:
      "Cara handles questions on your services, hours, location, and anything you've taught her — and takes a message when she can't help on the call.",
  },
  {
    id: "full_agent",
    label: "Answer calls & send links",
    tagline: "Full call handling",
    description:
      "Everything above — plus Cara can send booking links, directions, and other links to callers by SMS or email.",
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
