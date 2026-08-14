"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HelpCircle, Plus } from "lucide-react";

import { DashboardAnimatedStack } from "@/components/dashboard/dashboard-animated-group";
import { SectionCard } from "@/components/dashboard/section-card";
import { DASHBOARD_INPUT_CLASS } from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lintFaqVsFilePriceConflicts } from "@/lib/answers-boundary";
import { formatWeekScheduleForAgent } from "@/lib/agent-knowledge-format";
import { cleanBusinessRules } from "@/lib/agent-business-rules";
import { weekScheduleHasOpenDay } from "@/lib/business-hours";

import { MAX_FAQS } from "../agent-setup/agent-faqs";
import { AddQuestionDialog } from "./add-question-dialog";
import { AnswersFaqEditor } from "./answers-faq-editor";
import { FaqsLintNotices } from "./faqs-lint-notices";
import { useCaraSetupForm } from "./cara-setup-form-context";
import { useDashboardVertical } from "../dashboard-vertical-context";

export function CaraSetupTabAnswers() {
  const form = useCaraSetupForm();
  const { copy } = useDashboardVertical();
  const [faqFilter, setFaqFilter] = useState("");
  const [addQuestionOpen, setAddQuestionOpen] = useState(false);

  const filteredFaqs = useMemo(() => {
    const q = faqFilter.trim().toLowerCase();
    if (!q) return form.faqs.map((faq, index) => ({ faq, index }));
    return form.faqs
      .map((faq, index) => ({ faq, index }))
      .filter(
        ({ faq }) =>
          faq.question.toLowerCase().includes(q) ||
          faq.answer.toLowerCase().includes(q),
      );
  }, [form.faqs, faqFilter]);

  const answersConflictWarnings = useMemo(
    () =>
      lintFaqVsFilePriceConflicts(form.faqs, form.businessFiles),
    [form.faqs, form.businessFiles],
  );

  const faqLintContext = useMemo(() => {
    const hasHours = weekScheduleHasOpenDay(form.openingHoursSchedule);
    return {
      openingHours: form.open24_7
        ? "Open 24 hours, 7 days a week"
        : hasHours
          ? formatWeekScheduleForAgent(form.openingHoursSchedule)
          : undefined,
      businessRules: cleanBusinessRules(form.businessRulesItems),
      serviceCatalog:
        form.serviceCatalog.length > 0 ? form.serviceCatalog : undefined,
    };
  }, [
    form.openingHoursSchedule,
    form.open24_7,
    form.businessRulesItems,
    form.serviceCatalog,
  ]);

  function updateFaq(index: number, patch: Partial<(typeof form.faqs)[number]>) {
    form.setFaqs(
      form.faqs.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    );
  }

  function removeFaq(index: number) {
    form.setFaqs(form.faqs.filter((_, i) => i !== index));
  }

  function openAddQuestion() {
    if (form.faqs.length >= MAX_FAQS) return;
    setAddQuestionOpen(true);
  }

  function addFaq(faq: { question: string; answer: string }) {
    if (form.faqs.length >= MAX_FAQS) return;
    form.setFaqs([...form.faqs, faq]);
  }

  const atFaqCap = form.faqs.length >= MAX_FAQS;

  return (
    <DashboardAnimatedStack embedded>
      {answersConflictWarnings.length > 0 ? (
        <div className="space-y-2 border-b border-[#d9e2dd] bg-[#fbfcfb] px-5 py-4">
          {answersConflictWarnings.map((warning) => (
            <p
              key={warning.id}
              className="text-[12.5px] leading-relaxed text-[#35443f]"
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
              {warning.secondaryHref ? (
                <>
                  {" "}
                  <Link
                    href={warning.secondaryHref}
                    className="font-medium underline underline-offset-2"
                  >
                    Review file
                  </Link>
                </>
              ) : null}
            </p>
          ))}
        </div>
      ) : null}

      <SectionCard
        flat
        icon={HelpCircle}
        title={copy.caraSetup.commonQuestionsTitle}
        description="Questions callers ask most, with the answer Cara should give out loud."
        bodyClassName="p-0"
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openAddQuestion}
            disabled={atFaqCap}
            className="h-9 rounded-lg border-slate-300 bg-white text-[12px] text-slate-700"
            title={
              atFaqCap
                ? "Question limit reached. Contact Cliste if Cara needs more answers."
                : undefined
            }
          >
            <Plus className="size-3.5" aria-hidden />
            Add question
          </Button>
        }
      >
        <FaqsLintNotices />
        <div className="space-y-4 px-5 py-5">
        {atFaqCap ? (
          <p className="mb-3 text-[12.5px] text-[#35443f]">
            Question limit reached. Contact Cliste if Cara needs more answers
            loaded for this store.
          </p>
        ) : null}

        {form.faqs.length > 10 ? (
          <Input
            value={faqFilter}
            onChange={(e) => setFaqFilter(e.target.value)}
            placeholder="Search questions…"
            className={DASHBOARD_INPUT_CLASS}
            aria-label="Search common questions"
          />
        ) : null}

        {form.faqs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center">
            <p className="text-[13px] font-medium text-[#0b1220]">
              No questions yet
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
              Add the questions callers ask most often. Hours and departments
              are set above.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openAddQuestion}
              disabled={atFaqCap}
              className="mt-4 h-9 rounded-lg border-slate-300 bg-white text-[12px] text-slate-700"
            >
              <Plus className="size-3.5" aria-hidden />
              Add question
            </Button>
          </div>
        ) : (
          <AnswersFaqEditor
            faqs={form.faqs}
            maxFaqs={MAX_FAQS}
            entries={filteredFaqs}
            total={form.faqs.length}
            routes={form.promptExtras.routes}
            transferNumber={form.promptExtras.transferNumber}
            {...faqLintContext}
            onUpdate={updateFaq}
            onRemove={removeFaq}
          />
        )}
        </div>
      </SectionCard>

      <AddQuestionDialog
        open={addQuestionOpen}
        onOpenChange={setAddQuestionOpen}
        existingFaqs={form.faqs}
        routes={form.promptExtras.routes}
        transferNumber={form.promptExtras.transferNumber}
        {...faqLintContext}
        onAdd={addFaq}
      />
    </DashboardAnimatedStack>
  );
}
