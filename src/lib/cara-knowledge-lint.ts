import type { AgentFaq } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import {
  isFallbackRoute,
  routeKeywords,
  type SavedRoute,
} from "@/app/(dashboard)/dashboard/routing/route-models";
import type { RoutingActionSummary } from "@/lib/cara-custom-prompt";
import {
  caraSetupChipKey,
  dedupeCaraSetupChips,
  findExactChipInList,
  findNearDuplicateChip,
} from "@/lib/cara-setup-chips";
import {
  buildCallHandlingConflictWarnings,
  buildCaraCapabilitiesFromPromptExtras,
  looksLikeOpeningHours,
  looksLikeServiceExclusion,
  lintRuleVsRuleConflicts,
  validateCallHandlingAdd,
} from "@/lib/call-handling-boundary";
import { buildAnswersConflictWarnings } from "@/lib/answers-boundary";
import { buildServiceConflictWarnings } from "@/lib/services-boundary";
import {
  lintCatalogNearDuplicatePairs,
  type ServiceCatalogItem,
} from "@/lib/service-catalog-format";
import { isCatalogDuplicate } from "@/lib/service-catalog-supplement";
import { looksLikeCatalogListDump } from "@/lib/service-offered-raw";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import {
  businessFileKindLabel,
} from "@/lib/business-files";
import {
  overlapsCatalogKnowledge,
  overlapsFaqKnowledge,
} from "@/lib/knowledge-precedence";
import { validateServiceVoiceNote } from "@/lib/service-policy-presets";

import type { CaraKnowledgeSnapshot } from "./cara-knowledge-snapshot";

export type KnowledgeLintSeverity = "block" | "warn" | "info";

export type KnowledgeLintAction = "add_faq";

export type KnowledgeLintIssue = {
  id: string;
  severity: KnowledgeLintSeverity;
  message: string;
  field: string;
  canonicalHome?: string;
  href?: string;
  secondaryHref?: string;
  placement?: "banner" | "inline";
  targetKey?: string;
  action?: KnowledgeLintAction;
  sourceText?: string;
};

export type KnowledgeLintOptions = {
  focusField?: string;
  surface?: "onboarding" | "dashboard";
};

const STEP_FIELD_MAP: Record<string, string[]> = {
  about: ["about"],
  services: ["servicesOffered", "servicesOfferedRaw"],
  exclusions: ["servicesNotOffered", "servicesNotOfferedRaw"],
  hours: ["openingHours", "serviceArea"],
  capture: ["captureFields", "detailsToCollect"],
  rules: ["businessRules", "rulesRaw"],
  faqs: ["faqs"],
  review: [],
};

function actionPhraseForOutcome(outcome: SavedRoute["outcome"]): string {
  switch (outcome) {
    case "send_link":
      return "text them the saved link";
    case "send_file":
      return "send them the saved file";
    case "email":
      return "take their details and email the team";
    case "whatsapp":
      return "follow up with them on WhatsApp";
    case "transfer":
      return "try to put them through to the team";
    case "action_inbox":
    default:
      return "take a message for the team";
  }
}

function routesForSnapshot(snapshot: CaraKnowledgeSnapshot): RoutingActionSummary[] {
  if (snapshot.routingSummaries?.length) {
    return snapshot.routingSummaries;
  }

  return (snapshot.routes ?? [])
    .filter((route) => route.active && !isFallbackRoute(route) && routeKeywords(route))
    .map((route) => ({
      trigger: routeKeywords(route),
      action: actionPhraseForOutcome(route.outcome),
      instruction: route.description?.trim() || undefined,
    }));
}

function faqLite(faqs: AgentFaq[] | undefined): { question: string; answer: string }[] {
  return (faqs ?? []).map((faq) => ({
    question: faq.question,
    answer: faq.answer,
  }));
}

function catalogNearDuplicateIssues(
  catalog: ServiceCatalogItem[],
): KnowledgeLintIssue[] {
  const issues: KnowledgeLintIssue[] = [];

  for (const pair of lintCatalogNearDuplicatePairs(catalog)) {
    for (const item of [pair.a, pair.b]) {
      issues.push({
        id: `catalog-near-dup-${item.id}`,
        severity: "warn",
        field: "serviceCatalog",
        placement: "inline",
        targetKey: item.id,
        message: `"${item.name}" looks like the same service as another menu item with the same price and duration — keep one.`,
        href: DASHBOARD_ROUTES.businessServices,
      });
    }
  }

  return issues;
}

