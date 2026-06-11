"use client";

import Link from "next/link";
import { Ban, CheckCircle2 } from "lucide-react";

import { Field } from "@/components/dashboard/field";
import { SectionCard } from "@/components/dashboard/section-card";
import { dedupeServiceChips } from "@/lib/services-boundary";
import { cn } from "@/lib/utils";

import { CaraWhenUnsureCallout } from "./cara-when-unsure-callout";
import { ServicesBoundaryChipEditor } from "./services-boundary-chip-editor";
import { useCaraSetupForm } from "./cara-setup-form-context";

export function CaraSetupTabServices() {
  const form = useCaraSetupForm();
  const offerEmpty = form.servicesItems.length === 0;

  return (
    <SectionCard
      flat
      title="Services boundary"
      description="Cara uses both lists on every call — what she can confirm, and what she must never promise."
      bodyClassName="p-0"
    >
      {offerEmpty ? (
        <div className="border-b border-amber-200/80 bg-amber-50/80 px-5 py-3">
          <p className="text-[12.5px] leading-relaxed text-amber-950">
            Cara can&apos;t confirm any work until you add what you offer —
            she&apos;ll take a message for every job request.
          </p>
        </div>
      ) : null}

      <div className="grid items-start lg:grid-cols-2">
        <div
          className={cn(
            "min-w-0 px-5 py-5",
            "border-b border-slate-200 lg:border-b-0 lg:border-r",
          )}
        >
          <div className="mb-4 flex items-start gap-2.5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold text-slate-900">
                What you offer
              </h3>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">
                Categories callers might ask for — use broad labels, not every
                phrase they might say.
              </p>
            </div>
          </div>
          <Field
            label="Add services"
            htmlFor="cara-services-offered"
            hint="Type a category, then comma — or press Enter or Add."
          >
            <ServicesBoundaryChipEditor
              kind="offered"
              inputId="cara-services-offered"
              value={form.servicesItems}
              onChange={(next) =>
                form.setServicesItems(dedupeServiceChips(next))
              }
              otherList={form.servicesNotOfferedItems}
              onAddToOtherList={(item) =>
                form.setServicesNotOfferedItems(
                  dedupeServiceChips([...form.servicesNotOfferedItems, item]),
                )
              }
              placeholder="e.g. Consultations, quotes, emergency callouts"
            />
          </Field>
        </div>

        <div className="min-w-0 px-5 py-5">
          <div className="mb-4 flex items-start gap-2.5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Ban className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold text-slate-900">
                What you don&apos;t offer
              </h3>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">
                Specific things Cara must never promise — narrower beats broad
                offers.
              </p>
            </div>
          </div>
          <Field
            label="Add exclusions"
            htmlFor="cara-services-not-offered"
            hint="Type an exclusion, then comma — or press Enter or Add."
          >
            <ServicesBoundaryChipEditor
              kind="excluded"
              inputId="cara-services-not-offered"
              value={form.servicesNotOfferedItems}
              onChange={(next) =>
                form.setServicesNotOfferedItems(dedupeServiceChips(next))
              }
              otherList={form.servicesItems}
              placeholder="e.g. Same-day jobs, work outside our area"
            />
          </Field>
        </div>
      </div>

      {form.serviceConflictWarnings.length > 0 ? (
        <div className="space-y-2 border-t border-amber-200/80 bg-amber-50/60 px-5 py-4">
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
        </div>
      ) : null}

      <div className="border-t border-slate-200 px-5 py-4">
        <CaraWhenUnsureCallout />
      </div>
    </SectionCard>
  );
}
