"use client";

import { Clock, Store } from "lucide-react";

import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import { DashboardAnimatedStack } from "@/components/dashboard/dashboard-animated-group";
import { DashboardFormScrollRegion } from "@/components/dashboard/dashboard-form-scroll-region";
import { Field } from "@/components/dashboard/field";
import { SectionCard } from "@/components/dashboard/section-card";
import { OpeningHoursEditor } from "@/components/agent-knowledge/opening-hours-editor";
import {
  DASHBOARD_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { dedupeServiceChips } from "@/lib/services-boundary";
import { cn } from "@/lib/utils";

import { CaraSetupTabAnswers } from "./cara-setup-tab-answers";
import { CaraSetupUnsavedGuard } from "./cara-setup-unsaved-guard";
import { ServicesBoundaryChipEditor } from "./services-boundary-chip-editor";
import { useCaraSetupForm } from "./cara-setup-form-context";

export function StoreSetupView() {
  const form = useCaraSetupForm();

  return (
    <CaraSetupUnsavedGuard>
      <div className="relative h-full min-h-0 flex-1 overflow-hidden">
        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] items-start gap-3 bg-white">
          <ClistePageHeader
            tone="business"
            icon={Store}
            title="Setup"
            description="Opening hours, departments, and the answers Cara should give."
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

          <DashboardFormScrollRegion scrollClassName="bg-[#fbfcfb] divide-y divide-[#dfe7e2]">
            <DashboardAnimatedStack embedded>
              <SectionCard
                flat
                icon={Clock}
                title="Opening hours"
                description="When the store is open — Cara uses this when callers ask about times."
              >
                <OpeningHoursEditor
                  value={form.openingHoursSchedule}
                  onChange={form.setOpeningHoursSchedule}
                  open24_7={form.open24_7}
                  onOpen24_7Change={form.setOpen24_7}
                  bankHolidays={form.bankHolidays}
                  onBankHolidaysChange={form.setBankHolidays}
                  hoursNeverConfigured={form.hoursNeverConfigured}
                  variant="dashboard"
                />
              </SectionCard>

              <SectionCard
                flat
                title="Departments"
                description="Counters and desks callers ask for — Deli, Butcher, Bakery, Customer Service."
              >
                <Field
                  label="Add a department"
                  htmlFor="store-departments"
                  hint="Type a name, then comma — or press Enter or Add."
                >
                  <ServicesBoundaryChipEditor
                    kind="offered"
                    inputId="store-departments"
                    value={form.servicesItems}
                    onChange={(next) =>
                      form.setServicesItems(dedupeServiceChips(next))
                    }
                    otherList={form.servicesNotOfferedItems}
                    placeholder="e.g. Deli"
                  />
                </Field>
              </SectionCard>

              <CaraSetupTabAnswers />
            </DashboardAnimatedStack>
          </DashboardFormScrollRegion>
        </div>
      </div>
    </CaraSetupUnsavedGuard>
  );
}
