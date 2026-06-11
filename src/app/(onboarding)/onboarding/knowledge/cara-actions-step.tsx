"use client";

import { Check, PhoneForwarded } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  CaraTrainingStepShell,
  TRAINING_SURFACE,
} from "./cara-training-step-shell";
import {
  CARA_HANDLE_PICKER_OPTIONS,
  ONBOARDING_HANDLE_PICKER_IDS,
  type CaraHandleOptionId,
  type CaraHandlePickerOptionId,
} from "./train-cara-constants";

type DestinationKind = "link" | "email" | "whatsapp" | null;

const DESTINATION_BY_ID: Record<string, DestinationKind> = {
  send_link: "link",
  email_request: "email",
  send_whatsapp: "whatsapp",
  capture_quote_requests: null,
};

const PICKER_OPTIONS = CARA_HANDLE_PICKER_OPTIONS.filter((option) =>
  (ONBOARDING_HANDLE_PICKER_IDS as readonly string[]).includes(option.id),
);

const INLINE_INPUT = cn(
  "w-full rounded-xl border border-slate-200/70 bg-white px-3.5 py-2.5",
  "text-[14px] text-[#0b1220] outline-none transition-[border-color,box-shadow] duration-200",
  "placeholder:text-slate-400/80",
  "focus:border-[#0b1220]/15 focus:shadow-[0_8px_24px_rgba(15,23,42,0.06)]",
  "disabled:opacity-60",
);

type Props = {
  title: string;
  subtitle: string;
  helper?: string;
  selected: CaraHandleOptionId[];
  onToggle: (id: CaraHandlePickerOptionId) => void;
  linkUrl: string;
  onLinkUrlChange: (value: string) => void;
  emailAddress: string;
  onEmailChange: (value: string) => void;
  whatsappContact: string;
  onWhatsappChange: (value: string) => void;
  transferPhone: string;
  onTransferChange: (value: string) => void;
  disabled?: boolean;
};

export function CaraActionsStep(props: Props) {
  const selectedSet = new Set(props.selected);

  function destinationValue(kind: DestinationKind): string {
    if (kind === "link") return props.linkUrl;
    if (kind === "email") return props.emailAddress;
    if (kind === "whatsapp") return props.whatsappContact;
    return "";
  }

  function destinationConfig(kind: DestinationKind): {
    placeholder: string;
    type: string;
    label: string;
    onChange: (value: string) => void;
  } | null {
    if (kind === "link") {
      return {
        placeholder: "https://yourbusiness.ie/book",
        type: "url",
        label: "Link to send",
        onChange: props.onLinkUrlChange,
      };
    }
    if (kind === "email") {
      return {
        placeholder: "you@yourbusiness.ie",
        type: "email",
        label: "Where to email requests",
        onChange: props.onEmailChange,
      };
    }
    if (kind === "whatsapp") {
      return {
        placeholder: "+353 …",
        type: "tel",
        label: "WhatsApp number",
        onChange: props.onWhatsappChange,
      };
    }
    return null;
  }

  return (
    <CaraTrainingStepShell
      title={props.title}
      subtitle={props.subtitle}
      helper={props.helper}
    >
      <div className="w-full space-y-2.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
          Cara always answers questions and takes a message
        </p>

        <div className="grid gap-2.5">
          {PICKER_OPTIONS.map((option) => {
            const isSelected = selectedSet.has(option.id);
            const kind = DESTINATION_BY_ID[option.id] ?? null;
            const dest = destinationConfig(kind);

            return (
              <div
                key={option.id}
                className={cn(
                  TRAINING_SURFACE,
                  "p-3.5 transition-[border-color,box-shadow] duration-200",
                  isSelected &&
                    "border-[#0b1220]/20 shadow-[0_12px_40px_rgba(15,23,42,0.08)] ring-1 ring-[#0b1220]/10",
                )}
              >
                <button
                  type="button"
                  disabled={props.disabled}
                  onClick={() => props.onToggle(option.id)}
                  aria-pressed={isSelected}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition",
                      isSelected
                        ? "border-[#0b1220] bg-[#0b1220] text-white"
                        : "border-slate-300 bg-white text-transparent",
                    )}
                    aria-hidden
                  >
                    <Check className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-[#0b1220]">
                      {option.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] font-light leading-snug text-slate-500">
                      {option.description}
                    </span>
                  </span>
                </button>

                {isSelected && dest ? (
                  <div className="mt-3">
                    <input
                      type={dest.type}
                      value={destinationValue(kind)}
                      onChange={(e) => dest.onChange(e.target.value)}
                      placeholder={dest.placeholder}
                      aria-label={dest.label}
                      disabled={props.disabled}
                      className={INLINE_INPUT}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className={cn(TRAINING_SURFACE, "p-3.5")}>
          <div className="flex items-center gap-2">
            <PhoneForwarded className="size-4 text-slate-500" aria-hidden />
            <p className="text-[14px] font-medium text-[#0b1220]">
              Transfer to a person
            </p>
            <span className="ml-auto text-[11px] font-light text-slate-400">
              Optional
            </span>
          </div>
          <p className="mt-1 text-[12px] font-light leading-snug text-slate-500">
            If Cara can&apos;t help, she&apos;ll offer to put the caller through
            to this number.
          </p>
          <div className="mt-3">
            <input
              type="tel"
              value={props.transferPhone}
              onChange={(e) => props.onTransferChange(e.target.value)}
              placeholder="+353 …"
              aria-label="Transfer number"
              disabled={props.disabled}
              className={INLINE_INPUT}
            />
          </div>
        </div>
      </div>
    </CaraTrainingStepShell>
  );
}