function duplicateChipIssues(
  items: string[],
  field: string,
): KnowledgeLintIssue[] {
  const issues: KnowledgeLintIssue[] = [];
  const seen = new Map<string, string>();

  for (const item of items) {
    const key = caraSetupChipKey(item);
    if (!key) continue;
    const prior = seen.get(key);
    if (prior) {
      issues.push({
        id: `dup-${field}-${key}`,
        severity: "block",
        field,
        message: `Duplicate entry: "${item}" matches "${prior}" — remove one.`,
      });
      continue;
    }
    seen.set(key, item);

    for (const existing of seen.keys()) {
      if (existing === key) continue;
      const near = findNearDuplicateChip(item, [seen.get(existing)!]);
      if (near) {
        issues.push({
          id: `near-dup-${field}-${key}`,
          severity: "warn",
          field,
          placement: "inline",
          targetKey: item,
          message: `"${item}" is very similar to "${near}" — consider keeping one.`,
        });
      }
    }
  }

  return issues;
}

function crossOfferedExcludedIssues(
  offered: string[],
  excluded: string[],
): KnowledgeLintIssue[] {
  const issues: KnowledgeLintIssue[] = [];

  for (const item of offered) {
    const exact = findExactChipInList(item, excluded);
    if (exact) {
      issues.push({
        id: `cross-offer-exclude-${caraSetupChipKey(item)}`,
        severity: "block",
        field: "servicesOffered",
        canonicalHome: "servicesNotOffered",
        message: `"${item}" is listed as offered and not offered — remove it from one list.`,
      });
    }
  }

  return issues;
}

function ruleComplianceIssues(rules: string[], caps: ReturnType<typeof buildCaraCapabilitiesFromPromptExtras>): KnowledgeLintIssue[] {
  const issues: KnowledgeLintIssue[] = [];

  for (const rule of rules) {
    const validation = validateCallHandlingAdd(rule, "rule", caps);
    if (!validation.ok) {
      issues.push({
        id: `rule-block-${caraSetupChipKey(rule)}`,
        severity: "block",
        field: "businessRules",
        message: validation.block,
      });
    }
  }

  return issues;
}

function proseWrongHomeIssues(
  raw: string | undefined,
  field: string,
): KnowledgeLintIssue[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];

  const issues: KnowledgeLintIssue[] = [];

  if (field !== "openingHours" && looksLikeOpeningHours(text)) {
    issues.push({
      id: `wrong-home-hours-${field}`,
      severity: "warn",
      field,
      canonicalHome: "openingHours",
      message: "This looks like opening hours — Cara already has a dedicated hours field.",
    });
  }

  if (field !== "servicesNotOffered" && looksLikeServiceExclusion(text)) {
    issues.push({
      id: `wrong-home-exclusion-${field}`,
      severity: "warn",
      field,
      canonicalHome: "servicesNotOffered",
      message: "This looks like something you don't offer — move it to exclusions instead.",
    });
  }

  return issues;
}

function serviceCatalogVoiceNoteIssues(
  catalog: ServiceCatalogItem[],
  caps: ReturnType<typeof buildCaraCapabilitiesFromPromptExtras>,
): KnowledgeLintIssue[] {
  const issues: KnowledgeLintIssue[] = [];

  for (const item of catalog) {
    const note = item.aiVoiceNotes?.trim();
    if (!note) continue;

    const validation = validateServiceVoiceNote(note, caps);
    if (!validation.ok) {
      issues.push({
        id: `svc-note-block-${item.id}`,
        severity: "block",
        field: "serviceCatalog",
        placement: "inline",
        targetKey: item.id,
        message: `"${item.name}": ${validation.block}`,
        href: DASHBOARD_ROUTES.businessServices,
      });
      continue;
    }

    for (const warning of validation.warnings ?? []) {
      issues.push({
        id: `svc-note-warn-${item.id}-${caraSetupChipKey(warning)}`,
        severity: "warn",
        field: "serviceCatalog",
        placement: "inline",
        targetKey: item.id,
        message: `"${item.name}": ${warning}`,
        href: DASHBOARD_ROUTES.businessServices,
      });
    }
  }

  return issues;
}

function mapConflictSeverity(
  id: string,
  message: string,
  field: string,
  href?: string,
  secondaryHref?: string,
  extra?: Pick<KnowledgeLintIssue, "placement" | "targetKey" | "action" | "sourceText">,
): KnowledgeLintIssue {
  const isBlock =
    id.startsWith("rule-rule-") ||
    id.startsWith("rule-faq-price") ||
    id.startsWith("rule-file-price") ||
    id.startsWith("catalog-prices-never-quote");

  return {
    id,
    severity: isBlock ? "block" : "warn",
    field,
    message,
    href,
    secondaryHref,
    placement: extra?.placement ?? (isBlock ? "banner" : "inline"),
    targetKey: extra?.targetKey,
    action: extra?.action,
    sourceText: extra?.sourceText,
  };
}

