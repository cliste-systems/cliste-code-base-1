"use client";

import { CheckCircle2, Sparkles } from "lucide-react";

import {
  DASHBOARD_ICON_CHIP_MD,
  DASHBOARD_ICON_GLYPH_MD,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

type Props = {
  lines: string[];
  applied: boolean;
  heading?: string;
  className?: string;
};

export function CaraTrainingPatchPreview({
  lines,
  applied,
  heading,
  className,
}: Props) {
  const title =
    heading ??
    (applied ? "What Cara learned" : "Draft update for Cara");

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/90 bg-slate-50/60 p-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className={DASHBOARD_ICON_CHIP_MD}>
          {applied ? (
            <CheckCircle2 className={DASHBOARD_ICON_GLYPH_MD} aria-hidden />
          ) : (
            <Sparkles className={DASHBOARD_ICON_GLYPH_MD} aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            {title}
          </p>
          <ul className="mt-2 space-y-1">
            {lines.map((line) => (
              <li key={line} className="text-[14px] leading-relaxed text-[#0b1220]">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
