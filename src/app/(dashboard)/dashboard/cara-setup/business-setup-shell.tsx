"use client";

import { usePathname } from "next/navigation";
import { Briefcase } from "lucide-react";

import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import { DashboardFormScrollRegion } from "@/components/dashboard/dashboard-form-scroll-region";
import { DASHBOARD_PRIMARY_BUTTON_CLASS } from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { businessNavChildLabel } from "@/lib/dashboard-business-nav";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

import { CaraSetupUnsavedGuard } from "./cara-setup-unsaved-guard";
import { useCaraSetupForm } from "./cara-setup-form-context";

export function BusinessSetupShell({ children }: { children: React.ReactNode }) {
  const form = useCaraSetupForm();
  const pathname = usePathname();
  const sectionTitle = businessNavChildLabel(pathname) ?? "Business";
  const showFileCount = pathname.startsWith(DASHBOARD_ROUTES.businessFiles);

  return (
    <CaraSetupUnsavedGuard>
      <div className="relative flex h-full min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <ClistePageHeader
          tone="business"
          icon={Briefcase}
          title={sectionTitle}
          description="What Cara should know about your business."
          summary={
            showFileCount && form.businessFiles.length > 0
              ? [
                  {
                    value: String(form.businessFiles.length),
                    label: form.businessFiles.length === 1 ? "file" : "files",
                  },
                ]
              : undefined
          }
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
