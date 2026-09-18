import { parseAgentFaqs } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import { parseAgentBusinessRules } from "@/lib/agent-business-rules";
import { parseAgentKnowledgeList } from "@/lib/agent-knowledge-format";
import {
  CARA_KNOWLEDGE_CATEGORIES,
  type CaraKnowledgeCategoryId,
} from "@/lib/cara-knowledge-sections";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import {
  normalizeTrainingTopic,
  type CaraTrainingItemRow,
} from "@/lib/cara-training-types";
import type {
  TemporalOverridePreview,
  TemporalSubjectType,
  TemporalUpdateRecord,
} from "@/lib/cara-knowledge-temporal";
import {
  isTemporalUpdateVisible,
  resolveBusinessTimezone,
} from "@/lib/cara-knowledge-temporal";

export type CaraKnowledgeEntrySource =
  | "faq"
  | "service"
  | "rule"
  | "summary"
  | "training_applied"
  | "temporal";

export type CaraKnowledgeTemporalMeta = {
  updateId: string;
  durationMode: "limited" | "ongoing";
  effectiveAt: string;
  expiresAt: string | null;
  timezone: string;
  overridePreview: TemporalOverridePreview | null;
  replacesEntryId: string | null;
};

export type CaraKnowledgeEntry = {
  id: string;
  category: CaraKnowledgeCategoryId;
  title: string;
  body: string;
  source: CaraKnowledgeEntrySource;
  editHref?: string;
  editLabel?: string;
  trainingItemId?: string | null;
  updatedAt?: string | null;
  temporal?: CaraKnowledgeTemporalMeta;
  activeTemporalSummary?: string;
  linkedTemporalUpdateId?: string;
};

export type CaraKnowledgeIndex = {
  entries: CaraKnowledgeEntry[];
  openGaps: CaraTrainingItemRow[];
};

export type CaraKnowledgeSearchResult = {
  knows: CaraKnowledgeEntry[];
  related: CaraKnowledgeEntry[];
  gaps: CaraTrainingItemRow[];
};

/** Canonical facts edited under Business profile — kept for Cara, hidden from browse. */
export const PROFILE_MANAGED_KNOWLEDGE_ENTRY_IDS = [
  "fact-about",
  "fact-hours",
  "fact-summary",
] as const;

export function isProfileManagedKnowledgeEntry(entry: CaraKnowledgeEntry): boolean {
  return (PROFILE_MANAGED_KNOWLEDGE_ENTRY_IDS as readonly string[]).includes(entry.id);
}

export function knowledgeEntriesForBrowse(
  entries: CaraKnowledgeEntry[],
): CaraKnowledgeEntry[] {
  return entries.filter((entry) => !isProfileManagedKnowledgeEntry(entry));
}

export function browseTemporalRank(entry: CaraKnowledgeEntry): number {
  if (entry.source === "temporal") return 2;
  if (entry.activeTemporalSummary) return 1;
  return 0;
}

const PRICE_RE =
  /\b(price|pricing|cost|how much|quote|estimate|€|eur|cent|cents)\b/i;

function slugId(prefix: string, value: string): string {
  return `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function faqKnowledgeEntryId(question: string): string {
  return slugId("faq", question);
}

export function businessRuleKnowledgeEntryId(rule: string): string {
  return slugId("rule", rule);
}

export function notOfferedKnowledgeEntryId(item: string): string {
  return slugId("not-offered", item);
}

export function knowledgeEntryIdForPatch(
  itemId: string,
  patch: import("@/lib/cara-training-types").CaraTrainingPatch,
): string {
  if (patch.kind === "faq") {
    return faqKnowledgeEntryId(patch.question);
  }
  if (patch.kind === "service_not_offered") {
    return slugId("not-offered", patch.label);
  }
  if (patch.kind === "business_rule") {
    return slugId("rule", patch.rule);
  }
  return `training-${itemId}`;
}

function businessProfileHash(sectionId: string): string {
  return `${DASHBOARD_ROUTES.businessProfile}#${sectionId}`;
}

function businessServicesHash(sectionId: string): string {
  return `${DASHBOARD_ROUTES.businessServices}#${sectionId}`;
}

function businessAnswersHash(entryId: string): string {
  return `${DASHBOARD_ROUTES.businessAnswers}#${entryId}`;
}

function scoreMatch(query: string, entry: CaraKnowledgeEntry): number {
  return knowledgeSearchScore(query, entry.title, entry.body);
}

export function knowledgeSearchScore(query: string, ...parts: string[]): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const haystack = parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  if (!haystack) return 0;
  if (haystack.includes(q)) return 100;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  const hits = tokens.filter((token) => haystack.includes(token)).length;
  return hits > 0 ? (hits / tokens.length) * 60 : 0;
}

export function matchesKnowledgeSearchQuery(
  query: string,
  ...parts: string[]
): boolean {
  return knowledgeSearchScore(query, ...parts) > 0;
}

function inferCategoryFromText(text: string): CaraKnowledgeCategoryId {
  if (PRICE_RE.test(text)) return "prices";
  return "policies";
}

