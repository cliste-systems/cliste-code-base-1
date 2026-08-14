"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  BookOpen,
  Bot,
  Check,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import {
  DetailActionButton,
  DetailInset,
  DetailPanelBody,
  DetailPanelFooter,
  DetailPanelShell,
  DetailSection,
  ListDetailLayout,
} from "@/components/dashboard/list-detail";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_ICON_CHIP_LG,
  DASHBOARD_ICON_CHIP_SM,
  DASHBOARD_ICON_GLYPH_LG,
  DASHBOARD_ICON_GLYPH_SM,
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

import {
  answerTrainingItem,
  confirmTrainingDraft,
  dismissTrainingDraft,
  editTrainingAnswer,
  resolveCallGapNoAction,
  resolveCallGapYesAction,
  revertAppliedTraining,
  startOwnerInitiatedTraining,
} from "./actions";
import { CaraTrainingPatchPreview } from "./cara-training-patch-preview";
import {
  CARA_TRAINING_SECTION_LABELS,
  CARA_TRAINING_SOURCE_LABELS,
  formatTrainingDateTime,
  isOpenTrainingStatus,
  lastOwnerAnswer,
  patchPreviewLines,
  trainingContextSummary,
  trainingDetailMeta,
  trainingStatusLabel,
  trainingStatusVariant,
  trainingTopicLabel,
  type CaraTrainingListItem,
} from "./cara-training-helpers";

type CaraTrainingViewProps = {
  items: CaraTrainingListItem[];
  canManage: boolean;
  initialSelectedItemId?: string | null;
  className?: string;
};

type ListTab = "open" | "learned";

function nextSelectionId(
  tabItems: CaraTrainingListItem[],
  currentId: string,
): string | null {
  const remaining = tabItems.filter((item) => item.id !== currentId);
  if (remaining.length === 0) return null;
  const index = tabItems.findIndex((item) => item.id === currentId);
  return remaining[Math.min(Math.max(index, 0), remaining.length - 1)]?.id ?? null;
}

