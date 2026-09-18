"use client";

import { Clock, Timer } from "lucide-react";

import type { CaraKnowledgeEntry } from "@/lib/cara-knowledge-index";
import {
  formatTemporalCountdown,
  temporalBadgeLabel,
  type TemporalUpdateRecord,
} from "@/lib/cara-knowledge-temporal";
import { useKnowledgeTemporalTicker } from "@/hooks/use-knowledge-temporal-ticker";
import { cn } from "@/lib/utils";

function recordFromEntry(entry: CaraKnowledgeEntry): TemporalUpdateRecord | null {
  if (!entry.temporal) return null;
  return {
    id: entry.temporal.updateId,
    organizationId: "",
    title: entry.title,
    body: entry.body,
    subjectType: "notice",
    subjectRef: entry.temporal.replacesEntryId,
    subjectScope: {},
    overridePreview: entry.temporal.overridePreview,
    durationMode: entry.temporal.durationMode,
    effectiveAt: entry.temporal.effectiveAt,
    expiresAt: entry.temporal.expiresAt,
    reviewReminderAt: null,
    endedAt: null,
    cancelledAt: null,
    hoursOverrideId: null,
    trainingItemId: entry.trainingItemId ?? null,
    classification: {
      folderId: "general",
      departmentIds: [],
      topicLabels: [],
    },
    createdAt: entry.updatedAt ?? entry.temporal.effectiveAt,
    updatedAt: entry.updatedAt ?? entry.temporal.effectiveAt,
  };
}

export function KnowledgeTemporalStatusLine({
  entry,
  className,
}: {
  entry: CaraKnowledgeEntry;
  className?: string;
}) {
  useKnowledgeTemporalTicker(Boolean(entry.temporal));
  if (!entry.temporal) return null;

  const record = recordFromEntry(entry);
  if (!record) return null;

  const countdown = formatTemporalCountdown(record, entry.temporal.timezone);
  const badge = temporalBadgeLabel(countdown);
  const Icon = countdown.isScheduled ? Clock : Timer;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#4d5f58]">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span>{badge}</span>
        <span aria-hidden>·</span>
        <span>
          {countdown.isScheduled
            ? countdown.primaryLabel.replace(/^Scheduled · /, "")
            : countdown.isOngoing
              ? "Until ended"
              : countdown.primaryLabel.replace(/^Temporary · /, "")}
        </span>
      </span>
      <span className="text-[11px] text-[#6b7c75]">{countdown.exactLabel}</span>
    </div>
  );
}

export function KnowledgeTemporalBadge({
  entry,
}: {
  entry: CaraKnowledgeEntry;
}) {
  useKnowledgeTemporalTicker(Boolean(entry.temporal));
  if (!entry.temporal) return null;
  const record = recordFromEntry(entry);
  if (!record) return null;
  const countdown = formatTemporalCountdown(record, entry.temporal.timezone);
  const badge = temporalBadgeLabel(countdown);
  const Icon = countdown.isScheduled ? Clock : Timer;

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[#cfd9d4] bg-[#f3f6f4] px-2 py-0.5 text-[11px] font-semibold text-[#35443f]">
      <Icon className="size-3.5" aria-hidden />
      {badge}
    </span>
  );
}

export function knowledgeTemporalRowClass(entry: CaraKnowledgeEntry): string {
  if (!entry.temporal) return "";
  return "border border-[#d6dfe8] bg-[#f5f7f9] shadow-[inset_3px_0_0_0_#b8c4cf]";
}

export function KnowledgeTemporalOverridePreview({
  preview,
}: {
  preview: NonNullable<CaraKnowledgeEntry["temporal"]>["overridePreview"];
}) {
  if (!preview) return null;
  return (
    <div className="space-y-2 rounded-lg border border-[#d6dfe8] bg-[#f8fafb] p-3 text-[12px] text-[#35443f]">
      <p className="font-semibold text-[#11181d]">{preview.temporaryLabel}</p>
      {preview.normalBody ? (
        <p>
          <span className="font-medium">{preview.normalLabel}:</span>{" "}
          {preview.normalBody}
        </p>
      ) : null}
      <p>
        <span className="font-medium">{preview.temporaryLabel}:</span>{" "}
        {preview.temporaryBody}
      </p>
      <p>
        <span className="font-medium">Applies:</span> {preview.scopeLabel}
      </p>
      {preview.afterExpiryNote ? (
        <p className="text-[#6b7c75]">{preview.afterExpiryNote}</p>
      ) : null}
    </div>
  );
}

export function KnowledgeActiveTemporalNotice({
  entry,
  onOpenLinked,
}: {
  entry: CaraKnowledgeEntry;
  onOpenLinked?: () => void;
}) {
  if (!entry.activeTemporalSummary || !entry.linkedTemporalUpdateId) return null;
  return (
    <button
      type="button"
      onClick={onOpenLinked}
      className="mt-1 inline-flex cursor-pointer items-center gap-1 text-left text-[11px] font-medium text-[#35443f] underline-offset-2 hover:underline"
    >
      Temporary update active · {entry.activeTemporalSummary}
    </button>
  );
}