export function buildCaraKnowledgeIndex(input: {
  faqs: unknown;
  servicesOffered: string | null | undefined;
  servicesNotOffered: string | null | undefined;
  businessRules: unknown;
  businessKnowledgeSummary?: string | null;
  rawBusinessDescription?: string | null;
  openingHours?: string | null;
  serviceArea?: string | null;
  agentBaseTown?: string | null;
  appliedTrainingItems?: CaraTrainingItemRow[];
  openTrainingItems?: CaraTrainingItemRow[];
  orgUpdatedAt?: string | null;
}): CaraKnowledgeIndex {
  const fallbackUpdatedAt = input.orgUpdatedAt ?? null;
  const appliedAtByItemId = new Map(
    (input.appliedTrainingItems ?? []).map((item) => [
      item.id,
      item.applied_at ?? item.updated_at ?? null,
    ]),
  );
  const entries: CaraKnowledgeEntry[] = [];

  for (const faq of parseAgentFaqs(input.faqs)) {
    const id = faqKnowledgeEntryId(faq.question);
    const category = PRICE_RE.test(`${faq.question} ${faq.answer}`)
      ? "prices"
      : "answers";
    entries.push({
      id,
      category,
      title: faq.question,
      body: faq.answer,
      source: "faq",
      editHref: businessAnswersHash(id),
      editLabel: "Edit answer",
      updatedAt: fallbackUpdatedAt,
    });
  }

  for (const item of parseAgentKnowledgeList(String(input.servicesNotOffered ?? ""))) {
    entries.push({
      id: slugId("not-offered", item),
      category: "not-offered",
      title: item,
      body: "Not offered — Cara will decline this on calls.",
      source: "service",
      editHref: businessServicesHash("cara-services-not-offered"),
      editLabel: "Edit in Services",
      updatedAt: fallbackUpdatedAt,
    });
  }

  for (const rule of parseAgentBusinessRules(input.businessRules)) {
    entries.push({
      id: slugId("rule", rule),
      category: inferCategoryFromText(rule),
      title: rule,
      body: rule,
      source: "rule",
      updatedAt: fallbackUpdatedAt,
    });
  }

  const summary = String(input.businessKnowledgeSummary ?? "").trim();
  if (summary) {
    entries.push({
      id: "fact-summary",
      category: "facts",
      title: "Store knowledge summary",
      body: summary,
      source: "summary",
      updatedAt: fallbackUpdatedAt,
    });
  }

  const about = String(input.rawBusinessDescription ?? "").trim();
  if (about) {
    entries.push({
      id: "fact-about",
      category: "facts",
      title: "About the business",
      body: about,
      source: "summary",
      editHref: businessProfileHash("cara-business-description"),
      editLabel: "Edit description",
      updatedAt: fallbackUpdatedAt,
    });
  }

  const hours = String(input.openingHours ?? "").trim();
  if (hours) {
    entries.push({
      id: "fact-hours",
      category: "facts",
      title: "Opening hours",
      body: hours,
      source: "summary",
      editHref: businessProfileHash("cara-opening-hours"),
      editLabel: "Edit hours",
      updatedAt: fallbackUpdatedAt,
    });
  }

  const area = String(input.serviceArea ?? "").trim();
  if (area) {
    entries.push({
      id: "fact-area",
      category: "facts",
      title: "Service area",
      body: area,
      source: "summary",
      updatedAt: fallbackUpdatedAt,
    });
  }

  const town = String(input.agentBaseTown ?? "").trim();
  if (town) {
    entries.push({
      id: slugId("fact-town", town),
      category: "facts",
      title: town,
      body: "Store location",
      source: "summary",
      editHref: businessProfileHash("cara-location-town"),
      editLabel: "Edit location",
      updatedAt: fallbackUpdatedAt,
    });
  }

  for (const item of input.appliedTrainingItems ?? []) {
    const patch = item.applied_patch;
    if (!patch) continue;
    if (patch.kind === "service_offered") {
      continue;
    }
    const entryId = knowledgeEntryIdForPatch(item.id, patch);
    if (patch.kind === "faq") {
      entries.push({
        id: entryId,
        category: PRICE_RE.test(`${patch.question} ${patch.answer}`)
          ? "prices"
          : "answers",
        title: patch.question,
        body: patch.answer,
        source: "training_applied",
        trainingItemId: item.id,
        editHref: businessAnswersHash(entryId),
        editLabel: "Edit answer",
        updatedAt: appliedAtByItemId.get(item.id) ?? item.updated_at ?? null,
      });
      continue;
    }
    if (patch.kind === "service_not_offered") {
      entries.push({
        id: entryId,
        category: "not-offered",
        title: patch.label,
        body: "Not offered — Cara will decline this on calls.",
        source: "training_applied",
        trainingItemId: item.id,
        editHref: businessServicesHash("cara-services-not-offered"),
        editLabel: "Edit in Services",
        updatedAt: appliedAtByItemId.get(item.id) ?? item.updated_at ?? null,
      });
      continue;
    }
    entries.push({
      id: entryId,
      category: inferCategoryFromText(patch.rule),
      title: patch.rule,
      body: patch.rule,
      source: "training_applied",
      trainingItemId: item.id,
      updatedAt: appliedAtByItemId.get(item.id) ?? item.updated_at ?? null,
    });
  }

  return {
    entries: dedupeKnowledgeEntries(entries),
    openGaps: input.openTrainingItems ?? [],
  };
}

