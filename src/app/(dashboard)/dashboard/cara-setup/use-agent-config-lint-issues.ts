"use client";

import { useMemo } from "react";

import {
  compileCaraPromptWithMeta,
  MAX_PROMPT_CHARS,
  PROMPT_BUDGET_WARN_RATIO,
} from "@/lib/compile-cara-prompt";
import {
  lintCaraKnowledge,
  type KnowledgeLintIssue,
} from "@/lib/cara-knowledge-lint";
import { snapshotFromLists } from "@/lib/cara-knowledge-snapshot";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { formatAgentKnowledgeList, formatWeekScheduleForAgent } from "@/lib/agent-knowledge-format";
import { cleanBusinessRules } from "@/lib/agent-business-rules";
import { weekScheduleHasOpenDay } from "@/lib/business-hours";

import { useCaraSetupForm } from "./cara-setup-form-context";

export function filterFilesPageLintIssues(
  issues: KnowledgeLintIssue[],
): KnowledgeLintIssue[] {
  return issues.filter((issue) => {
    if (issue.id.startsWith("duplicate-kind-")) return true;
    if (issue.id.startsWith("faq-file-price-")) return true;
    if (issue.id.startsWith("rule-file-")) return true;
    if (issue.id.startsWith("cross-file-catalog-")) return true;
    if (issue.href?.includes(DASHBOARD_ROUTES.businessFiles)) return true;
    if (issue.secondaryHref?.includes(DASHBOARD_ROUTES.businessFiles)) {
      return true;
    }
    return false;
  });
}

export function filterFaqsPageLintIssues(
  issues: KnowledgeLintIssue[],
): KnowledgeLintIssue[] {
  return issues.filter((issue) => {
    if (issue.field === "faqs") return true;
    if (issue.id.startsWith("cross-file-faq-")) return true;
    if (issue.id.startsWith("faq-file-price-")) return true;
    if (issue.id.startsWith("rule-faq")) return true;
    return false;
  });
}

export function filterServicesPageLintIssues(
  issues: KnowledgeLintIssue[],
): KnowledgeLintIssue[] {
  return issues.filter((issue) => {
    if (issue.id.startsWith("catalog-near-dup-")) return false;
    if (
      issue.field === "servicesOffered" ||
      issue.field === "servicesOfferedRaw" ||
      issue.field === "servicesNotOffered" ||
      issue.field === "servicesNotOfferedRaw" ||
      issue.field === "serviceCatalog"
    ) {
      return true;
    }
    if (issue.id.startsWith("catalog-")) return true;
    if (issue.id.startsWith("svc-")) return true;
    if (issue.id.startsWith("cross-svc-name-")) return true;
    if (issue.id.startsWith("cross-dual-hours")) return true;
    if (issue.id.startsWith("cross-file-catalog-")) return true;
    return false;
  });
}

export function useAgentConfigLintIssues(): KnowledgeLintIssue[] {
  const form = useCaraSetupForm();

  return useMemo(() => {
    const hasHours = weekScheduleHasOpenDay(form.openingHoursSchedule);
    const openingHours = form.open24_7
      ? "Open 24 hours, 7 days a week"
      : hasHours
        ? formatWeekScheduleForAgent(form.openingHoursSchedule)
        : "Closed all week";

    const snapshot = snapshotFromLists({
      openingHours,
      openingHoursLegacy: form.openingHoursLegacy,
      hoursNeverConfigured: form.hoursNeverConfigured,
      open24_7: form.open24_7,
      serviceArea: formatAgentKnowledgeList(form.serviceAreaItems),
      servicesOffered: formatAgentKnowledgeList(form.servicesItems),
      servicesNotOffered: formatAgentKnowledgeList(form.servicesNotOfferedItems),
      businessRules: cleanBusinessRules(form.businessRulesItems),
      faqs: form.faqs,
      routes: undefined,
      routingSummaries: form.promptExtras.routes,
      transferNumber: form.promptExtras.transferNumber,
      serviceCatalog: form.serviceCatalog,
      serviceCatalogSupplement: form.serviceCatalogSupplement,
      businessFiles: form.businessFiles,
    });

    const lintIssues: KnowledgeLintIssue[] = lintCaraKnowledge(snapshot, {
      surface: "dashboard",
    });

    const { compileMeta } = compileCaraPromptWithMeta({
      businessName: form.businessName,
      assistantDisplayName: form.assistantDisplayName,
      businessType: form.businessType,
      faqs: form.faqs,
      businessRules: cleanBusinessRules(form.businessRulesItems),
      routes: form.promptExtras.routes,
      transferNumber: form.promptExtras.transferNumber,
      serviceCatalog:
        form.serviceCatalog.length > 0 ? form.serviceCatalog : undefined,
    });

    if (compileMeta.droppedFaqCount > 0) {
      lintIssues.push({
        id: "prompt-faqs-trimmed",
        severity: "block",
        field: "faqs",
        placement: "banner",
        message: `Cara's instructions are too long — ${compileMeta.droppedFaqCount} FAQ${compileMeta.droppedFaqCount === 1 ? "" : "s"} would be left out of live calls. Shorten FAQs or remove less important ones before saving.`,
      });
    } else if (compileMeta.nearBudget) {
      lintIssues.push({
        id: "prompt-near-budget",
        severity: "warn",
        field: "faqs",
        placement: "banner",
        message: `Cara's instructions are ${Math.round((compileMeta.charCount / MAX_PROMPT_CHARS) * 100)}% of the prompt budget (~${compileMeta.estimatedTokens} tokens). Consider trimming FAQs if you add more.`,
      });
    } else if (
      compileMeta.charCount >=
      MAX_PROMPT_CHARS * PROMPT_BUDGET_WARN_RATIO
    ) {
      lintIssues.push({
        id: "prompt-near-budget",
        severity: "warn",
        field: "faqs",
        placement: "banner",
        message: `Cara's instructions are approaching the prompt budget (~${compileMeta.estimatedTokens} tokens).`,
      });
    }

    const seen = new Set<string>();
    return lintIssues.filter((issue) => {
      if (seen.has(issue.id)) return false;
      seen.add(issue.id);
      return issue.severity !== "info";
    });
  }, [form]);
}

export function useServicesPageLintIssues(): KnowledgeLintIssue[] {
  const all = useAgentConfigLintIssues();
  return useMemo(() => filterServicesPageLintIssues(all), [all]);
}

export function useFilesPageLintIssues(): KnowledgeLintIssue[] {
  const all = useAgentConfigLintIssues();
  return useMemo(() => filterFilesPageLintIssues(all), [all]);
}

export function useFaqsPageLintIssues(): KnowledgeLintIssue[] {
  const all = useAgentConfigLintIssues();
  return useMemo(() => filterFaqsPageLintIssues(all), [all]);
}
