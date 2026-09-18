import type { CaraKnowledgeHistoryItem } from "@/lib/cara-knowledge-history-build";

const CATEGORY_LABELS: Record<string, string> = {
  services: "Services",
  policies: "Policies & rules",
  prices: "Pricing",
  facts: "Store facts",
  answers: "Common questions",
  "not-offered": "Not offered",
  opening_hours: "Opening hours",
  notice: "Store notice",
  closure: "Closure",
  hours: "Opening hours",
};

function humanizeToken(value: string): string {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatHistoryCategoryLabel(
  category: string | null | undefined,
  title?: string,
): string | null {
  if (!category?.trim()) return null;
  const key = category.trim().toLowerCase();
  const text = `${title ?? ""}`.toLowerCase();

  if (key === "policies") {
    if (/\b(staff|employees?|team)\b/.test(text)) return "Store facts";
    if (/\b(open|close|hour|holiday)\b/.test(text)) return "Opening hours";
    return CATEGORY_LABELS.policies ?? "Policies & rules";
  }

  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key]!;

  return humanizeToken(key);
}

export function formatHistoryActionLabel(
  kind: CaraKnowledgeHistoryItem["kind"],
  source: string,
): string {
  const normalizedSource = source.trim().toLowerCase();

  if (kind === "learned") {
    if (normalizedSource === "owner_initiated") return "You taught Cara";
    if (normalizedSource === "call_gap" || normalizedSource === "action_inbox") {
      return "Learned from a call";
    }
    return "Learned";
  }

  if (kind === "edited") {
    if (normalizedSource === "business_setup") return "Updated in profile";
    if (normalizedSource === "entry_reclassify") return "Knowledge updated";
    return "Updated";
  }

  if (kind === "unlearned") return "Removed";
  if (kind === "dismissed") return "Dismissed";
  if (kind === "reverted") return "Reverted";
  if (kind === "temporal_started") return "Temporary update";
  if (kind === "temporal_ended") return "Temporary update ended";
  if (kind === "temporal_expired") return "Temporary update expired";
  if (kind === "temporal_cancelled") return "Temporary update cancelled";

  return humanizeToken(kind);
}

export function formatHistorySourceHint(source: string): string | null {
  const normalizedSource = source.trim().toLowerCase();
  if (
    normalizedSource === "owner_initiated" ||
    normalizedSource === "call_gap" ||
    normalizedSource === "action_inbox" ||
    normalizedSource === "training_apply" ||
    normalizedSource === "auto_classify" ||
    normalizedSource === "entry_reclassify"
  ) {
    return null;
  }
  if (normalizedSource === "business_setup") return "Business profile";
  if (normalizedSource === "unlearn") return "Unlearn";
  return humanizeToken(normalizedSource);
}

export function historyActionTone(
  kind: CaraKnowledgeHistoryItem["kind"],
  source: string,
): string {
  if (kind === "learned" && source === "owner_initiated") {
    return "bg-[#eef6f1] text-[#1f4d3a] border-[#cfe3d7]";
  }
  if (kind === "learned") {
    return "bg-emerald-50 text-emerald-900 border-emerald-100";
  }
  if (kind === "edited") {
    return "bg-sky-50 text-sky-900 border-sky-100";
  }
  if (kind === "unlearned") {
    return "bg-red-50 text-red-900 border-red-100";
  }
  if (kind.startsWith("temporal_")) {
    return "bg-[#f5f7f9] text-[#35443f] border-[#d6dfe8]";
  }
  return "bg-slate-50 text-slate-700 border-slate-200";
}

export function enrichHistoryItem(
  item: Omit<CaraKnowledgeHistoryItem, "actionLabel" | "categoryLabel" | "sourceHint"> &
    Partial<Pick<CaraKnowledgeHistoryItem, "actionLabel" | "categoryLabel" | "sourceHint">>,
): CaraKnowledgeHistoryItem {
  const categoryLabel =
    item.categoryLabel ??
    formatHistoryCategoryLabel(item.subtitle ?? item.category ?? null, item.title);
  const actionLabel =
    item.actionLabel ?? formatHistoryActionLabel(item.kind, item.source);
  const sourceHint =
    item.sourceHint === undefined
      ? formatHistorySourceHint(item.source)
      : item.sourceHint;

  return {
    ...item,
    actionLabel,
    categoryLabel,
    sourceHint,
    subtitle: shouldShowHistorySubtitle(item.title, item.subtitle)
      ? item.subtitle
      : undefined,
  };
}

function shouldShowHistorySubtitle(
  title: string,
  subtitle: string | null | undefined,
): subtitle is string {
  if (!subtitle?.trim()) return false;
  const normalizedTitle = title.trim().toLowerCase();
  const normalizedSubtitle = subtitle.trim().toLowerCase();
  if (normalizedTitle === normalizedSubtitle) return false;
  if (CATEGORY_LABELS[normalizedSubtitle] || normalizedSubtitle.includes("_")) {
    return false;
  }
  return true;
}

export function inferPatchHistoryCategory(
  patch: { kind: string; rule?: string; question?: string; answer?: string; label?: string },
): string {
  if (patch.kind === "faq") return "answers";
  if (patch.kind === "service_offered") return "services";
  if (patch.kind === "service_not_offered") return "not-offered";

  const text = String(patch.rule ?? "").toLowerCase();
  if (/\b(staff|employees?|team size|people work)\b/.test(text)) return "facts";
  if (/\b(open|close|hour|holiday|location|address|parking|toilet|atm|eircode)\b/.test(text)) {
    return "facts";
  }
  if (/\b(price|cost|fee|charge|€|\$|quote)\b/.test(text)) return "prices";
  return "policies";
}
