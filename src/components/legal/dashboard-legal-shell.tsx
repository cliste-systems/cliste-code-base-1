"use client";

import { Shield } from "lucide-react";
import type { ReactNode } from "react";

import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { LegalPathProvider } from "@/components/legal/legal-path-context";
import { DashboardLegalTabs } from "@/components/legal/dashboard-legal-tabs";

type DashboardLegalShellProps = {
  children: ReactNode;
};

export function DashboardLegalShell({ children }: DashboardLegalShellProps) {
  return (
    <DashboardAnimatedPageSections className="bg-white">
      <header className="shrink-0">
        <DashboardPageHeader
          eyebrow="Account"
          title="Legal & privacy"
          icon={Shield}
          description="GDPR data requests for your customers, plus Cliste legal documents for your records."
        />
      </header>

      <div className="shrink-0 border-b border-slate-200 pb-2">
        <DashboardLegalTabs />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain bg-white">
        <LegalPathProvider variant="dashboard">{children}</LegalPathProvider>
      </div>
    </DashboardAnimatedPageSections>
  );
}