function issuesForField(
  snapshot: CaraKnowledgeSnapshot,
  field: string,
  options: KnowledgeLintOptions = {},
): KnowledgeLintIssue[] {
  const caps = buildCaraCapabilitiesFromPromptExtras(
    routesForSnapshot(snapshot),
    snapshot.transferNumber,
  );
  const faqs = faqLite(snapshot.faqs);
  const offered = snapshot.servicesOffered ?? [];
  const excluded = snapshot.servicesNotOffered ?? [];
  const rules = snapshot.businessRules ?? [];
  const details = snapshot.detailsToCollect ?? [];

  const issues: KnowledgeLintIssue[] = [];

  if (field === "businessRules" || field === "rulesRaw") {
    if (options.surface !== "dashboard") {
      issues.push(...ruleComplianceIssues(rules, caps));
      issues.push(...duplicateChipIssues(rules, "businessRules"));
      issues.push(
        ...lintRuleVsRuleConflicts(rules).map((warning) =>
          mapConflictSeverity(
            warning.id,
            warning.message,
            "businessRules",
            warning.href,
            warning.secondaryHref,
          ),
        ),
      );
    }
    if (snapshot.rulesRaw) {
      issues.push(...proseWrongHomeIssues(snapshot.rulesRaw, "rulesRaw"));
    }
  }

  const catalogActive =
    snapshot.serviceCatalog && snapshot.serviceCatalog.length > 0;

  if (field === "serviceCatalog" && catalogActive) {
    issues.push(
      ...serviceCatalogVoiceNoteIssues(snapshot.serviceCatalog!, caps),
    );
  }

  if (field === "servicesOffered" || field === "servicesOfferedRaw") {
    if (!catalogActive) {
      issues.push(...duplicateChipIssues(offered, "servicesOffered"));
    } else {
      issues.push(...catalogNearDuplicateIssues(snapshot.serviceCatalog!));
    }
    if (
      snapshot.servicesOfferedRaw &&
      snapshot.serviceCatalog &&
      snapshot.serviceCatalog.length > 0
    ) {
      const dump = looksLikeCatalogListDump(
        snapshot.servicesOfferedRaw,
        snapshot.serviceCatalog.map((item) => item.name),
        offered.join(", "),
      );
      if (dump) {
        issues.push({
          id: "catalog-dump-offered-raw",
          severity: "warn",
          field: "servicesOfferedRaw",
          message:
            "This paragraph looks like a copy of your service menu — use plain English or edit the catalog instead.",
        });
      }
    }
    if (snapshot.servicesOfferedRaw) {
      issues.push(
        ...proseWrongHomeIssues(snapshot.servicesOfferedRaw, "servicesOfferedRaw"),
      );
    }
  }

  if (field === "servicesNotOffered" || field === "servicesNotOfferedRaw") {
    issues.push(...duplicateChipIssues(excluded, "servicesNotOffered"));
    if (snapshot.servicesNotOfferedRaw) {
      issues.push(
        ...proseWrongHomeIssues(
          snapshot.servicesNotOfferedRaw,
          "servicesNotOfferedRaw",
        ),
      );
    }
  }

  if (
    field === "servicesOffered" ||
    field === "servicesNotOffered" ||
    field === "faqs"
  ) {
    issues.push(...crossOfferedExcludedIssues(offered, excluded));
    issues.push(
      ...buildServiceConflictWarnings(
        excluded,
        faqs,
        snapshot.anythingElse ?? "",
      ).map((warning) =>
        mapConflictSeverity(
          `svc-${warning.exclusion}-${warning.location}`,
          warning.message,
          "servicesNotOffered",
        ),
      ),
    );
  }

  if (field === "faqs" || field === "businessRules") {
    issues.push(
      ...buildCallHandlingConflictWarnings({
        businessRules: rules,
        detailsToCollect: details,
        faqs,
        businessFiles: snapshot.businessFiles ?? [],
        routes: routesForSnapshot(snapshot),
        transferNumber: snapshot.transferNumber,
        serviceCatalog: snapshot.serviceCatalog,
      })
        .filter((warning) => warning.id.startsWith("rule-faq") || warning.id.startsWith("rule-file"))
        .map((warning) =>
          mapConflictSeverity(
            warning.id,
            warning.message,
            warning.id.startsWith("rule-faq") ? "faqs" : "businessRules",
            warning.href,
            warning.secondaryHref,
          ),
        ),
    );
  }

  if (field === "faqs" && snapshot.businessFiles) {
    issues.push(
      ...buildAnswersConflictWarnings({
        faqs: snapshot.faqs ?? [],
        businessFiles: snapshot.businessFiles,
      }).map((warning) => ({
        id: warning.id,
        severity: "warn" as const,
        field: "faqs",
        message: warning.message,
        href: warning.href,
        secondaryHref: warning.secondaryHref,
      })),
    );
  }

  if (field === "captureFields" || field === "detailsToCollect") {
    for (const item of details) {
      const validation = validateCallHandlingAdd(item, "detail", caps);
      if (!validation.ok) {
        issues.push({
          id: `detail-block-${caraSetupChipKey(item)}`,
          severity: "block",
          field: "detailsToCollect",
          message: validation.block,
        });
      }
    }
    issues.push(...duplicateChipIssues(details, "detailsToCollect"));
  }

  return issues;
}

