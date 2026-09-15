"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { fetchCallerHistoryInsight } from "@/app/(dashboard)/dashboard/call-history/actions";
import { DetailSection } from "@/components/dashboard/list-detail";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  CALLER_HISTORY_FLAG_LABELS,
  type CallerHistoryInsight,
  type CallerHistorySecurityFlag,
} from "@/lib/caller-history-insight";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

type CallerHistorySectionProps = {
  callerNumber: string;
  currentCallId: string;
};

function securityFlagVariant(flag: CallerHistorySecurityFlag): "attention" | "brand" | "success" {
  if (flag === "blocked" || flag === "open_complaints" || flag === "high_volume_today") {
    return "attention";
  }
  return "brand";
}

export function CallerHistorySection({
  callerNumber,
  currentCallId,
}: CallerHistorySectionProps) {
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<CallerHistoryInsight | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setInsight(null);

    void fetchCallerHistoryInsight({
      callerNumber,
    })
      .then((result) => {
        if (cancelled) return;
        setInsight(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [callerNumber, currentCallId]);

  if (loading) {
    return (
      <DetailSection title="Caller history">
        <div className="flex items-center gap-2 text-[13px] text-slate-500">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading caller history…
        </div>
      </DetailSection>
    );
  }

  if (!insight) {
    return null;
  }

  if (insight.kind === "anonymous") {
    return (
      <DetailSection title="Caller history">
        <p className="text-[13px] leading-relaxed text-slate-600">
          Withheld number — limited history.
        </p>
      </DetailSection>
    );
  }

  const flags = insight.securityFlags;

  if (insight.kind === "first_call") {
    return (
      <DetailSection title="Caller history">
        <p className="text-[13px] leading-relaxed text-slate-600">
          First call from this number.
        </p>
        {flags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {flags.map((flag) => (
              <StatusPill key={flag} variant={securityFlagVariant(flag)}>
                {CALLER_HISTORY_FLAG_LABELS[flag]}
              </StatusPill>
            ))}
          </div>
        ) : null}
      </DetailSection>
    );
  }

  return (
    <DetailSection title="Caller history">
      <p className="text-[13px] leading-relaxed text-slate-700">
        {insight.totalCalls} {insight.totalCalls === 1 ? "call" : "calls"}
        <span className="text-slate-300"> · </span>
        First {insight.firstCallLabel}
        <span className="text-slate-300"> · </span>
        Last {insight.lastCallLabel}
        {insight.openFollowUps > 0 ? (
          <>
            <span className="text-slate-300"> · </span>
            {insight.openFollowUps} open follow-up
            {insight.openFollowUps === 1 ? "" : "s"}
          </>
        ) : null}
      </p>

      {insight.knownNames.length > 1 ? (
        <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
          Names used: {insight.knownNames.join(", ")}
        </p>
      ) : null}

      {flags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {flags.map((flag) => (
            <StatusPill key={flag} variant={securityFlagVariant(flag)}>
              {CALLER_HISTORY_FLAG_LABELS[flag]}
            </StatusPill>
          ))}
        </div>
      ) : null}

      {insight.recentCalls.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {insight.recentCalls.map((recent) => {
            const href = `${DASHBOARD_ROUTES.calls}?call=${encodeURIComponent(recent.id)}`;
            const isCurrent = recent.id === currentCallId;
            return (
              <li key={recent.id}>
                {isCurrent ? (
                  <div className="rounded-lg border border-[#dfe7e2] bg-white px-3 py-2.5">
                    <p className="text-[12px] font-medium text-slate-500">
                      {recent.dateLabel}
                      <span className="text-slate-300"> · </span>
                      {recent.intentLabel}
                      <span className="text-slate-300"> · </span>
                      This call
                    </p>
                    {recent.summaryPreview ? (
                      <p className="mt-1 text-[13px] leading-snug text-slate-700">
                        {recent.summaryPreview}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <Link
                    href={href}
                    className="block rounded-lg border border-[#dfe7e2] bg-white px-3 py-2.5 transition hover:border-[#9da9a4]"
                  >
                    <p className="text-[12px] font-medium text-slate-500">
                      {recent.dateLabel}
                      <span className="text-slate-300"> · </span>
                      {recent.intentLabel}
                    </p>
                    {recent.summaryPreview ? (
                      <p className="mt-1 text-[13px] leading-snug text-slate-700">
                        {recent.summaryPreview}
                      </p>
                    ) : null}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </DetailSection>
  );
}
