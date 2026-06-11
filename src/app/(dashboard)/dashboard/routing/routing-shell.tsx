"use client";

import { Share2 } from "lucide-react";

import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import {
  DASHBOARD_ICON_CHIP_LG,
  DASHBOARD_ICON_GLYPH_LG,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { customRoutes } from "./route-models";
import { RoutingUnsavedGuard } from "./routing-unsaved-guard";
import { useRoutingForm } from "./routing-form-context";

export function RoutingShell({ children }: { children: React.ReactNode }) {
  const form = useRoutingForm();
  const customCount = customRoutes(form.routes).length;

  return (
    <RoutingUnsavedGuard>
      <DashboardAnimatedPageSections className="bg-white">
        <header className="shrink-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className={DASHBOARD_ICON_CHIP_LG}>
                <Share2 className={DASHBOARD_ICON_GLYPH_LG} aria-hidden />
              </span>
              <div className="min-w-0 space-y-2">
                <div>
                  <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-[#0b1220] sm:text-[26px]">
                    Call Flow
                  </h1>
                  <p className="mt-0.5 max-w-xl text-[13px] leading-snug text-slate-600">
                    What Cara sends, transfers, or logs when callers ask for
                    something specific.
                  </p>
                </div>
                <p className="text-[13px] text-slate-600">
                  <span className="font-medium tabular-nums text-[#0b1220]">
                    {customCount}
                  </span>{" "}
                  custom route{customCount === 1 ? "" : "s"}
                  <span className="mx-2 text-slate-300" aria-hidden>
                    ·
                  </span>
                  built-in handling on
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={form.save}
                  disabled={form.pending}
                  className={cn(
                    DASHBOARD_PRIMARY_BUTTON_CLASS,
                    form.isDirty && "ring-2 ring-amber-400/80 ring-offset-2",
                  )}
                >
                  {form.pending ? "Saving…" : "Save call flow"}
                </Button>
              </div>
              {form.isDirty ? (
                <p className="text-[12px] font-medium text-amber-800">
                  Unsaved changes
                </p>
              ) : null}
              {form.status ? (
                <p
                  className={cn(
                    "text-[13px]",
                    form.status.kind === "ok" ? "text-slate-600" : "text-red-600",
                  )}
                >
                  {form.status.message}
                </p>
              ) : null}
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
          {children}
        </div>
      </DashboardAnimatedPageSections>
    </RoutingUnsavedGuard>
  );
}
