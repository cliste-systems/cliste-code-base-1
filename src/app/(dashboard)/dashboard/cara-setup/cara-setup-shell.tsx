"use client";

import Link from "next/link";
import { useState } from "react";
import { Bot } from "lucide-react";

import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import { DashboardInlineSummary } from "@/components/dashboard/dashboard-inline-summary";
import {
  DASHBOARD_ICON_CHIP_LG,
  DASHBOARD_ICON_GLYPH_LG,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { CaraSetupPreviewModal } from "./cara-setup-preview-modal";
import { CaraSetupTabs } from "./cara-setup-tabs";
import { CaraSetupUnsavedGuard } from "./cara-setup-unsaved-guard";
import { useCaraSetupForm } from "./cara-setup-form-context";

export function CaraSetupShell({ children }: { children: React.ReactNode }) {
  const form = useCaraSetupForm();
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <CaraSetupUnsavedGuard>
      <>
      <DashboardAnimatedPageSections className="bg-white">
        <header className="shrink-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className={DASHBOARD_ICON_CHIP_LG}>
                <Bot className={DASHBOARD_ICON_GLYPH_LG} aria-hidden />
              </span>
              <div className="min-w-0 space-y-2">
                <div>
                  <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-[#0b1220] sm:text-[26px]">
                    Cara Setup
                  </h1>
                  <p className="mt-0.5 max-w-xl text-[13px] leading-snug text-slate-600">
                    What Cara says, knows, and captures on calls.
                  </p>
                </div>
                {form.businessFiles.length > 0 ? (
                  <DashboardInlineSummary
                    segments={[
                      {
                        value: String(form.businessFiles.length),
                        label:
                          form.businessFiles.length === 1 ? "file" : "files",
                      },
                    ]}
                  />
                ) : null}
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

        <div className="shrink-0 border-b border-slate-200 pb-2">
          <CaraSetupTabs />
        </div>

        {form.serviceConflictWarnings.length > 0 ||
        form.callHandlingConflictWarnings.length > 0 ? (
          <div className="shrink-0 space-y-1 border-b border-amber-200/80 bg-amber-50/80 px-4 py-3">
            {form.serviceConflictWarnings.map((warning) => (
              <p
                key={`${warning.exclusion}-${warning.label}`}
                className="text-[12.5px] leading-relaxed text-amber-950"
              >
                {warning.message}{" "}
                <Link
                  href={
                    warning.location === "faq"
                      ? "/dashboard/cara-setup/answers"
                      : "/dashboard/cara-setup/general"
                  }
                  className="font-medium underline underline-offset-2"
                >
                  Review
                </Link>
              </p>
            ))}
            {form.callHandlingConflictWarnings.map((warning) => (
              <p
                key={warning.id}
                className="text-[12.5px] leading-relaxed text-amber-950"
              >
                {warning.message}{" "}
                {warning.href ? (
                  <Link
                    href={warning.href}
                    className="font-medium underline underline-offset-2"
                  >
                    Review
                  </Link>
                ) : null}
                {warning.secondaryHref ? (
                  <>
                    {" "}
                    <Link
                      href={warning.secondaryHref}
                      className="font-medium underline underline-offset-2"
                    >
                      Review other
                    </Link>
                  </>
                ) : null}
              </p>
            ))}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-white">
          {children}
        </div>
      </DashboardAnimatedPageSections>

      <CaraSetupPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        preview={form.compiledPromptPreview}
      />
      </>
    </CaraSetupUnsavedGuard>
  );
}
