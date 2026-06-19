"use client";

import { Briefcase, Clock, MapPin, Sparkles } from "lucide-react";

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
import { CountyChipEditor } from "./county-chip-editor";
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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_11rem]">
          <Field
            label="Location"
            htmlFor="cara-location-address"
            hint="Street and town — Cara can give directions when callers ask where you are."
          >
            <Input
              id="cara-location-address"
              value={form.locationAddress}
              placeholder="Street, town"
              onChange={(e) => form.setLocationAddress(e.target.value)}
              className={DASHBOARD_INPUT_CLASS}
            />
          </Field>
          <Field
            label="Eircode"
            htmlFor="cara-location-eircode"
            hint="Optional but helps callers find you."
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
          hoursNote={form.hoursNote}
          onHoursNoteChange={form.setHoursNote}
          hoursNeverConfigured={form.hoursNeverConfigured}
          variant="dashboard"
        />
      </SectionCard>

      <SectionCard
        flat
        icon={MapPin}
        title="Service area"
        description="Where you're based and the counties you cover."
      >
        <div className="space-y-5">
          <Field
            label="Based in"
            htmlFor="cara-base-town"
            hint={copy.caraSetup.locationHint}
          >
            <Input
              id="cara-base-town"
              value={form.baseTown}
              placeholder="e.g. Letterkenny"
              onChange={(e) => form.setBaseTown(e.target.value)}
              className={DASHBOARD_INPUT_CLASS}
              autoComplete="address-level2"
            />
          </Field>
          <Field
            label="Counties covered"
            hint="Tap each county you serve."
          >
            <CountyChipEditor
              value={form.serviceAreaItems}
              onChange={form.setServiceAreaItems}
            />
          </Field>
        </div>
      </SectionCard>
    </DashboardAnimatedStack>
  );
}
