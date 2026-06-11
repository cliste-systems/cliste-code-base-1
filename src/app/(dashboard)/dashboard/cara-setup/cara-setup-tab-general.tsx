"use client";

import { useState } from "react";
import {
  Briefcase,
  Clock,
  Loader2,
  MapPin,
  Pause,
  PhoneCall,
  Play,
} from "lucide-react";

import { DashboardAnimatedGroup } from "@/components/dashboard/dashboard-animated-group";
import { Field } from "@/components/dashboard/field";
import { SectionCard } from "@/components/dashboard/section-card";
import { OpeningHoursEditor } from "@/components/agent-knowledge/opening-hours-editor";
import { DASHBOARD_INPUT_CLASS } from "@/components/dashboard/dashboard-surface";
import { speakVoicePreview } from "@/components/onboarding/onboarding-voice-preview";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_GREETING_CLOSING,
  defaultVoiceGreetingIntro,
  resolveVoiceGreetingPreview,
  voiceLegalDisclosure,
  VOICE_ASSISTANT_DEFAULT_NAME,
  VOICE_LEGAL_NOTICE_HINT,
} from "@/lib/voice-greeting";
import { cn } from "@/lib/utils";

import { useCaraSetupForm } from "./cara-setup-form-context";
import { CountyChipEditor } from "./county-chip-editor";
import { ServiceAreaExclusionsEditor } from "./service-area-exclusions-editor";

export function CaraSetupTabGeneral() {
  const form = useCaraSetupForm();
  const defaultIntro = defaultVoiceGreetingIntro(form.businessName);
  const assistantName = VOICE_ASSISTANT_DEFAULT_NAME;
  const legal = voiceLegalDisclosure(assistantName);
  const previewLine = resolveVoiceGreetingPreview(
    form.greetingIntro,
    assistantName,
    form.greetingClosing,
  );

  const [playing, setPlaying] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  async function handlePlayToggle() {
    if (playing || previewLoading) {
      setPlaying(false);
      return;
    }
    setPreviewLoading(true);
    const result = await speakVoicePreview(previewLine, {
      greetingIntro: form.greetingIntro,
      greetingClosing: form.greetingClosing,
    });
    setPreviewLoading(false);
    if (result.ok) {
      setPlaying(true);
    }
  }

  return (
    <DashboardAnimatedGroup className="space-y-6">
      <SectionCard
        flat
        icon={PhoneCall}
        title="Voice & greeting"
        description="What callers hear the moment your line is answered."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field
            label="Caller-facing name"
            htmlFor="cara-assistant-name"
            hint="Cara is your phone assistant on every call — this can't be changed."
          >
            <div
              id="cara-assistant-name"
              className="flex h-10 items-center rounded-lg border border-slate-200/90 bg-slate-50 px-3 text-[13px] font-medium text-[#0b1220]"
              aria-readonly="true"
            >
              {assistantName}
            </div>
          </Field>
          <Field
            label="Opening line"
            htmlFor="cara-greeting-intro"
            hint="Introduce your business — the AI and recording notice is added automatically."
          >
            <Input
              id="cara-greeting-intro"
              value={form.greetingIntro}
              placeholder={defaultIntro}
              onChange={(e) => form.setGreetingIntro(e.target.value)}
              className={DASHBOARD_INPUT_CLASS}
            />
          </Field>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
            Required notice
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
            {legal}
          </p>
          <p className="mt-1 text-[11.5px] text-slate-500">
            {VOICE_LEGAL_NOTICE_HINT}
          </p>
        </div>

        <Field
          label="Closing line"
          htmlFor="cara-greeting-closing"
          hint="A short invitation after the notice, e.g. “How can I help you today?”"
        >
          <Input
            id="cara-greeting-closing"
            value={form.greetingClosing}
            placeholder={DEFAULT_GREETING_CLOSING}
            onChange={(e) => form.setGreetingClosing(e.target.value)}
            className={DASHBOARD_INPUT_CLASS}
          />
        </Field>

        <GreetingPreviewRow
          line={previewLine}
          playing={playing}
          loading={previewLoading}
          onPlayToggle={() => void handlePlayToggle()}
        />
      </SectionCard>

      <SectionCard
        flat
        icon={Briefcase}
        title="Business basics"
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
        description="Counties you cover — add town exclusions below for places you don't serve."
      >
        <div className="space-y-5">
          <Field
            label="Counties covered"
            htmlFor="cara-service-area-counties"
            hint="Add each county you serve. Cara assumes the whole county unless you exclude a town below."
          >
            <CountyChipEditor
              inputId="cara-service-area-counties"
              value={form.serviceAreaItems}
              onChange={form.setServiceAreaItems}
            />
          </Field>
          <Field
            label="Town exclusions"
            htmlFor="cara-service-area-exclusions"
            hint="Optional — towns or areas within your counties that you don't cover."
          >
            <ServiceAreaExclusionsEditor
              inputId="cara-service-area-exclusions"
              value={form.serviceAreaExclusionItems}
              onChange={form.setServiceAreaExclusionItems}
            />
          </Field>
        </div>
      </SectionCard>
    </DashboardAnimatedGroup>
  );
}

function GreetingPreviewRow({
  line,
  playing,
  loading,
  onPlayToggle,
}: {
  line: string;
  playing: boolean;
  loading: boolean;
  onPlayToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm">
      <p className="min-w-0 flex-1 truncate text-[13px] text-[#0b1220]">
        &ldquo;{line}&rdquo;
      </p>
      <button
        type="button"
        onClick={onPlayToggle}
        disabled={loading}
        aria-label={playing ? "Pause preview" : "Play preview"}
        className={cn(
          "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full",
          "bg-[#0b1220] text-white transition-colors hover:bg-[#05070b]",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : playing ? (
          <Pause className="size-4" aria-hidden />
        ) : (
          <Play className="ml-0.5 size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
