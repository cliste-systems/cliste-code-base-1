"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Briefcase } from "lucide-react";

import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import { DashboardFormScrollRegion } from "@/components/dashboard/dashboard-form-scroll-region";
import {
  DASHBOARD_PRIMARY_BUTTON_CLASS,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { businessNavChildLabel } from "@/lib/dashboard-business-nav";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

import { CaraSetupPreviewModal } from "./cara-setup-preview-modal";
import { CaraSetupUnsavedGuard } from "./cara-setup-unsaved-guard";
import { AgentConfigLintNotices } from "./agent-config-lint-notices";
import { useAgentConfigLintIssues } from "./use-agent-config-lint-issues";
import { useCaraSetupForm } from "./cara-setup-form-context";

export function BusinessSetupShell({ children }: { children: React.ReactNode }) {
  const form = useCaraSetupForm();
  const pathname = usePathname();
  const lintIssues = useAgentConfigLintIssues();
  const [previewOpen, setPreviewOpen] = useState(false);
  const sectionTitle = businessNavChildLabel(pathname) ?? "Business";
  const showFileCount = pathname.startsWith(DASHBOARD_ROUTES.businessFiles);

  return (
    <CaraSetupUnsavedGuard>
      <div className="relative h-full min-h-0 flex-1 overflow-hidden">
        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] items-start gap-3 bg-white">
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
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className={DASHBOARD_SECONDARY_BUTTON_CLASS}
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

          <DashboardFormScrollRegion scrollClassName="bg-[#fbfcfb] divide-y divide-[#dfe7e2]">
            {!pathname.startsWith(DASHBOARD_ROUTES.businessServices) &&
            !pathname.startsWith(DASHBOARD_ROUTES.businessFiles) &&
            !pathname.startsWith(DASHBOARD_ROUTES.businessFaqs) ? (
              <AgentConfigLintNotices
                issues={lintIssues}
                sessionKey="cliste:dashboard:business-setup:lint-intro-dismissed"
                dialogTitle="Review business setup"
                dialogDescription="A few things to tidy up so Cara stays accurate on calls."
              />
            ) : null}
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
