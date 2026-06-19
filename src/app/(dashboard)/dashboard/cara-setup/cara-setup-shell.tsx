"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bot } from "lucide-react";

import { DashboardFormScrollRegion } from "@/components/dashboard/dashboard-form-scroll-region";
import {
  DASHBOARD_ICON_CHIP_LG,
  DASHBOARD_ICON_GLYPH_LG,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { caraNavChildLabel } from "@/lib/dashboard-cara-nav";
import { cn } from "@/lib/utils";

import { CaraSetupPreviewModal } from "./cara-setup-preview-modal";
import { CaraSetupUnsavedGuard } from "./cara-setup-unsaved-guard";
import { AgentConfigLintNotices } from "./agent-config-lint-notices";
import { useAgentConfigLintIssues } from "./use-agent-config-lint-issues";
import { useCaraSetupForm } from "./cara-setup-form-context";

export function CaraSetupShell({ children }: { children: React.ReactNode }) {
  const form = useCaraSetupForm();
  const pathname = usePathname();
  const lintIssues = useAgentConfigLintIssues();
  const [previewOpen, setPreviewOpen] = useState(false);
  const sectionTitle = caraNavChildLabel(pathname) ?? "Cara";

  return (
    <CaraSetupUnsavedGuard>
      <div className="relative h-full min-h-0 flex-1 overflow-hidden">
        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] items-start gap-3 bg-white">
          <header className="min-w-0" data-debug-cara-setup-header="">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className={DASHBOARD_ICON_CHIP_LG}>
                  <Bot className={DASHBOARD_ICON_GLYPH_LG} aria-hidden />
                </span>
                <div className="min-w-0 space-y-2">
                  <div>
                    <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-[#0b1220] sm:text-[26px]">
                      {sectionTitle}
                    </h1>
                    <p className="mt-0.5 max-w-xl text-[13px] leading-snug text-slate-600">
                      How Cara answers and handles calls.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPreviewOpen(true)}
                    className="h-10 rounded-xl border-slate-300 bg-white px-4 text-[13px] text-slate-700"
                  >
                    In Cara&apos;s words
                  </Button>
                  <Button
                    type="button"
                    onClick={form.save}
                    disabled={form.pending}
                    className={DASHBOARD_PRIMARY_BUTTON_CLASS}
                  >
                    {form.pending ? "Saving…" : "Save changes"}
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
                      form.status.kind === "ok"
                        ? "text-slate-600"
                        : "text-red-600",
                    )}
                  >
                    {form.status.message}
                  </p>
                ) : null}
              </div>
            </div>
          </header>

          <DashboardFormScrollRegion scrollClassName="bg-white">
            <AgentConfigLintNotices
              issues={lintIssues}
              sessionKey="cliste:dashboard:cara-setup:lint-intro-dismissed"
              dialogTitle="Review Cara setup"
              dialogDescription="A few things to tidy up so Cara stays accurate on calls."
            />
            {children}
          </DashboardFormScrollRegion>
        </div>

        <CaraSetupPreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          preview={form.compiledPromptPreview}
        />
      </div>
    </CaraSetupUnsavedGuard>
  );
}
