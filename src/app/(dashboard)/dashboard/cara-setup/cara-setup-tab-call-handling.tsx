"use client";

import Link from "next/link";
import { MessageSquareText } from "lucide-react";

import { Field } from "@/components/dashboard/field";
import { SectionCard } from "@/components/dashboard/section-card";
import { MAX_BUSINESS_RULES } from "@/lib/agent-business-rules";
import { dedupeServiceChips } from "@/lib/services-boundary";

import { useDashboardVertical } from "../dashboard-vertical-context";

import { CallHandlingChipEditor } from "./call-handling-chip-editor";
import { CaraWhenUnsureCallout } from "./cara-when-unsure-callout";
import { DetailsToCollectEditor } from "./details-to-collect-editor";
import { useCaraSetupForm } from "./cara-setup-form-context";

export function CaraSetupTabCallHandling() {
  const form = useCaraSetupForm();
  const vertical = useDashboardVertical();

  return (
    <SectionCard
      flat
      icon={MessageSquareText}
      title="Call handling"
      description="What Cara collects on calls and the rules she must always follow."
      bodyClassName="space-y-0 p-0"
    >
      {form.callHandlingConflictWarnings.length > 0 ? (
        <div className="space-y-2 border-b border-amber-200/80 bg-amber-50/60 px-5 py-4">
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

      <div className="space-y-5 px-5 pt-1 pb-5">
        <Field
          label="Details to collect from callers"
          htmlFor="cara-details-to-collect"
          hint="Type a detail, then comma — or press Enter or Add. Name and phone are always collected."
        >
          <DetailsToCollectEditor
            inputId="cara-details-to-collect"
            items={form.detailsToCollectItems}
            onItemsChange={form.setDetailsToCollectItems}
            mode={form.detailsCollectMode}
            onModeChange={form.setDetailsCollectMode}
            placeholder={vertical.copy.caraSetup.detailsToCollectPlaceholder}
            maxItems={12}
            routes={form.promptExtras.routes}
            transferNumber={form.promptExtras.transferNumber}
          />
        </Field>
        <Field
          label="Business rules"
          htmlFor="cara-business-rules"
          hint="Type a rule, then comma — or press Enter or Add."
        >
          <CallHandlingChipEditor
            kind="rule"
            inputId="cara-business-rules"
            value={form.businessRulesItems}
            onChange={form.setBusinessRulesItems}
            placeholder="e.g. Never quote a price over the phone, Don't book new clients on Mondays"
            maxItems={MAX_BUSINESS_RULES}
            routes={form.promptExtras.routes}
            transferNumber={form.promptExtras.transferNumber}
            onMoveToServicesExclusion={(item) =>
              form.setServicesNotOfferedItems(
                dedupeServiceChips([...form.servicesNotOfferedItems, item]),
              )
            }
          />
        </Field>
      </div>

      <div className="border-t border-slate-200 px-5 py-4">
        <CaraWhenUnsureCallout />
      </div>
    </SectionCard>
  );
}