function hasPopulatedFaqs(faqs: AgentFaq[] | undefined): boolean {
  return (faqs ?? []).some(
    (faq) => faq.question.trim() && faq.answer.trim(),
  );
}

function hasStructuredHoursConfigured(snapshot: CaraKnowledgeSnapshot): boolean {
  if (snapshot.hoursNeverConfigured === true) return false;
  if (snapshot.open24_7 === true) return true;
  return Boolean(snapshot.openingHours?.trim());
}

export function lintCrossSurfaceKnowledge(
  snapshot: CaraKnowledgeSnapshot,
): KnowledgeLintIssue[] {
  const issues: KnowledgeLintIssue[] = [];
  const catalog = snapshot.serviceCatalog ?? [];
  const catalogActive = catalog.length > 0;
  const offered = snapshot.servicesOffered ?? [];
  const supplement = snapshot.serviceCatalogSupplement;
  const files = snapshot.businessFiles ?? [];
  const faqs = snapshot.faqs ?? [];

  for (const file of files) {
    if (!file.answerEnabled || !file.extractedText?.trim()) continue;
    const kind = file.documentKind;
    const label = businessFileKindLabel(kind) ?? "document";

    if (catalogActive && overlapsCatalogKnowledge(kind)) {
      issues.push({
        id: `cross-file-catalog-${kind}-${file.id}`,
        severity: "warn",
        field: "businessFiles",
        placement: "inline",
        targetKey: file.id,
        message: `You've uploaded a ${label.toLowerCase()}, but your Services menu is already set up — Cara will use the menu. Only keep this file for details not in the menu.`,
        href: DASHBOARD_ROUTES.businessServices,
        secondaryHref: DASHBOARD_ROUTES.businessFiles,
      });
    }

    if (hasPopulatedFaqs(faqs) && overlapsFaqKnowledge(kind)) {
      issues.push({
        id: `cross-file-faq-${file.id}`,
        severity: "warn",
        field: "faqs",
        placement: "inline",
        message:
          "You've uploaded an FAQ document, but your FAQ answers are already set up — Cara will use those. Only keep this file for details not in your FAQs.",
        href: DASHBOARD_ROUTES.businessFaqs,
        secondaryHref: DASHBOARD_ROUTES.businessFiles,
      });
    }
  }

  if (catalogActive) {
    const catalogNames = catalog.map((item) => item.name);
    for (const item of supplement?.supplementalServices ?? []) {
      if (isCatalogDuplicate(item, catalogNames)) {
        issues.push({
          id: `cross-svc-name-supplement-${caraSetupChipKey(item)}`,
          severity: "warn",
          field: "serviceCatalog",
          placement: "inline",
          message: `"${item}" is already on your Services menu — remove it from supplemental services.`,
          href: DASHBOARD_ROUTES.businessServices,
        });
      }
    }
    for (const item of offered) {
      if (isCatalogDuplicate(item, catalogNames)) {
        issues.push({
          id: `cross-svc-name-offered-${caraSetupChipKey(item)}`,
          severity: "warn",
          field: "servicesOffered",
          placement: "inline",
          targetKey: item,
          message: `"${item}" is already on your Services menu — you don't need it in both places.`,
          href: DASHBOARD_ROUTES.businessServices,
        });
      }
    }
  }

  if (
    hasStructuredHoursConfigured(snapshot) &&
    snapshot.openingHoursLegacy?.trim()
  ) {
    issues.push({
      id: "cross-dual-hours",
      severity: "warn",
      field: "openingHours",
      placement: "inline",
      message:
        "You have opening hours in both the structured hours field and legacy text — Cara uses the structured hours. Clear the legacy text to avoid confusion.",
      href: DASHBOARD_ROUTES.businessProfile,
    });
  }

  return issues;
}

