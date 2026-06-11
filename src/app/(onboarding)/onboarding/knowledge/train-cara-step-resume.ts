import {
  TRAIN_CARA_STEPS,
  type TrainCaraStepId,
} from "./train-cara-constants";

const LEGACY_STEP_MAP: Record<string, TrainCaraStepId> = {
  know: "about",
  handle: "review",
  "call-flow": "review",
  rules: "capture",
  actions: "review",
};

export function parseTrainCaraStepIndex(
  stepId: string | null | undefined,
): number | null {
  const normalized = String(stepId ?? "").trim();
  if (!normalized) return null;

  const mapped = LEGACY_STEP_MAP[normalized] ?? normalized;
  const index = TRAIN_CARA_STEPS.findIndex((step) => step.id === mapped);
  return index >= 0 ? index : null;
}

export function inferTrainCaraStepIndex(input: {
  aboutCompleted: boolean;
  servicesOffered: string;
  openingHours: string;
  detailsToCollect: string;
  businessRules: string[];
  faqs: Array<{ question: string }>;
}): number {
  if (!input.aboutCompleted) return 0;
  if (!input.servicesOffered.trim()) {
    return parseTrainCaraStepIndex("services") ?? 1;
  }
  if (!input.openingHours.trim()) {
    return parseTrainCaraStepIndex("hours") ?? 2;
  }
  if (!input.detailsToCollect.trim() || input.businessRules.length === 0) {
    return parseTrainCaraStepIndex("capture") ?? 3;
  }
  if (!input.faqs.some((faq) => faq.question.trim())) {
    return parseTrainCaraStepIndex("faqs") ?? 4;
  }
  return parseTrainCaraStepIndex("review") ?? TRAIN_CARA_STEPS.length - 1;
}

export function resolveTrainCaraStepIndex(input: {
  urlStepId?: string | null;
  savedStepId?: string | null;
}): number {
  const fromUrl = parseTrainCaraStepIndex(input.urlStepId);
  if (fromUrl !== null) return fromUrl;

  const fromDb = parseTrainCaraStepIndex(input.savedStepId);
  if (fromDb !== null) return fromDb;

  // First visit — always start at About. Prefill must not skip training steps.
  return 0;
}

export function shouldShowTrainCaraIntro(input: {
  savedStepId?: string | null;
}): boolean {
  return !String(input.savedStepId ?? "").trim();
}

export function isTrainCaraStepId(
  value: string | null | undefined,
): value is TrainCaraStepId {
  return parseTrainCaraStepIndex(value) !== null;
}
