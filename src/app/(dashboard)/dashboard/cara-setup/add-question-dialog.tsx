"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";

import { CanonicalQuestionBlocked } from "./canonical-question-blocked";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  detectCanonicalQuestion,
  lintFaqFields,
  shortenAnswerForSpokenDelivery,
} from "@/lib/answers-boundary";
import { buildCaraCapabilitiesFromPromptExtras } from "@/lib/call-handling-boundary";
import type { RoutingActionSummary } from "@/lib/cara-custom-prompt";
import { cn } from "@/lib/utils";

import type { AgentFaq } from "../agent-setup/agent-faqs";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (faq: AgentFaq) => void;
  existingFaqs: AgentFaq[];
  routes?: RoutingActionSummary[];
  transferNumber?: string;
};

export function AddQuestionDialog({
  open,
  onOpenChange,
  onAdd,
  existingFaqs,
  routes,
  transferNumber,
}: Props) {
  const questionId = useId();
  const answerId = useId();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [canonicalStep, setCanonicalStep] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuestion("");
      setAnswer("");
      setCanonicalStep(false);
    }
  }, [open]);

  const caps = buildCaraCapabilitiesFromPromptExtras(routes, transferNumber);
  const smsConfigured = caps.sendLink || caps.sendFile;

  const canonicalMatch = useMemo(() => {
    const q = question.trim();
    if (!q) return null;
    return detectCanonicalQuestion(q);
  }, [question]);

  const draftWarnings = useMemo(() => {
    const q = question.trim();
    if (!q) return [];
    const draftFaqs = [...existingFaqs, { question: q, answer: answer.trim() }];
    return lintFaqFields({
      faqs: draftFaqs,
      index: draftFaqs.length - 1,
      routes,
      transferNumber,
    });
  }, [question, answer, existingFaqs, routes, transferNumber]);

  function submit() {
    const q = question.trim();
    if (!q) return;

    if (detectCanonicalQuestion(q)) {
      setCanonicalStep(true);
      return;
    }

    onAdd({ question: q, answer: answer.trim() });
    onOpenChange(false);
  }

  const showingCanonical = canonicalStep && canonicalMatch;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        overlayClassName="bg-black/30 backdrop-blur-sm"
        className="gap-0 overflow-hidden border border-slate-200 bg-white p-0 sm:max-w-lg"
      >
        {showingCanonical && canonicalMatch ? (
          <CanonicalQuestionBlocked
            question={question.trim()}
            match={canonicalMatch}
            onBack={() => setCanonicalStep(false)}
          />
        ) : (
          <>
            <DialogHeader className="space-y-0 border-b border-slate-100 px-5 pt-5 pb-4 text-left">
              <DialogTitle className="text-[17px] font-semibold text-[#0b1220]">
                Add a question
              </DialogTitle>
              <DialogDescription className="mt-2 text-[13px] leading-relaxed text-slate-600">
                What callers ask, and what Cara should say out loud. Services,
                hours, and location are already covered elsewhere.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-5 py-4">
              <div>
                <label
                  htmlFor={questionId}
                  className="mb-1.5 block text-[12px] font-medium text-[#0b1220]"
                >
                  Question
                </label>
                <Input
                  id={questionId}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. Do you offer free quotes?"
                  className={DASHBOARD_INPUT_CLASS}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      document.getElementById(answerId)?.focus();
                    }
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor={answerId}
                  className="mb-1.5 block text-[12px] font-medium text-[#0b1220]"
                >
                  Answer
                </label>
                <Textarea
                  id={answerId}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="What Cara should say when someone asks this."
                  rows={4}
                  className={cn(DASHBOARD_INPUT_CLASS, "min-h-[6rem] resize-none")}
                />
              </div>

              {draftWarnings.length > 0 ? (
                <div className="space-y-1.5 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2.5">
                  {draftWarnings.map((warning) => (
                    <p
                      key={warning.id}
                      className="text-[12px] leading-relaxed text-amber-950"
                    >
                      {warning.message}{" "}
                      {warning.href ? (
                        <Link
                          href={warning.href}
                          className="font-medium underline underline-offset-2"
                        >
                          Review
                        </Link>
                      ) : null}
                      {warning.kind === "spoken_url" && smsConfigured ? (
                        <button
                          type="button"
                          onClick={() =>
                            setAnswer(shortenAnswerForSpokenDelivery(answer))
                          }
                          className="ml-1 font-medium text-[#0b1220] underline underline-offset-2"
                        >
                          Shorten for speaking
                        </button>
                      ) : null}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>

            <DialogFooter className="mb-0 flex-row justify-end gap-2 rounded-b-xl border-t border-slate-100 bg-white px-5 pt-4 pb-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-10 rounded-xl border-slate-300 bg-white px-4 text-[13px]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!question.trim()}
                onClick={() => submit()}
                className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS)}
              >
                Add question
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
