import {
  faqCapacityStatus,
  MAX_FAQS,
  type AgentFaq,
} from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import {
  validateCallHandlingAdd,
  type CaraCapabilities,
} from "@/lib/call-handling-boundary";
import { deriveCaraCapabilities } from "@/lib/cara-capabilities";
import {
  lintCaraKnowledge,
  type KnowledgeLintIssue,
} from "@/lib/cara-knowledge-lint";
import type { CaraKnowledgeSnapshot } from "@/lib/cara-knowledge-snapshot";
import {
  dedupeCaraSetupChips,
  findExactChipInList,
  findNearDuplicateChip,
  normalizeCaraSetupChip,
} from "@/lib/cara-setup-chips";
import { detectPromptInjectionViolation } from "@/lib/prompt-injection-guard";
import type { CaraTrainingPatch } from "@/lib/cara-training-types";

export type TrainingSafetyIssue = {
  id: string;
  message: string;
  href?: string;
  secondaryHref?: string;
};

function trainingIssueFromLint(issue: KnowledgeLintIssue): TrainingSafetyIssue {
  return {
    id: issue.id,
    message: issue.message,
    href: issue.href,
    secondaryHref: issue.secondaryHref,
  };
}

function dedupeTrainingIssues(
  issues: TrainingSafetyIssue[],
): TrainingSafetyIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.id}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function applyPatchToSnapshot(
  snapshot: CaraKnowledgeSnapshot,
  patch: CaraTrainingPatch,
): CaraKnowledgeSnapshot {
  switch (patch.kind) {
    case "faq":
      return {
        ...snapshot,
        faqs: [
          ...(snapshot.faqs ?? []),
          { question: patch.question.trim(), answer: patch.answer.trim() },
        ],
      };
    case "service_offered": {
      const chips = dedupeCaraSetupChips([
        ...(snapshot.servicesOffered ?? []),
        normalizeCaraSetupChip(patch.label),
      ]);
      return { ...snapshot, servicesOffered: chips };
    }
    case "service_not_offered": {
      const chips = dedupeCaraSetupChips([
        ...(snapshot.servicesNotOffered ?? []),
        normalizeCaraSetupChip(patch.label),
      ]);
      return { ...snapshot, servicesNotOffered: chips };
    }
    case "business_rule":
      return {
        ...snapshot,
        businessRules: [
          ...(snapshot.businessRules ?? []),
          patch.rule.trim(),
        ],
      };
  }
}

export function lintTrainingFaqDuplicateIssues(
  patch: CaraTrainingPatch,
  faqs: AgentFaq[],
): TrainingSafetyIssue[] {
  if (patch.kind !== "faq") return [];

  const question = patch.question.trim();
  const answer = patch.answer.trim();
  const existingQuestions = faqs.map((faq) => faq.question);

  const exactMatch = findExactChipInList(question, existingQuestions);
  if (exactMatch) {
    const existing = faqs.find(
      (faq) =>
        normalizeCaraSetupChip(faq.question).toLowerCase() ===
        normalizeCaraSetupChip(exactMatch).toLowerCase(),
    );
    if (existing && existing.answer.trim() !== answer) {
      return [
        {
          id: "training-faq-exact-duplicate",
          message:
            "You already taught Cara a different answer to this question — update the existing one in Cara Setup or reword.",
        },
      ];
    }
  }

  const nearMatch = findNearDuplicateChip(question, existingQuestions);
  if (nearMatch) {
    const existing = faqs.find(
      (faq) =>
        normalizeCaraSetupChip(faq.question).toLowerCase() ===
        normalizeCaraSetupChip(nearMatch).toLowerCase(),
    );
    if (existing && existing.answer.trim() !== answer) {
      return [
        {
          id: "training-faq-near-duplicate",
          message: `This looks similar to an existing question (“${nearMatch}”) but with a different answer — update the existing FAQ in Cara Setup or reword so Cara isn't given conflicting facts.`,
        },
      ];
    }
  }

  return [];
}

function validatePatchBasics(
  patch: CaraTrainingPatch,
  faqCount: number,
  capabilities: CaraCapabilities,
): TrainingSafetyIssue[] {
  const issues: TrainingSafetyIssue[] = [];

  switch (patch.kind) {
    case "faq": {
      const question = patch.question.trim();
      const answer = patch.answer.trim();
      if (!question || !answer) {
        issues.push({
          id: "training-faq-empty",
          message: "FAQ needs both a question and an answer.",
        });
      }
      if (faqCount >= MAX_FAQS) {
        const status = faqCapacityStatus(faqCount);
        issues.push({
          id: "training-faq-capacity",
          message:
            status.message ??
            `You already have ${MAX_FAQS} FAQs. Remove one in Cara Setup before adding another.`,
        });
      }
      const injection = detectPromptInjectionViolation(`${question}\n${answer}`);
      if (injection) {
        issues.push({
          id: "training-faq-injection",
          message: injection,
        });
      }
      break;
    }
    case "service_offered":
    case "service_not_offered": {
      const label = normalizeCaraSetupChip(patch.label);
      if (!label) {
        issues.push({
          id: "training-service-empty",
          message: "Service label cannot be empty.",
        });
      }
      break;
    }
    case "business_rule": {
      const validation = validateCallHandlingAdd(patch.rule, "rule", capabilities);
      if (!validation.ok) {
        issues.push({
          id: "training-rule-blocked",
          message: validation.block,
        });
      }
      const injection = detectPromptInjectionViolation(patch.rule);
      if (injection) {
        issues.push({
          id: "training-rule-injection",
          message: injection,
        });
      }
      break;
    }
  }

  return issues;
}

export function assessTrainingPatchSafety(input: {
  patch: CaraTrainingPatch;
  snapshot: CaraKnowledgeSnapshot;
  capabilities?: CaraCapabilities;
}): { ok: true } | { ok: false; issues: TrainingSafetyIssue[] } {
  const capabilities =
    input.capabilities ?? deriveCaraCapabilities([], undefined);
  const faqs = input.snapshot.faqs ?? [];
  const issues: TrainingSafetyIssue[] = [
    ...validatePatchBasics(input.patch, faqs.length, capabilities),
    ...lintTrainingFaqDuplicateIssues(input.patch, faqs),
  ];

  const mergedSnapshot = applyPatchToSnapshot(input.snapshot, input.patch);
  const lintIssues = lintCaraKnowledge(mergedSnapshot, {
    surface: "dashboard",
  }).filter((issue) => issue.severity !== "info");

  for (const lintIssue of lintIssues) {
    issues.push(trainingIssueFromLint(lintIssue));
  }

  const deduped = dedupeTrainingIssues(issues);
  if (deduped.length > 0) {
    return { ok: false, issues: deduped };
  }
  return { ok: true };
}

export function formatTrainingSafetyBlockMessage(
  issues: TrainingSafetyIssue[],
): string {
  return issues[0]?.message ?? "This can't be saved safely yet.";
}
