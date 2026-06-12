"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  BookOpen,
  Bot,
  Check,
  GraduationCap,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import { dashboardQuickEnterVariants } from "@/components/dashboard/dashboard-motion";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  DetailInset,
  DetailPanelBody,
  DetailPanelFooter,
  DetailPanelHeader,
  DetailPanelShell,
  DetailSection,
  ListDetailLayout,
} from "@/components/dashboard/list-detail";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_HOME_ATTENTION_ROW_HOVER,
  DASHBOARD_ICON_CHIP_SM,
  DASHBOARD_ICON_GLYPH_SM,
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { onboardingPageVariants } from "@/components/onboarding/onboarding-motion";
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
  revertAppliedTraining,
  startOwnerInitiatedTraining,
} from "./actions";
import { CaraTrainingPatchPreview } from "./cara-training-patch-preview";
import {
  CARA_TRAINING_SECTION_LABELS,
  CARA_TRAINING_SOURCE_LABELS,
  formatTrainingDateTime,
  isOpenTrainingStatus,
  patchPreviewLines,
  trainingContextLine,
  type CaraTrainingListItem,
} from "./cara-training-helpers";

type CaraTrainingViewProps = {
  items: CaraTrainingListItem[];
  canManage: boolean;
  initialSelectedItemId?: string | null;
};

type ListTab = "open" | "learned";

