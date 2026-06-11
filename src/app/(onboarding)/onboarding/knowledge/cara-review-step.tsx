"use client";

import { cn } from "@/lib/utils";

import { CaraTrainingStepShell, TRAINING_SURFACE } from "./cara-training-step-shell";
import type { ReviewFaqItem, ReviewPage } from "./train-cara-review-pages";

function CaraSpeechCard({ intro, body }: { intro: string; body: string }) {
  return (
    <article
      className={cn(
        TRAINING_SURFACE,
        "flex min-h-[14.5rem] w-full items-center justify-center px-6 py-5 sm:min-h-[15.5rem] sm:px-8 sm:py-6",
      )}
    >
      <div className="max-w-[36rem] text-pretty text-center">
        <p className="text-[14px] leading-snug font-medium text-slate-500 sm:text-[15px]">
          {intro}
        </p>
        <p className="mt-4 text-[15px] leading-[1.8] text-[#0b1220] sm:text-[15.5px] sm:leading-[1.85]">
          {body}
        </p>
      </div>
    </article>
  );
}

function FaqReviewCard({
  intro,
  items,
}: {
  intro: string;
  items: ReviewFaqItem[];
}) {
  return (
    <article
      className={cn(
        TRAINING_SURFACE,
        "flex w-full flex-col px-5 py-5 sm:px-6 sm:py-6",
      )}
    >
      <p className="text-center text-[14px] leading-snug font-medium text-slate-500 sm:text-[15px]">
        {intro}
      </p>
      <ul
        className="mt-4 max-h-[min(26rem,52vh)] space-y-2.5 overflow-y-auto overscroll-y-contain pr-0.5"
        aria-label="FAQ review list"
      >
        {items.map((item, index) => (
          <li
            key={`${item.question}-${index}`}
            className="rounded-xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-left"
          >
            <p className="text-[13px] leading-snug font-medium text-[#0b1220] sm:text-[14px]">
              {item.question}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600 sm:text-[14px]">
              {item.answer}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}

type Props = {
  pageIndex: number;
  pages: ReviewPage[];
  disabled?: boolean;
};

export function CaraReviewStep({
  pageIndex,
  pages,
  disabled = false,
}: Props) {
  const page = pages[pageIndex];
  if (!page) return null;

  const hasFaqItems = Boolean(page.faqItems && page.faqItems.length > 0);

  return (
    <CaraTrainingStepShell
      compact
      title={page.title}
      subtitle={page.subtitle}
      className="max-w-none"
    >
      <div className={cn("w-full", disabled && "pointer-events-none opacity-60")}>
        {hasFaqItems ? (
          <FaqReviewCard intro={page.intro} items={page.faqItems!} />
        ) : (
          <CaraSpeechCard intro={page.intro} body={page.body} />
        )}
      </div>
    </CaraTrainingStepShell>
  );
}
