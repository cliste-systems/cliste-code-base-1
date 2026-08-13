import type { ComponentType, ReactNode } from "react";

import type { InlineSummarySegment } from "@/components/dashboard/dashboard-inline-summary";
import { PUBLIC_ASSETS } from "@/lib/public-assets";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const HEADER_BACKGROUND = PUBLIC_ASSETS.dashboard.homeHero.png;

const HEADER_TONES = {
  activity: {
    eyebrow: "Activity log",
    accent: "before:bg-[#353D42]",
    text: "text-[#353D42]",
    icon: "border-[#cfd9d4] bg-[#f6faf7] text-[#353D42]",
    rule: "border-[#d9e2dd]",
  },
  calls: {
    eyebrow: "Phone line",
    accent: "before:bg-[#353D42]",
    text: "text-[#353D42]",
    icon: "border-[#cfd9d4] bg-[#f6faf7] text-[#353D42]",
    rule: "border-[#d9e2dd]",
  },
  inbox: {
    eyebrow: "Triage desk",
    accent: "before:bg-[#353D42]",
    text: "text-[#353D42]",
    icon: "border-[#cfd9d4] bg-[#f6faf7] text-[#353D42]",
    rule: "border-[#d9e2dd]",
  },
  training: {
    eyebrow: "Learning loop",
    accent: "before:bg-[#353D42]",
    text: "text-[#353D42]",
    icon: "border-[#cfd9d4] bg-[#f6faf7] text-[#353D42]",
    rule: "border-[#d9e2dd]",
  },
  clients: {
    eyebrow: "Client dossier",
    accent: "before:bg-[#353D42]",
    text: "text-[#353D42]",
    icon: "border-[#cfd9d4] bg-[#f6faf7] text-[#353D42]",
    rule: "border-[#d9e2dd]",
  },
  routing: {
    eyebrow: "Route map",
    accent: "before:bg-[#353D42]",
    text: "text-[#353D42]",
    icon: "border-[#cfd9d4] bg-[#f6faf7] text-[#353D42]",
    rule: "border-[#d9e2dd]",
  },
  cara: {
    eyebrow: "Cara setup",
    accent: "before:bg-[#353D42]",
    text: "text-[#353D42]",
    icon: "border-[#cfd9d4] bg-[#f6faf7] text-[#353D42]",
    rule: "border-[#d9e2dd]",
  },
  business: {
    eyebrow: "Business profile",
    accent: "before:bg-[#353D42]",
    text: "text-[#353D42]",
    icon: "border-[#cfd9d4] bg-[#f6faf7] text-[#353D42]",
    rule: "border-[#d9e2dd]",
  },
  account: {
    eyebrow: "Account",
    accent: "before:bg-[#353D42]",
    text: "text-[#353D42]",
    icon: "border-[#cfd9d4] bg-[#f6faf7] text-[#353D42]",
    rule: "border-[#d9e2dd]",
  },
} as const;

export type ClistePageHeaderTone = keyof typeof HEADER_TONES;

type ClistePageHeaderProps = {
  tone: ClistePageHeaderTone;
  icon: IconType;
  title: string;
  description: ReactNode;
  summary?: InlineSummarySegment[];
  actions?: ReactNode;
  className?: string;
};

export function ClistePageHeader({
  tone,
  icon: Icon,
  title,
  description,
  summary,
  actions,
  className,
}: ClistePageHeaderProps) {
  const t = HEADER_TONES[tone];

  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] bg-cover bg-right bg-no-repeat px-4 py-4 text-[#0b1220] shadow-[0_1px_0_rgba(17,24,29,0.05),0_16px_42px_-30px_rgba(17,24,29,0.28)] sm:px-5",
        "before:absolute before:inset-y-0 before:left-0 before:w-1.5",
        t.accent,
        className,
      )}
      style={{ backgroundImage: `url('${HEADER_BACKGROUND}')` }}
    >
      <div className="absolute inset-0 bg-white/54" aria-hidden />
      <div
        className="absolute inset-y-0 left-0 w-[42%] bg-gradient-to-r from-white via-white/88 to-white/0"
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-lg border",
              t.icon,
            )}
          >
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", t.text)}>
              {t.eyebrow}
            </p>
            <h1 className="mt-1 text-[25px] font-semibold leading-tight tracking-tight text-[#0b1220] sm:text-[28px]">
              {title}
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-600">
              {description}
            </p>
          </div>
        </div>

        {actions ? <div className="shrink-0 lg:pt-1">{actions}</div> : null}
      </div>

      {summary && summary.length > 0 ? (
        <div
          className={cn(
            "relative mt-4 flex flex-wrap gap-2 border-t pt-3",
            t.rule,
          )}
          aria-label="Page summary"
        >
          {summary.map((segment) => (
            <span
              key={segment.label}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-white/80 bg-white/78 px-2.5 py-1 text-[12px] text-slate-600 shadow-[0_1px_0_rgba(17,24,29,0.04)] tabular-nums backdrop-blur-sm"
            >
              <span className={cn("font-semibold", t.text)}>
                {segment.value}
              </span>
              <span>{segment.label}</span>
            </span>
          ))}
        </div>
      ) : null}
    </header>
  );
}
