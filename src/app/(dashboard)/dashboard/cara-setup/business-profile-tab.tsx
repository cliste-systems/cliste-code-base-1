"use client";

import { Briefcase, Clock, Sparkles } from "lucide-react";

import { DashboardAnimatedStack } from "@/components/dashboard/dashboard-animated-group";
import { Field } from "@/components/dashboard/field";
import { SectionCard } from "@/components/dashboard/section-card";
import { OpeningHoursEditor } from "@/components/agent-knowledge/opening-hours-editor";
import { DASHBOARD_INPUT_CLASS } from "@/components/dashboard/dashboard-surface";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useCaraSetupForm } from "./cara-setup-form-context";
import { useDashboardVertical } from "../dashboard-vertical-context";
import { ABOUT_PLACEHOLDER } from "@/app/(onboarding)/onboarding/knowledge/train-cara-constants";

export function BusinessProfileTab() {
  const form = useCaraSetupForm();
  const { copy } = useDashboardVertical();

  return (
    <DashboardAnimatedStack embedded>
      <SectionCard
        flat
        icon={Sparkles}
        title="About your business"
        description="What Cara should know when she describes who you are and what you do."
        className="w-full"
      >
        <Field
          label="Business description"
          htmlFor="cara-business-description"
          hint="Same notes you gave during setup — Cara weaves this into her phone guidance."
          className="w-full"
        >
          <Textarea
            id="cara-business-description"
            value={form.rawBusinessDescription}
            onChange={(event) => form.setRawBusinessDescription(event.target.value)}
            placeholder={ABOUT_PLACEHOLDER}
            rows={5}
            className={cn(
              DASHBOARD_INPUT_CLASS,
              "min-h-[8rem] w-full resize-y py-2.5 leading-relaxed",
            )}
          />
        </Field>
      </SectionCard>

      <SectionCard
        flat
        icon={Briefcase}
        title={copy.caraSetup.generalBasicsTitle}
        description="Type, location, and Eircode — the facts callers ask about most."
      >
        <Field
          label="Business type"
          htmlFor="cara-business-type"
          hint="Set when you joined — this can't be changed here."
        >
          <div
            id="cara-business-type"
            className={cn(
              "flex min-h-10 items-center rounded-lg border border-slate-200/90 bg-slate-50 px-3 py-2 text-[13px]",
              form.businessType.trim()
                ? "font-medium text-[#0b1220]"
                : "text-slate-500",
            )}
            aria-readonly="true"
          >
            {form.businessType.trim() || "Not set"}
          </div>
        </Field>
        <Field
          label="Street"
          htmlFor="cara-location-street"
          hint="Street address — Cara uses this when callers ask where you are."
        >
          <Input
            id="cara-location-street"
            value={form.locationAddress}
            placeholder="e.g. 14 Grafton Street"
            onChange={(e) => form.setLocationAddress(e.target.value)}
            className={DASHBOARD_INPUT_CLASS}
            autoComplete="street-address"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8.75rem]">
          <Field
            label="Town"
            htmlFor="cara-location-town"
            hint={copy.caraSetup.locationHint}
          >
            <Input
              id="cara-location-town"
              value={form.baseTown}
              placeholder="e.g. Dublin 2"
              onChange={(e) => form.setBaseTown(e.target.value)}
              className={DASHBOARD_INPUT_CLASS}
              autoComplete="address-level2"
            />
          </Field>
          <Field
            label="County"
            htmlFor="cara-location-county"
            hint="County or city — helps Cara answer location questions."
          >
            <Input
              id="cara-location-county"
              value={form.locationCounty}
              placeholder="e.g. Dublin"
              onChange={(e) => form.setLocationCounty(e.target.value)}
              className={DASHBOARD_INPUT_CLASS}
              autoComplete="address-level1"
            />
          </Field>
          <Field
            label="Eircode"
            htmlFor="cara-location-eircode"
            hint="Optional but helps callers find you."
            className="sm:col-span-2 lg:col-span-1"
          >
            <Input
              id="cara-location-eircode"
              value={form.locationEircode}
              placeholder="e.g. D06 X2P6"
              onChange={(e) =>
                form.setLocationEircode(e.target.value.toUpperCase())
              }
              className={DASHBOARD_INPUT_CLASS}
              autoComplete="postal-code"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        flat
        icon={Clock}
        title="Opening hours"
        description="When you're open — Cara uses this when callers ask about times."
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
    </DashboardAnimatedStack>
  );
}
