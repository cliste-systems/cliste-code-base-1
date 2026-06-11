"use client";

import Link from "next/link";
import { Shield } from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DASHBOARD_FORM_STACK } from "@/components/dashboard/dashboard-surface";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

import { PrivacyToolsClient } from "./privacy-client";

type PrivacyViewProps = {
  className?: string;
};

export function PrivacyView({ className }: PrivacyViewProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4 bg-white", className)}>
      <div className="shrink-0">
        <DashboardPageHeader
          eyebrow="Account"
          title="GDPR"
          icon={Shield}
          description="Export or erase a customer's data when they exercise their rights."
          descriptionLine2="Actions apply to your business only and are recorded in the security audit log."
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className={DASHBOARD_FORM_STACK}>
          <PrivacyToolsClient />
          <section className="px-5 py-5">
            <h2 className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
              What is included?
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-slate-600">
              <li>
                <strong className="font-medium text-[#0b1220]">Export</strong>{" "}
                — every appointment, call log, and action-inbox ticket for that
                phone number in your account.
              </li>
              <li>
                <strong className="font-medium text-[#0b1220]">Erase</strong>{" "}
                — name, phone, and email are redacted; transcripts and AI
                summaries are removed.
              </li>
              <li>
                Customers can also email{" "}
                <a
                  href="mailto:privacy@clistesystems.ie"
                  className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
                >
                  privacy@clistesystems.ie
                </a>
                . You remain the data controller; we act as processor.
              </li>
            </ul>
            <h2 className="mt-6 text-[15px] font-semibold tracking-tight text-[#0b1220]">
              Website wording for your customers
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
              Add wording like this to your website privacy or contact page —
              whatever fits your niche (salon, garage, clinic, trades, etc.).
              Swap in your business name and contact details:
            </p>
            <blockquote className="mt-2 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[12px] leading-relaxed text-slate-700">
              When you call [Business name], your call may be answered by our AI
              phone assistant provided by Cliste Systems. Calls may be recorded
              and transcribed to handle your request. We use Cliste to process
              this data on our behalf. For privacy requests, contact us directly
              or email privacy@clistesystems.ie.
            </blockquote>
            <p className="mt-4 text-[12px] text-slate-500">
              <Link
                href="/legal/dpa"
                className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
              >
                Data Processing Agreement
              </Link>
              {" · "}
              <Link
                href="/legal/privacy"
                className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
              >
                Privacy notice
              </Link>
              {" · "}
              <Link
                href={DASHBOARD_ROUTES.support}
                className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
              >
                Support
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
