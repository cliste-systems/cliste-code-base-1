"use client";

import { HelpCircle } from "lucide-react";

import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import { DashboardFormScrollRegion } from "@/components/dashboard/dashboard-form-scroll-region";
import { DASHBOARD_PRIMARY_BUTTON_CLASS } from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CaraSetupUnsavedGuard } from "./cara-setup-unsaved-guard";
import { useCaraSetupForm } from "./cara-setup-form-context";

export function FaqsWorkspaceShell({ children }: { children: React.ReactNode }) {
  const form = useCaraSetupForm();

  return (
    <CaraSetupUnsavedGuard>
      <div className="relative flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <ClistePageHeader
          tone="training"
          icon={HelpCircle}
          title="FAQs"
          description="What customers always ask — and how Cara should answer."
          actions={
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              <Button
                type="button"
                onClick={form.save}
                disabled={form.pending}
                className={DASHBOARD_PRIMARY_BUTTON_CLASS}
              >
                {form.pending ? "Saving…" : "Save changes"}
              </Button>
              {form.isDirty ? (
                <p className="text-[12px] font-medium text-[#353D42]">
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
          }
        />

        <DashboardFormScrollRegion
          className="min-h-0 flex-1"
          scrollClassName="divide-y divide-[#dfe7e2] bg-[#fbfcfb]"
        >
          {children}
        </DashboardFormScrollRegion>
      </div>
    </CaraSetupUnsavedGuard>
  );
}
