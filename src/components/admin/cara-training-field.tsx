import type { ReactNode } from "react";
import { Lock, Settings2, Sparkles } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type CaraTrainingFieldFeed = "prompt" | "internal" | "behaviour";

export function CaraTrainingFeedLegend() {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2.5">
      <p className="text-muted-foreground text-xs leading-relaxed">
        <span className="mr-3 inline-flex items-center gap-1.5">
          <Sparkles className="size-3 text-violet-500" aria-hidden />
          <span className="font-medium text-violet-800">Cara reads</span>
          — compiled into her call prompt
        </span>
        <span className="mr-3 inline-flex items-center gap-1.5">
          <Settings2 className="size-3 text-sky-600" aria-hidden />
          <span className="font-medium text-sky-800">Behaviour</span>
          — changes how she handles calls
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Lock className="size-3 text-slate-400" aria-hidden />
          <span className="font-medium text-slate-600">Internal</span>
          — saved but not spoken
        </span>
      </p>
    </div>
  );
}

export function CaraTrainingInternalBanner({
  children,
}: {
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-600">
      <Lock className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden />
      <div>
        <p className="font-medium text-slate-700">Internal only</p>
        <p className="mt-0.5 leading-relaxed">
          {children ??
            "Saved to Supabase for routing and ops — nothing here is spoken to callers."}
        </p>
      </div>
    </div>
  );
}

function FeedBadge({ feed }: { feed: CaraTrainingFieldFeed }) {
  if (feed === "prompt") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
        <Sparkles className="size-2.5" aria-hidden />
        Cara reads
      </span>
    );
  }
  if (feed === "behaviour") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
        <Settings2 className="size-2.5" aria-hidden />
        Behaviour
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
      <Lock className="size-2.5" aria-hidden />
      Internal
    </span>
  );
}

export function CaraTrainingFieldLabel({
  label,
  feed,
  htmlFor,
}: {
  label: ReactNode;
  feed: CaraTrainingFieldFeed;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Label
        htmlFor={htmlFor}
        className={cn(
          "text-xs",
          feed === "prompt" ? "font-medium text-slate-900" : "text-slate-700",
        )}
      >
        {label}
      </Label>
      <FeedBadge feed={feed} />
    </div>
  );
}

export function CaraTrainingField({
  label,
  htmlFor,
  feed = "prompt",
  hint,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  feed?: CaraTrainingFieldFeed;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const highlighted = feed === "prompt" || feed === "behaviour";

  return (
    <div
      className={cn(
        "space-y-2",
        highlighted &&
          feed === "prompt" &&
          "rounded-lg border border-violet-200/70 bg-gradient-to-br from-violet-50/70 to-white px-3 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]",
        highlighted &&
          feed === "behaviour" &&
          "rounded-lg border border-sky-200/70 bg-gradient-to-br from-sky-50/60 to-white px-3 py-2.5",
        !highlighted && className,
        highlighted && className,
      )}
    >
      <CaraTrainingFieldLabel label={label} feed={feed} htmlFor={htmlFor} />
      {hint ? (
        <p className="text-muted-foreground text-[11px] leading-snug">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}
