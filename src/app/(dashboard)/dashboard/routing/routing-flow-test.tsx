"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

import { DASHBOARD_INPUT_CLASS } from "@/components/dashboard/dashboard-surface";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BusinessFileListItem } from "@/lib/business-files";
import { cn } from "@/lib/utils";

import { useDashboardVertical } from "../../dashboard-vertical-context";

import { matchCallerRequest } from "./route-match";
import { isFallbackRoute, type SavedRoute } from "./route-models";

type RoutingFlowTestProps = {
  routes: SavedRoute[];
  sendableFiles: BusinessFileListItem[];
  className?: string;
};

export function RoutingFlowTest({
  routes,
  sendableFiles,
  className,
}: RoutingFlowTestProps) {
  const { copy } = useDashboardVertical();
  const [utterance, setUtterance] = useState("");

  const preview = useMemo(
    () => matchCallerRequest(utterance, routes, sendableFiles),
    [utterance, routes, sendableFiles],
  );

  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200/90 bg-slate-50/40 p-5 sm:p-6",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#0b1220] shadow-sm ring-1 ring-slate-200/80">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div>
          <h3 className="text-[15px] font-semibold text-[#0b1220]">Test this flow</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
            Same priority rules as live calls — route order, then specificity.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-3">
          <Label htmlFor="flow-test-utterance" className="text-[13px] text-slate-700">
            Pretend caller says
          </Label>
          <Input
            id="flow-test-utterance"
            value={utterance}
            onChange={(e) => setUtterance(e.target.value)}
            placeholder={copy.routing.flowTestPlaceholder}
            className={cn(DASHBOARD_INPUT_CLASS, "h-11")}
          />
          <div className="flex flex-wrap gap-2">
            {copy.routing.flowTestPhrases.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => setUtterance(phrase)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-600 transition-colors hover:border-slate-300"
              >
                {phrase}
              </button>
            ))}
          </div>
        </div>

        <div
          className={cn(
            "min-h-[7rem] rounded-xl border px-4 py-4",
            preview && utterance.trim()
              ? "border-emerald-200/80 bg-emerald-50/50"
              : "border-slate-200 bg-white",
          )}
        >
          {!utterance.trim() ? (
            <p className="text-[13px] text-slate-500">
              Enter a phrase to see which route wins.
            </p>
          ) : preview ? (
            <dl className="space-y-3 text-[13px]">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Matched route
                </dt>
                <dd className="mt-0.5 font-semibold text-[#0b1220]">{preview.route.name}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Action
                </dt>
                <dd className="mt-0.5 text-slate-700">{preview.action}</dd>
              </div>
              {preview.ambiguous ? (
                <p className="text-[12px] leading-relaxed text-amber-900">
                  {preview.ambiguous.message}
                </p>
              ) : null}
              {preview.usedFallback ? (
                <p className="text-[12px] text-slate-600">
                  No strong match — falls through to Anything else.
                </p>
              ) : null}
              {isFallbackRoute(preview.route) && !preview.usedFallback ? (
                <p className="text-[12px] text-slate-600">Fallback route.</p>
              ) : null}
            </dl>
          ) : (
            <p className="text-[13px] text-slate-600">
              No match yet — add routes above and try again.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
