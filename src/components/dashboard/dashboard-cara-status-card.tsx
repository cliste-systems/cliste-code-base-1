"use client";

import Link from "next/link";
import { BarChart3, Clock3, Phone, Radio } from "lucide-react";

import { MetricItem } from "@/components/dashboard/dashboard-metric-item";
import {
  SetupChecklist,
  SetupProgressBar,
} from "@/components/dashboard/dashboard-setup-checklist";
import { DASHBOARD_HOME_CARD } from "@/components/dashboard/dashboard-surface";
import type { CaraStatusSnapshot } from "@/lib/cara-status";
import {
  buildCaraSetupSteps,
  firstIncompleteSetupHref,
} from "@/lib/dashboard-cara-setup-steps";
import {
  computeAverageCallLength,
  formatAverageCallLengthValue,
} from "@/lib/dashboard-average-call-length";
import {
  computeCallSuccessRate,
  formatCallSuccessRateValue,
} from "@/lib/dashboard-call-success-rate";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

function lineMetricValue(caraStatus: CaraStatusSnapshot): string {
  const phoneConnected = caraStatus.phoneLine.value === "Connected";
  if (!phoneConnected) return "Setup";
  return caraStatus.phoneLine.subtext.trim();
}

function CaraStatusBanner({ caraStatus }: { caraStatus: CaraStatusSnapshot }) {
  const isLive = caraStatus.isOnline;
  const title = isLive ? caraStatus.liveStatus.value : "Setup needed";
  const subtitle = isLive
    ? caraStatus.liveStatus.subtext
    : "Cara is not live yet";

  return (
    <div className="relative h-[72px] overflow-hidden rounded-xl bg-[#07111f]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(148,163,184,0.9) 1px, transparent 1px)",
          backgroundSize: "10px 10px",
          maskImage: "linear-gradient(to left, black, transparent 70%)",
          WebkitMaskImage: "linear-gradient(to left, black, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute bottom-3 right-4 h-8 w-28 opacity-20"
        aria-hidden
      >
        <svg
          viewBox="0 0 112 32"
          className="h-full w-full"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M0 16 Q14 4 28 16 T56 16 T84 16 T112 16"
            stroke="rgba(148,163,184,0.8)"
            strokeWidth="1.5"
            strokeDasharray="3 4"
          />
          <path
            d="M0 22 Q14 10 28 22 T56 22 T84 22 T112 22"
            stroke="rgba(148,163,184,0.5)"
            strokeWidth="1"
            strokeDasharray="2 5"
          />
        </svg>
      </div>

      <div className="relative flex h-full items-center gap-3 px-4">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white"
          aria-hidden
        >
          <Radio className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-tight text-white">
            {title}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-slate-400">
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}

export function CaraStatusCard({
  caraStatus,
  callOutcomes,
  callDurationSeconds,
  className,
}: {
  caraStatus: CaraStatusSnapshot;
  callOutcomes: (string | null)[];
  callDurationSeconds: (number | null)[];
  className?: string;
}) {
  const phoneConnected = caraStatus.phoneLine.value === "Connected";
  const success = computeCallSuccessRate(
    callOutcomes.map((outcome) => outcome ?? ""),
  );
  const avgLength = computeAverageCallLength(callDurationSeconds);
  const setupSteps = buildCaraSetupSteps(caraStatus);
  const completeCount = setupSteps.filter((s) => s.complete).length;
  const continueHref = firstIncompleteSetupHref(setupSteps);
  const isLive = caraStatus.isOnline;

  return (
    <section
      className={cn(DASHBOARD_HOME_CARD, "flex shrink-0 flex-col", className)}
    >
      <h2 className="mb-2 shrink-0 text-[15px] font-semibold tracking-tight text-[#0b1220]">
        Cara status
      </h2>

      <div className="flex flex-col gap-2.5">
        <CaraStatusBanner caraStatus={caraStatus} />

        <div className="grid min-h-[68px] shrink-0 grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-200 bg-white">
          <MetricItem
            icon={Phone}
            label="Business line"
            value={lineMetricValue(caraStatus)}
            valueClassName="text-[11px] leading-snug tabular-nums whitespace-normal"
            href={
              phoneConnected
                ? DASHBOARD_ROUTES.settings
                : DASHBOARD_ROUTES.caraSetup
            }
          />
          <MetricItem
            icon={BarChart3}
            label="Success rate"
            value={formatCallSuccessRateValue(success.percent)}
            href={DASHBOARD_ROUTES.calls}
          />
          <MetricItem
            icon={Clock3}
            label="Avg length"
            value={formatAverageCallLengthValue(avgLength.averageSeconds)}
            href={DASHBOARD_ROUTES.calls}
          />
        </div>

        <div className="flex flex-col">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-[#0b1220]">
              Setup progress
            </p>
            <p className="text-[12px] tabular-nums text-slate-500">
              {completeCount}/{setupSteps.length} complete
            </p>
          </div>

          <SetupProgressBar
            complete={completeCount}
            total={setupSteps.length}
          />

          <div className="mt-1.5">
            <SetupChecklist steps={setupSteps} />
          </div>

          <Link
            href={continueHref}
            className="mt-2.5 flex h-10 items-center justify-center rounded-lg bg-[#0b1220] text-[13px] font-medium text-white transition-colors hover:bg-[#0b1220]/90"
          >
            {isLive ? "Manage Cara setup" : "Continue setup"}
          </Link>
        </div>
      </div>
    </section>
  );
}