export function CaraTrainingView({
  items,
  canManage,
  initialSelectedItemId = null,
  className,
}: CaraTrainingViewProps) {
  const router = useRouter();
  const [listTab, setListTab] = useState<ListTab>(() => {
    if (
      initialSelectedItemId &&
      items.some(
        (item) =>
          item.id === initialSelectedItemId && item.status === "applied",
      )
    ) {
      return "learned";
    }
    return items.some((item) => isOpenTrainingStatus(item.status))
      ? "open"
      : "learned";
  });
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedItemId,
  );
  const [answerText, setAnswerText] = useState("");
  const [teachText, setTeachText] = useState("");
  const [teachOpen, setTeachOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openItems = useMemo(
    () => items.filter((item) => isOpenTrainingStatus(item.status)),
    [items],
  );
  const appliedItems = useMemo(
    () => items.filter((item) => item.status === "applied"),
    [items],
  );

  const tabItems = listTab === "open" ? openItems : appliedItems;
  const isOpenQueue = listTab === "open";

  const resolvedSelectedId = useMemo(() => {
    if (selectedId && tabItems.some((item) => item.id === selectedId)) {
      return selectedId;
    }
    return tabItems[0]?.id ?? null;
  }, [selectedId, tabItems]);

  const selected = useMemo(
    () => items.find((item) => item.id === resolvedSelectedId) ?? null,
    [items, resolvedSelectedId],
  );

  const refreshAfterAction = useCallback(() => {
    router.refresh();
  }, [router]);

  const runAction = useCallback(
    (fn: () => Promise<{ ok: boolean; message?: string }>) => {
      setError(null);
      startTransition(async () => {
        const res = await fn();
        if (!res.ok) {
          setError(res.message ?? "Something went wrong.");
          return;
        }
        setAnswerText("");
        refreshAfterAction();
      });
    },
    [refreshAfterAction],
  );

  const handleAnswer = () => {
    if (!selected || !canManage) return;
    runAction(() => answerTrainingItem(selected.id, answerText));
  };

  const handleConfirm = () => {
    if (!selected || !canManage) return;
    const itemId = selected.id;
    setError(null);
    startTransition(async () => {
      const res = await confirmTrainingDraft(itemId);
      if (!res.ok) {
        setError(res.message ?? "Something went wrong.");
        return;
      }
      setAnswerText("");
      setListTab("learned");
      setSelectedId(itemId);
      refreshAfterAction();
    });
  };

  const handleDismiss = () => {
    if (!selected || !canManage) return;
    const itemId = selected.id;
    const nextId = nextSelectionId(tabItems, itemId);
    setError(null);
    startTransition(async () => {
      const res = await dismissTrainingDraft(itemId);
      if (!res.ok) {
        setError(res.message ?? "Something went wrong.");
        return;
      }
      setAnswerText("");
      setSelectedId(nextId);
      refreshAfterAction();
    });
  };

  const handleGapYes = () => {
    if (!selected || !canManage) return;
    const itemId = selected.id;
    setError(null);
    startTransition(async () => {
      const res = await resolveCallGapYesAction(itemId);
      if (!res.ok) {
        setError(res.message ?? "Something went wrong.");
        return;
      }
      setListTab("learned");
      setSelectedId(itemId);
      refreshAfterAction();
    });
  };

  const handleGapNo = () => {
    if (!selected || !canManage) return;
    const itemId = selected.id;
    setError(null);
    startTransition(async () => {
      const res = await resolveCallGapNoAction(itemId);
      if (!res.ok) {
        setError(res.message ?? "Something went wrong.");
        return;
      }
      setListTab("learned");
      setSelectedId(itemId);
      refreshAfterAction();
    });
  };

  const handleEditAnswer = () => {
    if (!selected || !canManage) return;
    runAction(() => editTrainingAnswer(selected.id));
  };

  const handleRevert = () => {
    if (!selected || !canManage) return;
    const itemId = selected.id;
    const nextId = nextSelectionId(tabItems, itemId);
    setError(null);
    startTransition(async () => {
      const res = await revertAppliedTraining(itemId);
      if (!res.ok) {
        setError(res.message ?? "Something went wrong.");
        return;
      }
      setSelectedId(nextId);
      refreshAfterAction();
    });
  };

  const handleTeach = () => {
    if (!canManage) return;
    setError(null);
    startTransition(async () => {
      const res = await startOwnerInitiatedTraining(teachText);
      if (!res.ok) {
        setError(res.message ?? "Something went wrong.");
        return;
      }
      setTeachOpen(false);
      setTeachText("");
      setListTab("open");
      setSelectedId(res.itemId);
      refreshAfterAction();
    });
  };

  const fieldClass = cn(DASHBOARD_INPUT_CLASS, "resize-none text-[13px]");

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3 overflow-hidden", className)}>
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div
          className="inline-flex w-full max-w-md rounded-lg border border-[#d9e2dd] bg-[#f6faf7] p-0.5"
          role="tablist"
          aria-label="Knowledge gaps"
        >
          {(
            [
              { id: "open" as const, label: "Needs input", count: openItems.length },
              { id: "learned" as const, label: "Learned", count: appliedItems.length },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={listTab === tab.id}
              onClick={() => {
                setListTab(tab.id);
                setSelectedId(null);
              }}
              className={cn(
                "min-w-0 flex-1 rounded-md px-4 py-2 text-[13px] font-medium transition-colors",
                listTab === tab.id
                  ? "bg-[#11181d] text-white shadow-sm"
                  : "text-[#5b6b65] hover:bg-white hover:text-[#11181d]",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "ml-1.5 tabular-nums",
                  listTab === tab.id ? "text-white/80" : "text-slate-400",
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {canManage ? (
          <Button
            type="button"
            className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "h-9 shrink-0 gap-1.5")}
            onClick={() => setTeachOpen(true)}
          >
            <Plus className="size-4" aria-hidden />
            Teach Cara
          </Button>
        ) : null}
      </div>

      <section
        className={cn(
          DASHBOARD_CARD_SURFACE,
          "flex min-h-0 flex-1 flex-col overflow-hidden",
        )}
      >
        <ListDetailLayout
          className="min-h-0 flex-1 gap-0 max-xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.2fr)_400px]"
          list={
            <div
              className={cn(
                "flex h-full min-h-0 flex-col overflow-hidden max-xl:border-b max-xl:border-[#dfe7e2] xl:border-r",
                isOpenQueue
                  ? "border-[#cfd9d4] bg-[#f6faf7] xl:border-r-[#cfd9d4]"
                  : "border-[#dfe7e2] bg-[#fbfcfb]",
              )}
            >
              <div className="shrink-0 border-b border-inherit px-4 py-3 sm:px-5">
                <p className="text-[13px] font-semibold text-[#11181d]">
                  {isOpenQueue ? "Needs input" : "Learned"}
                </p>
              </div>

              <div
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2 sm:px-3",
                  tabItems.length === 0 && "flex items-center justify-center",
                )}
              >
                {tabItems.length === 0 ? (
                  <EmptyState
                    icon={isOpenQueue ? Sparkles : BookOpen}
                    title={isOpenQueue ? "All caught up" : "Nothing learned yet"}
                    description={
                      isOpenQueue
                        ? "When Cara hits a gap on a call, she'll ask you here."
                        : "Confirmed answers will appear here with where they came from."
                    }
                    className="w-full py-10"
                  />
                ) : (
                  <ul className="space-y-2" role="listbox" aria-label="Training items">
                    {tabItems.map((item) => (
                      <TrainingListRow
                        key={item.id}
                        item={item}
                        selected={item.id === resolvedSelectedId}
                        onSelect={() => setSelectedId(item.id)}
                        tinted={isOpenQueue}
                        showOpenStatus={isOpenQueue}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          }
          detail={
            <TrainingDetailPanel
              item={selected}
              canManage={canManage}
              error={error}
              answerText={answerText}
              pending={pending}
              onAnswerTextChange={setAnswerText}
              onAnswer={handleAnswer}
              onConfirm={handleConfirm}
              onDismiss={handleDismiss}
              onGapYes={handleGapYes}
              onGapNo={handleGapNo}
              onEditAnswer={handleEditAnswer}
              onRevert={handleRevert}
            />
          }
        />
      </section>

      <Dialog open={teachOpen} onOpenChange={setTeachOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Teach Cara something</DialogTitle>
            <DialogDescription>
              Describe what callers keep asking — Cara will turn it into a draft
              you can confirm.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={teachText}
            onChange={(event) => setTeachText(event.target.value)}
            placeholder="e.g. Callers keep asking if we do emergency callouts on Sundays…"
            rows={4}
            className={fieldClass}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className={DASHBOARD_SECONDARY_BUTTON_CLASS}
              disabled={pending}
              onClick={() => setTeachOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={DASHBOARD_PRIMARY_BUTTON_CLASS}
              disabled={pending || !teachText.trim()}
              onClick={handleTeach}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                "Start"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TrainingListRow({
  item,
  selected,
  onSelect,
  tinted,
  showOpenStatus,
}: {
  item: CaraTrainingListItem;
  selected: boolean;
  onSelect: () => void;
  tinted: boolean;
  showOpenStatus: boolean;
}) {
  const Icon = showOpenStatus ? Bot : BookOpen;

  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className={cn(
          "flex w-full items-start gap-3 rounded-lg border bg-white/78 px-2.5 py-2.5 text-left shadow-[0_1px_0_rgba(17,24,29,0.04)] transition-colors",
          tinted
            ? "border-[#cfd9d4] hover:border-[#9da9a4] hover:bg-white"
            : "border-[#dfe7e2] hover:border-[#9da9a4] hover:bg-white",
          selected &&
            "border-[#353D42] bg-[#f6faf7] shadow-[inset_3px_0_0_#353D42,0_1px_0_rgba(17,24,29,0.04)]",
        )}
      >
        <span className={cn("mt-0.5", DASHBOARD_ICON_CHIP_SM)}>
          <Icon className={DASHBOARD_ICON_GLYPH_SM} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-snug text-[#0b1220]">
            {trainingTopicLabel(item)}
          </span>
          <span className="mt-1 block truncate text-[11px] text-slate-500">
            {CARA_TRAINING_SOURCE_LABELS[item.source]}
            {showOpenStatus
              ? ` · ${
                  item.status === "draft_ready"
                    ? "Ready to confirm"
                    : "Awaiting answer"
                }`
              : item.applied_at
                ? ` · ${formatTrainingDateTime(item.applied_at)}`
                : ""}
          </span>
        </span>
      </button>
    </li>
  );
}

function TrainingAnswerComposer({
  answerText,
  pending,
  onAnswerTextChange,
  onAnswer,
  onDismiss,
}: {
  answerText: string;
  pending: boolean;
  onAnswerTextChange: (value: string) => void;
  onAnswer: () => void;
  onDismiss: () => void;
}) {
  return (
    <DetailSection title="Your answer">
      <div className="overflow-hidden rounded-lg border border-[#d9e2dd] bg-white shadow-[0_1px_0_rgba(17,24,29,0.04)]">
        <Textarea
          value={answerText}
          onChange={(event) => onAnswerTextChange(event.target.value)}
          placeholder="e.g. We offer 10% off for first-time clients on weekdays only."
          rows={4}
          className={cn(
            DASHBOARD_INPUT_CLASS,
            "min-h-[120px] w-full resize-none rounded-none border-0 bg-transparent px-4 py-3.5 text-[14px] leading-relaxed shadow-none focus-visible:border-0 focus-visible:ring-0",
          )}
        />
        <div className="flex flex-col gap-3 border-t border-[#dfe7e2] bg-[#f6faf7] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] leading-snug text-slate-500">
            Plain English is fine — Cara will draft the update for you to confirm.
          </p>
          <div className="flex shrink-0 gap-2">
            <DetailActionButton type="button" onClick={onDismiss} disabled={pending}>
              Dismiss
            </DetailActionButton>
            <Button
              type="button"
              className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "h-9 min-w-[7.5rem]")}
              disabled={pending || !answerText.trim()}
              onClick={onAnswer}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                "Send answer"
              )}
            </Button>
          </div>
        </div>
      </div>
    </DetailSection>
  );
}

function TrainingDetailPanel({
  item,
  canManage,
  error,
  answerText,
  pending,
  onAnswerTextChange,
  onAnswer,
  onConfirm,
  onDismiss,
  onGapYes,
  onGapNo,
  onEditAnswer,
  onRevert,
}: {
  item: CaraTrainingListItem | null;
  canManage: boolean;
  error: string | null;
  answerText: string;
  pending: boolean;
  onAnswerTextChange: (value: string) => void;
  onAnswer: () => void;
  onConfirm: () => void;
  onDismiss: () => void;
  onGapYes: () => void;
  onGapNo: () => void;
  onEditAnswer: () => void;
  onRevert: () => void;
}) {
  if (!item) {
    return (
      <DetailPanelShell surface="embedded">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <EmptyState
            icon={Bot}
            title="Select a training item"
            description="Pick something from the queue or history to review."
            className="w-full py-10"
          />
        </div>
      </DetailPanelShell>
    );
  }

  return (
    <TrainingDetailPanelContent
      key={item.id}
      item={item}
      canManage={canManage}
      error={error}
      answerText={answerText}
      pending={pending}
      onAnswerTextChange={onAnswerTextChange}
      onAnswer={onAnswer}
      onConfirm={onConfirm}
      onDismiss={onDismiss}
      onGapYes={onGapYes}
      onGapNo={onGapNo}
      onEditAnswer={onEditAnswer}
      onRevert={onRevert}
    />
  );
}

function TrainingDetailPanelContent({
  item,
  canManage,
  error,
  answerText,
  pending,
  onAnswerTextChange,
  onAnswer,
  onConfirm,
  onDismiss,
  onGapYes,
  onGapNo,
  onEditAnswer,
  onRevert,
}: {
  item: CaraTrainingListItem;
  canManage: boolean;
  error: string | null;
  answerText: string;
  pending: boolean;
  onAnswerTextChange: (value: string) => void;
  onAnswer: () => void;
  onConfirm: () => void;
  onDismiss: () => void;
  onGapYes: () => void;
  onGapNo: () => void;
  onEditAnswer: () => void;
  onRevert: () => void;
}) {
  const previewPatch = item.proposed_patch ?? item.applied_patch;
  const isCallGapQuickResolve =
    item.source === "call_gap" && item.status === "awaiting_answer";
  const isApplied = item.status === "applied";
  const isDraft = item.status === "draft_ready";
  const ownerAnswer = lastOwnerAnswer(item);
  const contextSummary = trainingContextSummary(item);
  const HeaderIcon = isApplied ? BookOpen : Bot;
  const hasLinks = Boolean(item.call_log_id || item.action_ticket_id);

  return (
    <DetailPanelShell surface="embedded">
      <div className="shrink-0 border-b border-[#cfd9d4] bg-[#f6faf7] px-5 py-5">
        <div className="flex items-start gap-3">
          <span className={DASHBOARD_ICON_CHIP_LG}>
            <HeaderIcon className={DASHBOARD_ICON_GLYPH_LG} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill variant={trainingStatusVariant(item.status)} dot>
                {trainingStatusLabel(item.status)}
              </StatusPill>
              {item.target_section ? (
                <span className="text-[11px] font-medium text-slate-500">
                  {CARA_TRAINING_SECTION_LABELS[item.target_section]}
                </span>
              ) : null}
            </div>
            <h2 className="mt-2.5 text-[18px] font-semibold leading-snug tracking-tight text-[#0b1220]">
              {trainingTopicLabel(item)}
            </h2>
            <p className="mt-1 text-[12px] text-slate-500">
              {trainingDetailMeta(item)}
            </p>
            {hasLinks ? (
              <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
                {item.call_log_id ? (
                  <Link
                    href={`${DASHBOARD_ROUTES.calls}?call=${encodeURIComponent(item.call_log_id)}`}
                    className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
                  >
                    View call
                  </Link>
                ) : null}
                {item.action_ticket_id ? (
                  <Link
                    href={`${DASHBOARD_ROUTES.actionInbox}?ticket=${encodeURIComponent(item.action_ticket_id)}`}
                    className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
                  >
                    View in Action Inbox
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <DetailPanelBody className="space-y-4">
        {contextSummary ? (
          <DetailSection title="Context">
            <p className="text-[14px] leading-relaxed text-slate-700">
              {contextSummary}
            </p>
            {item.occurrence_count > 1 ? (
              <p className="mt-2 text-[12px] text-slate-500">
                Came up {item.occurrence_count} times on recent calls.
              </p>
            ) : null}
          </DetailSection>
        ) : item.occurrence_count > 1 ? (
          <p className="text-[12px] text-slate-500">
            Came up {item.occurrence_count} times on recent calls.
          </p>
        ) : null}

        {isApplied && previewPatch ? (
          <CaraTrainingPatchPreview
            lines={patchPreviewLines(previewPatch)}
            applied
          />
        ) : null}

        {!isApplied && item.status === "awaiting_answer" ? (
          <DetailSection title={isCallGapQuickResolve ? "Quick answer" : "Cara asks"}>
            {isCallGapQuickResolve ? (
              <p className="text-[14px] leading-relaxed text-slate-700">
                Do you offer <strong className="text-[#0b1220]">{item.gap_summary}</strong>?
              </p>
            ) : (
              <DetailInset>
                <p className="text-[14px] leading-relaxed text-[#0b1220]">
                  {item.cara_question}
                </p>
              </DetailInset>
            )}
          </DetailSection>
        ) : null}

        {item.status === "awaiting_answer" && canManage && !isCallGapQuickResolve ? (
          <TrainingAnswerComposer
            answerText={answerText}
            pending={pending}
            onAnswerTextChange={onAnswerTextChange}
            onAnswer={onAnswer}
            onDismiss={onDismiss}
          />
        ) : null}

        {isDraft && ownerAnswer ? (
          <DetailSection title="You said">
            <DetailInset>
              <p className="text-[14px] leading-relaxed text-[#0b1220]">
                {ownerAnswer}
              </p>
            </DetailInset>
          </DetailSection>
        ) : null}

        {!isApplied && previewPatch ? (
          <CaraTrainingPatchPreview
            lines={patchPreviewLines(previewPatch)}
            applied={false}
          />
        ) : null}

        {error ? (
          <p className="text-[13px] text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        {!canManage ? (
          <p className="text-[12px] text-slate-500">
            View only — ask an owner to answer or confirm training items.
          </p>
        ) : null}
      </DetailPanelBody>

      {item.status === "awaiting_answer" && canManage && isCallGapQuickResolve ? (
        <DetailPanelFooter>
          <Button
            type="button"
            className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "h-9")}
            disabled={pending}
            onClick={onGapYes}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              "Yes, we offer this"
            )}
          </Button>
          <DetailActionButton type="button" onClick={onGapNo} disabled={pending}>
            No, we don&apos;t
          </DetailActionButton>
          <DetailActionButton type="button" onClick={onDismiss} disabled={pending}>
            Dismiss
          </DetailActionButton>
        </DetailPanelFooter>
      ) : null}

      {isDraft && canManage ? (
        <DetailPanelFooter>
          <Button
            type="button"
            className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "h-9 gap-1.5")}
            disabled={pending}
            onClick={onConfirm}
          >
            <Check className="size-4" aria-hidden />
            Confirm
          </Button>
          <DetailActionButton type="button" onClick={onEditAnswer} disabled={pending}>
            Edit answer
          </DetailActionButton>
          <DetailActionButton type="button" onClick={onDismiss} disabled={pending}>
            <X className="size-3.5" aria-hidden />
            Dismiss
          </DetailActionButton>
        </DetailPanelFooter>
      ) : null}

      {isApplied && canManage ? (
        <DetailPanelFooter>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-slate-500">
              Revert removes this from Cara&apos;s setup.
            </p>
            <DetailActionButton type="button" onClick={onRevert} disabled={pending}>
              <RotateCcw className="size-3.5" aria-hidden />
              Revert
            </DetailActionButton>
          </div>
        </DetailPanelFooter>
      ) : null}
    </DetailPanelShell>
  );
}
