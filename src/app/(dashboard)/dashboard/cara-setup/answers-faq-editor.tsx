"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { detectCanonicalQuestion } from "@/lib/answers-boundary";
import type { RoutingActionSummary } from "@/lib/cara-custom-prompt";
import type { ServiceCatalogItem } from "@/lib/service-catalog-format";

import type { AgentFaq } from "../agent-setup/agent-faqs";
import { CanonicalQuestionBlocked } from "./canonical-question-blocked";

type Props = {
  faqs: AgentFaq[];
  maxFaqs: number;
  entries: { faq: AgentFaq; index: number }[];
  total: number;
  routes?: RoutingActionSummary[];
  transferNumber?: string;
  openingHours?: string;
  businessRules?: string[];
  serviceCatalog?: ServiceCatalogItem[];
  onUpdate: (index: number, patch: Partial<AgentFaq>) => void;
  onRemove: (index: number) => void;
};

export function AnswersFaqEditor({
  faqs,
  maxFaqs,
  entries,
  total,
  onUpdate,
  onRemove,
}: Props) {
  const [canonicalPrompt, setCanonicalPrompt] = useState<{
    index: number;
    question: string;
    match: NonNullable<ReturnType<typeof detectCanonicalQuestion>>;
  } | null>(null);

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
      <div className="space-y-3">
        <p className="text-[12px] text-slate-500">
          {total} of {maxFaqs} questions
          {entries.length < total ? ` · showing ${entries.length} matches` : ""}
        </p>
        <ul className="space-y-3" role="list" aria-label="Common questions">
          {entries.map(({ faq, index }) => {
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