export function lintCaraKnowledge(
  snapshot: CaraKnowledgeSnapshot,
  options: KnowledgeLintOptions = {},
): KnowledgeLintIssue[] {
  const fields = options.focusField
    ? STEP_FIELD_MAP[options.focusField] ?? [options.focusField]
    : [
        "about",
        "servicesOffered",
        "servicesOfferedRaw",
        "servicesNotOffered",
        "servicesNotOfferedRaw",
        "serviceCatalog",
        "openingHours",
        "businessRules",
        "rulesRaw",
        "detailsToCollect",
        "faqs",
        "anythingElse",
      ];

  const uniqueFields = [...new Set(fields)];
  const issues: KnowledgeLintIssue[] = [];

  for (const field of uniqueFields) {
    issues.push(...issuesForField(snapshot, field, options));
  }

  issues.push(...lintCrossSurfaceKnowledge(snapshot));

  if (!options.focusField || options.focusField === "review") {
    issues.push(
      ...buildCallHandlingConflictWarnings({
        businessRules: snapshot.businessRules ?? [],
        detailsToCollect: snapshot.detailsToCollect ?? [],
        faqs: faqLite(snapshot.faqs),
        businessFiles: snapshot.businessFiles ?? [],
        routes: routesForSnapshot(snapshot),
        transferNumber: snapshot.transferNumber,
        serviceCatalog: snapshot.serviceCatalog,
        lintBusinessRuleCapabilities: options.surface !== "dashboard",
      }).map((warning) =>
        mapConflictSeverity(
          warning.id,
          warning.message,
          warning.id.includes("rule") || warning.id.startsWith("capability-book")
            ? "businessRules"
            : "detailsToCollect",
          warning.href,
          warning.secondaryHref,
          {
            placement: "inline",
            targetKey: warning.sourceText,
            action: warning.action,
            sourceText: warning.sourceText,
          },
        ),
      ),
    );
  }

  const seen = new Set<string>();
  return issues.filter((issue) => {
    if (seen.has(issue.id)) return false;
    seen.add(issue.id);
    return true;
  });
}

export function firstBlockingKnowledgeLint(
  snapshot: CaraKnowledgeSnapshot,
  options?: KnowledgeLintOptions,
): KnowledgeLintIssue | null {
  return (
    lintCaraKnowledge(snapshot, options).find(
      (issue) => issue.severity === "block",
    ) ?? null
  );
}

export function lintExtractedKnowledgeLists(input: {
  businessRules?: string[];
  servicesOffered?: string[];
  servicesNotOffered?: string[];
  snapshot: CaraKnowledgeSnapshot;
}): KnowledgeLintIssue[] {
  const merged: CaraKnowledgeSnapshot = {
    ...input.snapshot,
    businessRules: input.businessRules ?? input.snapshot.businessRules,
    servicesOffered: input.servicesOffered ?? input.snapshot.servicesOffered,
    servicesNotOffered:
      input.servicesNotOffered ?? input.snapshot.servicesNotOffered,
  };

  return lintCaraKnowledge(merged).filter((issue) => issue.severity === "block");
}

export function dedupeKnowledgeList(items: string[]): string[] {
  return dedupeCaraSetupChips(items);
}

export function knowledgeLintForFields(
  issues: KnowledgeLintIssue[],
  fields: string[],
): KnowledgeLintIssue[] {
  const fieldSet = new Set(fields);
  return issues.filter((issue) => fieldSet.has(issue.field));
}

export function isBannerLintIssue(issue: KnowledgeLintIssue): boolean {
  if (issue.placement === "banner") return true;
  if (issue.placement === "inline") return false;
  return issue.severity === "block" && !issue.targetKey;
}

export function partitionLintIssues(issues: KnowledgeLintIssue[]): {
  banner: KnowledgeLintIssue[];
  inline: KnowledgeLintIssue[];
} {
  const banner: KnowledgeLintIssue[] = [];
  const inline: KnowledgeLintIssue[] = [];
  for (const issue of issues) {
    (isBannerLintIssue(issue) ? banner : inline).push(issue);
  }
  return { banner, inline };
}

export function inlineLintIssuesFor(
  issues: KnowledgeLintIssue[],
  field: string,
  targetKey?: string,
): KnowledgeLintIssue[] {
  return issues.filter((issue) => {
    if (isBannerLintIssue(issue)) return false;
    if (issue.field !== field) return false;
    if (targetKey !== undefined && issue.targetKey !== targetKey) return false;
    return true;
  });
}