function categoryForTemporalSubject(subjectType: TemporalSubjectType): CaraKnowledgeCategoryId {
  if (subjectType === "opening_hours") return "facts";
  if (subjectType === "price") return "prices";
  if (subjectType === "faq") return "answers";
  if (subjectType === "availability") return "services";
  return "policies";
}

export function mergeTemporalUpdatesIntoKnowledgeIndex(
  index: CaraKnowledgeIndex,
  updates: TemporalUpdateRecord[],
  timezoneInput?: string | null,
  now: Date = new Date(),
): CaraKnowledgeIndex {
  const timezone = resolveBusinessTimezone(timezoneInput);
  const visible = updates.filter((row) => isTemporalUpdateVisible(row, now));
  if (visible.length === 0) return index;

  const entries = [...index.entries];
  for (const update of visible) {
    const entryId = `temporal-${update.id}`;
    entries.push({
      id: entryId,
      category: categoryForTemporalSubject(update.subjectType),
      title: update.title,
      body: update.body,
      source: "temporal",
      trainingItemId: update.trainingItemId,
      updatedAt: update.updatedAt,
      temporal: {
        updateId: update.id,
        durationMode: update.durationMode,
        effectiveAt: update.effectiveAt,
        expiresAt: update.expiresAt,
        timezone,
        overridePreview: update.overridePreview,
        replacesEntryId: update.subjectRef,
      },
    });

    if (update.subjectRef) {
      const targetIndex = entries.findIndex((entry) => entry.id === update.subjectRef);
      if (targetIndex >= 0) {
        entries[targetIndex] = {
          ...entries[targetIndex],
          activeTemporalSummary: update.body,
          linkedTemporalUpdateId: update.id,
        };
      }
    }
  }

  return { ...index, entries };
}

function dedupeKnowledgeEntries(entries: CaraKnowledgeEntry[]): CaraKnowledgeEntry[] {
  const byId = new Map<string, CaraKnowledgeEntry>();
  for (const entry of entries) {
    const existing = byId.get(entry.id);
    if (!existing) {
      byId.set(entry.id, entry);
      continue;
    }
    const existingTime = existing.updatedAt
      ? new Date(existing.updatedAt).getTime()
      : 0;
    const entryTime = entry.updatedAt ? new Date(entry.updatedAt).getTime() : 0;
    if (entryTime >= existingTime) {
      byId.set(entry.id, entry);
    }
  }
  return [...byId.values()];
}

export function searchCaraKnowledge(
  index: CaraKnowledgeIndex,
  query: string,
): CaraKnowledgeSearchResult {
  const trimmed = query.trim();
  if (!trimmed) {
    return { knows: [], related: [], gaps: [] };
  }

  const scored = index.entries
    .map((entry) => ({ entry, score: scoreMatch(trimmed, entry) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));

  const knows = scored.filter((row) => row.score >= 80).map((row) => row.entry);
  const related = scored.filter((row) => row.score >= 40 && row.score < 80).map((row) => row.entry);

  const topicKey = normalizeTrainingTopic(trimmed);
  const gaps = index.openGaps.filter((gap) => {
    const haystack = normalizeTrainingTopic(
      `${gap.gap_summary} ${gap.cara_question}`,
    );
    return haystack.includes(topicKey) || topicKey.includes(haystack.slice(0, 12));
  });

  return { knows, related, gaps };
}

export function entriesForCategory(
  index: CaraKnowledgeIndex,
  category: CaraKnowledgeCategoryId,
): CaraKnowledgeEntry[] {
  return index.entries.filter((entry) => entry.category === category);
}

export function sortKnowledgeEntries(
  entries: CaraKnowledgeEntry[],
): CaraKnowledgeEntry[] {
  return [...entries].sort((a, b) => {
    const temporalDiff = browseTemporalRank(b) - browseTemporalRank(a);
    if (temporalDiff !== 0) return temporalDiff;

    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;
    return a.title.localeCompare(b.title);
  });
}

export function categoryLabel(category: CaraKnowledgeCategoryId): string {
  return (
    CARA_KNOWLEDGE_CATEGORIES.find((row) => row.id === category)?.label ?? category
  );
}

export function categoryCounts(
  index: CaraKnowledgeIndex,
): Record<CaraKnowledgeCategoryId, number> {
  const counts = Object.fromEntries(
    CARA_KNOWLEDGE_CATEGORIES.map((row) => [row.id, 0]),
  ) as Record<CaraKnowledgeCategoryId, number>;
  for (const entry of index.entries) {
    counts[entry.category] += 1;
  }
  return counts;
}
