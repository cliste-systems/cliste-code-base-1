"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileText, HelpCircle, Plus } from "lucide-react";

import { SectionCard } from "@/components/dashboard/section-card";
import { DASHBOARD_INPUT_CLASS } from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildAnswersConflictWarnings } from "@/lib/answers-boundary";
import { buildCaraCapabilitiesFromPromptExtras } from "@/lib/call-handling-boundary";

import {
  deleteBusinessFile,
  updateBusinessFileToggles,
  uploadBusinessFile,
} from "../agent-setup/business-files-actions";
import { BusinessFilesSection } from "../agent-setup/business-files-section";
import { MAX_FAQS } from "../agent-setup/agent-faqs";
import { AddQuestionDialog } from "./add-question-dialog";
import { AnswersFaqEditor } from "./answers-faq-editor";
import { useCaraSetupForm } from "./cara-setup-form-context";

export function CaraSetupTabAnswers() {
  const form = useCaraSetupForm();
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
      buildAnswersConflictWarnings({
        faqs: form.faqs,
        businessFiles: form.businessFiles,
      }),
    [form.faqs, form.businessFiles],
  );

  const caps = buildCaraCapabilitiesFromPromptExtras(
    form.promptExtras.routes,
    form.promptExtras.transferNumber,
  );
  const sendConfigured = caps.sendLink || caps.sendFile;

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
    <div
      className="flex min-h-0 flex-1 flex-col divide-y divide-slate-100"
      data-cara-setup-answers
    >
      {answersConflictWarnings.length > 0 ? (
        <div className="shrink-0 space-y-2 border-b border-amber-200/80 bg-amber-50/60 px-5 py-4">
          {answersConflictWarnings.map((warning) => (
            <p
              key={warning.id}
              className="text-[12.5px] leading-relaxed text-amber-950"
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
            </p>
          ))}
        </div>
      ) : null}

      <SectionCard
        flat
        icon={HelpCircle}
        title="Common questions"
        description="Questions callers ask most, with the answer Cara should give out loud."
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden !space-y-0"
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
                ? "Question limit reached — for bigger knowledge (price lists, menus), upload a file below instead."
                : undefined
            }
          >
            <Plus className="size-3.5" aria-hidden />
            Add question
          </Button>
        }
      >
        {atFaqCap ? (
          <p className="mb-3 text-[12.5px] text-amber-900">
            Question limit reached — for bigger knowledge (price lists, menus),
            upload a file below instead.
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
              Add the questions callers ask most often. Cara already covers
              services, hours, and location from your other setup tabs.
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
          <div className="min-h-0 flex-1 overflow-hidden">
            <AnswersFaqEditor
              faqs={form.faqs}
              maxFaqs={MAX_FAQS}
              entries={filteredFaqs}
              total={form.faqs.length}
              routes={form.promptExtras.routes}
              transferNumber={form.promptExtras.transferNumber}
              onUpdate={updateFaq}
              onRemove={removeFaq}
            />
          </div>
        )}
      </SectionCard>

      <SectionCard
        flat
        icon={FileText}
        title="Files"
        description="Upload documents Cara can read from or send to callers."
        className="shrink-0"
        bodyClassName="!pb-4"
      >
        <BusinessFilesSection
          initialFiles={form.businessFiles}
          sendConfigured={sendConfigured}
          onFilesChange={form.setBusinessFiles}
          onUpload={uploadBusinessFile}
          onToggle={updateBusinessFileToggles}
          onDelete={deleteBusinessFile}
        />
      </SectionCard>

      <AddQuestionDialog
        open={addQuestionOpen}
        onOpenChange={setAddQuestionOpen}
        existingFaqs={form.faqs}
        routes={form.promptExtras.routes}
        transferNumber={form.promptExtras.transferNumber}
        onAdd={addFaq}
      />
    </div>
  );
}