export function CaraTrainingView({
  items,
  canManage,
  initialSelectedItemId = null,
}: CaraTrainingViewProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
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

  const effectiveListTab = useMemo((): ListTab => {
    if (!selectedId) return listTab;
    const item = items.find((entry) => entry.id === selectedId);
    if (item?.status === "applied" && listTab === "open") return "learned";
    return listTab;
  }, [items, listTab, selectedId]);

  const tabItems = effectiveListTab === "open" ? openItems : appliedItems;

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

  const previewPatch = selected?.proposed_patch ?? selected?.applied_patch;

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
      });
    },
    [],
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
      router.refresh();
    });
  };

  const handleDismiss = () => {
    if (!selected || !canManage) return;
    runAction(() => dismissTrainingDraft(selected.id));
  };

  const handleEditAnswer = () => {
    if (!selected || !canManage) return;
    runAction(() => editTrainingAnswer(selected.id));
  };

  const handleRevert = () => {
    if (!selected || !canManage) return;
    setError(null);
    startTransition(async () => {
      const res = await revertAppliedTraining(selected.id);
      if (!res.ok) {
        setError(res.message ?? "Something went wrong.");
        return;
      }
      setSelectedId(null);
      router.refresh();
    });
  };

  const handleTeach = () => {
    if (!canManage) return;
    runAction(async () => {
      const res = await startOwnerInitiatedTraining(teachText);
      if (res.ok) {
        setTeachOpen(false);
        setTeachText("");
        setListTab("open");
        setSelectedId(res.itemId);
      }
      return res;
    });
  };

  const fieldClass = cn(DASHBOARD_INPUT_CLASS, "resize-none text-[13px]");

  return (
    <div
      className={cn(
        DASHBOARD_PAGE_SHELL_FILL_WHITE,
        "flex min-h-0 flex-1 flex-col overflow-hidden",
      )}
      data-dashboard-fill
    >
      <DashboardAnimatedPageSections className="min-h-0 flex-1 gap-3 overflow-hidden">
        <DashboardPageHeader
          eyebrow="Cara"
          title="Cara Training"
          icon={GraduationCap}
          description="Answer gaps from calls in plain English — preview what Cara adds, then confirm."
          summary={[
            { value: String(openItems.length), label: "needs input" },
            {
              value: String(appliedItems.length),
              label: appliedItems.length === 1 ? "learned" : "learned",
            },
          ]}
          actions={
            canManage ? (
              <Button
                type="button"
                className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "gap-1.5")}
                onClick={() => setTeachOpen(true)}
              >
                <Plus className="size-4" aria-hidden />
                Teach Cara
              </Button>
            ) : null
          }
        />

        <section
          className={cn(
            DASHBOARD_CARD_SURFACE,
            "flex min-h-0 flex-1 flex-col overflow-hidden",
          )}
        >
          <ListDetailLayout
            className="min-h-0 flex-1 gap-0 max-xl:grid-rows-[minmax(0,38vh)_minmax(0,1fr)] xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]"
            list={
              <div className="flex h-full min-h-0 flex-col overflow-hidden border-slate-100 max-xl:border-b xl:border-r">
                <div
                  className="inline-flex shrink-0 border-b border-slate-100 p-2"
                  role="tablist"
                  aria-label="Training queue"
                >
                  {(
                    [
                      { id: "open" as const, label: "Needs input", count: openItems.length },
                      {
                        id: "learned" as const,
                        label: "Learned",
                        count: appliedItems.length,
                      },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={effectiveListTab === tab.id}
                      onClick={() => setListTab(tab.id)}
                      className={cn(
                        "min-w-0 flex-1 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors",
                        effectiveListTab === tab.id
                          ? "bg-[#0b1220] text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-50 hover:text-[#0b1220]",
                      )}
                    >
                      {tab.label}
                      <span
                        className={cn(
                          "ml-1.5 tabular-nums",
                          effectiveListTab === tab.id ? "text-white/75" : "text-slate-400",
                        )}
                      >
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
                  {tabItems.length === 0 ? (
                    <EmptyState
                      icon={effectiveListTab === "open" ? Sparkles : BookOpen}
                      title={
                        effectiveListTab === "open" ? "All caught up" : "Nothing learned yet"
                      }
                      description={
                        effectiveListTab === "open"
                          ? "When Cara hits a gap on a call, she'll ask you here."
                          : "Confirmed training will appear here with where it came from."
                      }
                      className="py-10"
                    />
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      <AnimatePresence initial={false}>
                        {tabItems.map((item) => {
                          const active = item.id === resolvedSelectedId;
                          const row = (
                            <button
                              type="button"
                              onClick={() => setSelectedId(item.id)}
                              className={cn(
                                "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors",
                                DASHBOARD_HOME_ATTENTION_ROW_HOVER,
                                active && "bg-slate-50",
                              )}
                            >
                              <span className={DASHBOARD_ICON_CHIP_SM}>
                                {listTab === "open" ? (
                                  <Bot
                                    className={DASHBOARD_ICON_GLYPH_SM}
                                    aria-hidden
                                  />
                                ) : (
                                  <BookOpen
                                    className={DASHBOARD_ICON_GLYPH_SM}
                                    aria-hidden
                                  />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[13px] font-medium text-[#0b1220] line-clamp-2">
                                  {item.gap_summary}
                                </span>
                                <span className="mt-0.5 block text-[11px] text-slate-500">
                                  {CARA_TRAINING_SOURCE_LABELS[item.source]}
                                  {listTab === "open"
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
                          );

                          if (reduceMotion) {
                            return <li key={item.id}>{row}</li>;
                          }

                          return (
                            <motion.li
                              key={item.id}
                              variants={dashboardQuickEnterVariants}
                              initial="hidden"
                              animate="show"
                            >
                              {row}
                            </motion.li>
                          );
                        })}
                      </AnimatePresence>
                    </ul>
                  )}
                </div>
              </div>
            }
            detail={
              <AnimatePresence mode="wait">
                {selected ? (
                  <motion.div
                    key={selected.id}
                    className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
                    variants={reduceMotion ? undefined : onboardingPageVariants}
                    initial={reduceMotion ? false : "initial"}
                    animate={reduceMotion ? undefined : "animate"}
                    exit={reduceMotion ? undefined : "exit"}
                  >
                    <DetailPanelShell surface="embedded">
                      <DetailPanelHeader
                        eyebrow="Training item"
                        title={selected.gap_summary}
                        meta={formatTrainingDateTime(selected.created_at)}
                        badges={
                          <>
                            <StatusPill variant="neutral">
                              {CARA_TRAINING_SOURCE_LABELS[selected.source]}
                            </StatusPill>
                            {selected.target_section ? (
                              <StatusPill variant="info">
                                {
                                  CARA_TRAINING_SECTION_LABELS[
                                    selected.target_section
                                  ]
                                }
                              </StatusPill>
                            ) : null}
                          </>
                        }
                      />

                      <DetailPanelBody className="space-y-5">
                        <DetailSection title="Context">
                          <p className="text-[14px] leading-relaxed text-[#0b1220]">
                            {trainingContextLine(selected)}
                          </p>
                          {selected.caller_context ? (
                            <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                              {selected.caller_context}
                            </p>
                          ) : null}
                        </DetailSection>

                        <DetailSection title="Cara asks">
                          <DetailInset>
                            <p className="text-[14px] leading-relaxed text-[#0b1220]">
                              {selected.cara_question}
                            </p>
                          </DetailInset>
                        </DetailSection>

                        {selected.owner_messages.length > 0 ? (
                          <DetailSection title="Your answer">
                            <p className="text-[14px] leading-relaxed text-[#0b1220]">
                              {
                                selected.owner_messages
                                  .filter((message) => message.role === "user")
                                  .at(-1)?.content
                              }
                            </p>
                          </DetailSection>
                        ) : null}

                        {previewPatch ? (
                          <CaraTrainingPatchPreview
                            key={`${selected.id}-${selected.status}`}
                            lines={patchPreviewLines(previewPatch)}
                            applied={selected.status === "applied"}
                          />
                        ) : null}

                        <div className="flex flex-wrap gap-3 text-[12px]">
                          {selected.call_log_id ? (
                            <Link
                              href={`${DASHBOARD_ROUTES.calls}?call=${encodeURIComponent(selected.call_log_id)}`}
                              className="text-slate-600 underline-offset-2 hover:underline"
                            >
                              View call
                            </Link>
                          ) : null}
                          {selected.action_ticket_id ? (
                            <Link
                              href={`${DASHBOARD_ROUTES.actionInbox}?ticket=${encodeURIComponent(selected.action_ticket_id)}`}
                              className="text-slate-600 underline-offset-2 hover:underline"
                            >
                              View Action Inbox item
                            </Link>
                          ) : null}
                        </div>

                        {error ? (
                          <p className="text-[13px] text-red-600" role="alert">
                            {error}
                          </p>
                        ) : null}

                        {!canManage ? (
                          <p className="text-[12px] text-slate-500">
                            View only — ask an owner to answer or confirm training
                            items.
                          </p>
                        ) : null}
                      </DetailPanelBody>

                      {selected.status === "awaiting_answer" && canManage ? (
                        <DetailPanelFooter>
                          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
                            <Textarea
                              value={answerText}
                              onChange={(event) =>
                                setAnswerText(event.target.value)
                              }
                              placeholder="Reply in plain English — Cara will draft the update."
                              rows={3}
                              className={cn(fieldClass, "min-h-[88px] flex-1")}
                            />
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <Button
                                type="button"
                                className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "h-9")}
                                disabled={pending || !answerText.trim()}
                                onClick={handleAnswer}
                              >
                                {pending ? (
                                  <Loader2
                                    className="size-4 animate-spin"
                                    aria-hidden
                                  />
                                ) : (
                                  "Send answer"
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  DASHBOARD_SECONDARY_BUTTON_CLASS,
                                  "h-9",
                                )}
                                disabled={pending}
                                onClick={handleDismiss}
                              >
                                Dismiss
                              </Button>
                            </div>
                          </div>
                        </DetailPanelFooter>
                      ) : null}

                      {selected.status === "draft_ready" && canManage ? (
                        <DetailPanelFooter>
                          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-[12px] text-slate-500">
                            Confirm to make this live on calls.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              className={cn(
                                DASHBOARD_PRIMARY_BUTTON_CLASS,
                                "h-9 gap-1.5",
                              )}
                              disabled={pending}
                              onClick={handleConfirm}
                            >
                              <Check className="size-4" aria-hidden />
                              Confirm
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(DASHBOARD_SECONDARY_BUTTON_CLASS, "h-9")}
                              disabled={pending}
                              onClick={handleEditAnswer}
                            >
                              Edit answer
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(DASHBOARD_SECONDARY_BUTTON_CLASS, "h-9")}
                              disabled={pending}
                              onClick={handleDismiss}
                            >
                              <X className="size-4" aria-hidden />
                              Dismiss
                            </Button>
                          </div>
                          </div>
                        </DetailPanelFooter>
                      ) : null}

                      {selected.status === "applied" && canManage ? (
                        <DetailPanelFooter>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(DASHBOARD_SECONDARY_BUTTON_CLASS, "h-9 gap-1.5")}
                            disabled={pending}
                            onClick={handleRevert}
                          >
                            <RotateCcw className="size-4" aria-hidden />
                            Revert
                          </Button>
                        </DetailPanelFooter>
                      ) : null}
                    </DetailPanelShell>
                  </motion.div>
                ) : (
                  <motion.div
                    key="training-empty-detail"
                    className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
                    variants={reduceMotion ? undefined : onboardingPageVariants}
                    initial={reduceMotion ? false : "initial"}
                    animate={reduceMotion ? undefined : "animate"}
                    exit={reduceMotion ? undefined : "exit"}
                  >
                    <DetailPanelShell surface="embedded">
                      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-12">
                        <EmptyState
                          icon={Bot}
                          title="Select a training item"
                          description="Pick something from the queue or history to review."
                        />
                      </div>
                    </DetailPanelShell>
                  </motion.div>
                )}
              </AnimatePresence>
            }
          />
        </section>
      </DashboardAnimatedPageSections>

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
