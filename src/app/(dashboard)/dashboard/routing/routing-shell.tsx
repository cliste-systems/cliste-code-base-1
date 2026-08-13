"use client";

import { Share2 } from "lucide-react";

import {
  DASHBOARD_FORM_STACK,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
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
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="shrink-0">
          <ClistePageHeader
          tone="routing"
          icon={Share2}
          title="Call Flow"
          description="What Cara sends, transfers, or logs when callers ask for something specific."
          summary={[
            {
              value: String(customCount),
              label: `custom route${customCount === 1 ? "" : "s"}`,
            },
            { value: "on", label: "built-in handling" },
          ]}
          actions={
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={form.save}
                  disabled={form.pending}
                  className={cn(
                    DASHBOARD_PRIMARY_BUTTON_CLASS,
                    form.isDirty && "ring-2 ring-[#9da9a4] ring-offset-2",
                  )}
                >
                  {form.pending ? "Saving…" : "Save call flow"}
                </Button>
              </div>
              {form.isDirty ? (
                <p className="text-[12px] font-medium text-[#353D42]">
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
          }
          />
        </div>

        <div
          className={cn(
            DASHBOARD_FORM_STACK,
            "flex min-h-0 flex-1 flex-col overflow-hidden divide-y-0",
          )}
        >
          {children}
        </div>
      </div>
    </RoutingUnsavedGuard>
  );
}
