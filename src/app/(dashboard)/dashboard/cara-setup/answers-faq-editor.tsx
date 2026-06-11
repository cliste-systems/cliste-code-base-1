"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  detectCanonicalQuestion,
  lintFaqFields,
  shortenAnswerForSpokenDelivery,
  type FaqFieldWarning,
} from "@/lib/answers-boundary";
import { buildCaraCapabilitiesFromPromptExtras } from "@/lib/call-handling-boundary";
import type { RoutingActionSummary } from "@/lib/cara-custom-prompt";
import { cn } from "@/lib/utils";

import type { AgentFaq } from "../agent-setup/agent-faqs";
import { CanonicalQuestionBlocked } from "./canonical-question-blocked";

type Props = {
  faqs: AgentFaq[];
  maxFaqs: number;
  entries: { faq: AgentFaq; index: number }[];
  total: number;
  routes?: RoutingActionSummary[];
  transferNumber?: string;
  onUpdate: (index: number, patch: Partial<AgentFaq>) => void;
  onRemove: (index: number) => void;
};

export function AnswersFaqEditor({
  faqs,
  maxFaqs,
  entries,
  total,
  routes,
  transferNumber,
  onUpdate,
  onRemove,
}: Props) {
  const [canonicalPrompt, setCanonicalPrompt] = useState<{
    index: number;
    question: string;
    match: NonNullable<ReturnType<typeof detectCanonicalQuestion>>;
  } | null>(null);

  const caps = buildCaraCapabilitiesFromPromptExtras(routes, transferNumber);
  const smsConfigured = caps.sendLink || caps.sendFile;

  const warningsByIndex = useMemo(() => {
    const map = new Map<number, FaqFieldWarning[]>();
    for (let i = 0; i < faqs.length; i++) {
      map.set(
        i,
        lintFaqFields({
          faqs,
          index: i,
          routes,
          transferNumber,
        }),
      );
    }
    return map;
  }, [faqs, routes, transferNumber]);

  function handleQuestionBlur(index: number) {
    const faq = faqs[index];
    if (!faq?.question.trim()) return;
    const match = detectCanonicalQuestion(faq.question);
    if (match) {
      setCanonicalPrompt({ index, question: faq.question.trim(), match });
    }
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <p className="shrink-0 text-[12px] text-slate-500">
          {total} of {maxFaqs} questions
          {entries.length < total ? ` · showing ${entries.length} matches` : ""}
          {total > 3 ? " · scroll the list for more" : ""}
        </p>
        <ul
          className={cn(
            "space-y-3",
            total > 3 &&
              "min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1 [scrollbar-gutter:stable]",
          )}
          role="list"
          aria-label="Common questions"
        >
          {entries.map(({ faq, index }) => {
            const warnings = warningsByIndex.get(index) ?? [];
            const questionId = `faq-question-${index}`;
            const answerId = `faq-answer-${index}`;
            return (
              <li
                key={`faq-${index}`}
                className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm"
                role="listitem"
              >
                <div className="border-b border-slate-100 bg-slate-50/60 px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <label
                        htmlFor={questionId}
                        className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500"
                      >
                        Question
                      </label>
                      <Input
                        id={questionId}
                        value={faq.question}
                        placeholder="What callers ask"
                        onChange={(e) =>
                          onUpdate(index, { question: e.target.value })
                        }
                        onBlur={() => handleQuestionBlur(index)}
                        className="h-9 border-slate-200 bg-white text-[13px] font-medium text-[#0b1220]"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onRemove(index)}
                      aria-label={`Remove question ${index + 1}`}
                      className="mt-5 size-9 shrink-0 text-slate-500 hover:text-slate-800"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5 px-3 py-2.5">
                  <label
                    htmlFor={answerId}
                    className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500"
                  >
                    Answer
                  </label>
                    <Textarea
                      id={answerId}
                      value={faq.answer}
                      rows={2}
                      placeholder="What Cara says out loud"
                      onChange={(e) =>
                        onUpdate(index, { answer: e.target.value })
                      }
                      className="min-h-[3.25rem] resize-none border-slate-200 bg-slate-50/80 py-2 text-[13px] leading-relaxed text-slate-800"
                    />
                  {warnings.length > 0 ? (
                    <div className="space-y-1 pt-0.5">
                      {warnings.map((warning) => (
                        <FaqWarningLine
                          key={warning.id}
                          warning={warning}
                          smsConfigured={smsConfigured}
                          onConvertToText={() =>
                            onUpdate(index, {
                              answer: shortenAnswerForSpokenDelivery(
                                faq.answer,
                              ),
                            })
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <Dialog
        open={canonicalPrompt !== null}
        onOpenChange={(open) => !open && setCanonicalPrompt(null)}
      >
        <DialogContent
          showCloseButton
          overlayClassName="bg-black/30 backdrop-blur-sm"
          className="gap-0 overflow-hidden border border-slate-200 bg-white p-0 sm:max-w-md"
        >
          {canonicalPrompt ? (
            <CanonicalQuestionBlocked
              question={canonicalPrompt.question}
              match={canonicalPrompt.match}
              backLabel="Keep editing"
              onBack={() => setCanonicalPrompt(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FaqWarningLine({
  warning,
  smsConfigured,
  onConvertToText,
}: {
  warning: FaqFieldWarning;
  smsConfigured: boolean;
  onConvertToText: () => void;
}) {
  return (
    <p
      className={cn(
        "text-[12px] leading-relaxed",
        warning.kind === "empty_answer" ? "text-amber-900" : "text-amber-800",
      )}
    >
      {warning.message}{" "}
      {warning.href ? (
        <Link
          href={warning.href}
          className="font-medium underline underline-offset-2"
        >
          {warning.kind === "spoken_url" && !smsConfigured
            ? "Call flow"
            : "Review"}
        </Link>
      ) : null}
      {warning.kind === "spoken_url" && smsConfigured ? (
        <button
          type="button"
          onClick={onConvertToText}
          className="ml-1 font-medium text-[#0b1220] underline underline-offset-2"
        >
          Shorten for speaking
        </button>
      ) : null}
    </p>
  );
}
