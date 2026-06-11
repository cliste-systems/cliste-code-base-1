"use client";

import {
  ArrowRight,
  Check,
  Copy,
  Loader2,
  PhoneForwarded,
  RefreshCw,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { OnboardingEnter } from "@/components/onboarding/onboarding-enter";
import { ONBOARDING_EASE } from "@/components/onboarding/onboarding-motion";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import {
  ONBOARDING_FIELD_BOX,
  ONBOARDING_FIELD_INPUT,
  ONBOARDING_FIELD_LABEL,
  ONBOARDING_SELECTION_CARD,
  ONBOARDING_SELECTION_CARD_ACTIVE,
} from "@/components/onboarding/onboarding-ui";
import {
  CALL_ROUTING_MODES,
  CALL_ROUTING_MODE_META,
  CANCEL_ALL_FORWARDING_CODE,
  forwardingCodesForMode,
  type CallRoutingMode,
} from "@/lib/call-routing";
import { formatPhoneForDisplay } from "@/lib/phone-display";
import { cn } from "@/lib/utils";

import { retryNumberProvision, saveOnboardingNumber } from "./actions";

type Props = {
  phoneNumber: string | null;
  initialMode: CallRoutingMode;
  initialTransferPhone: string;
};

function useCopier() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  useEffect(() => {
    if (!copiedKey) return;
    const id = window.setTimeout(() => setCopiedKey(null), 1800);
    return () => window.clearTimeout(id);
  }, [copiedKey]);

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
    } catch {
      // Clipboard blocked — ignore.
    }
  }

  return { copiedKey, copy };
}

export function OnboardingNumberView({
  phoneNumber,
  initialMode,
  initialTransferPhone,
}: Props) {
  const [mode, setMode] = useState<CallRoutingMode>(initialMode);
  const [transferPhone, setTransferPhone] = useState(initialTransferPhone);
  const [displayNumber, setDisplayNumber] = useState(phoneNumber);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [retrying, startRetry] = useTransition();
  const { copiedKey, copy } = useCopier();

  const formatted = displayNumber
    ? formatPhoneForDisplay(displayNumber) || displayNumber
    : null;

  const forwardingCodes = useMemo(
    () => forwardingCodesForMode(mode, displayNumber ?? ""),
    [mode, displayNumber],
  );

  function handleRetry() {
    setError(null);
    startRetry(async () => {
      const res = await retryNumberProvision();
      if (res.ok) setDisplayNumber(res.phoneNumber);
      else setError(res.message);
    });
  }

  function handleContinue() {
    setError(null);
    startSave(async () => {
      const res = await saveOnboardingNumber({ mode, transferPhone });
      if (res && !res.ok) setError(res.message);
    });
  }

  return (
    <div className="flex w-full flex-col gap-3">
        <OnboardingEnter className="w-full">
          <div className={cn(ONBOARDING_FIELD_BOX, "flex items-center justify-between gap-3")}>
            <div className="min-w-0">
              <p className={ONBOARDING_FIELD_LABEL}>Your new Cliste number</p>
              {formatted ? (
                <p className="mt-1 text-[20px] font-semibold tracking-tight text-[#0b1220] tabular-nums">
                  {formatted}
                </p>
              ) : (
                <p className="mt-1 flex items-center gap-2 text-[13px] text-slate-500">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Setting up your Irish number…
                </p>
              )}
            </div>
            {formatted ? (
              <CopyButton
                copied={copiedKey === "cliste"}
                onClick={() => void copy("cliste", displayNumber ?? "")}
                label="Copy"
              />
            ) : (
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#0b1220] underline-offset-2 hover:underline disabled:opacity-50"
              >
                <RefreshCw className={cn("size-3.5", retrying && "animate-spin")} aria-hidden />
                {retrying ? "Trying…" : "Retry"}
              </button>
            )}
          </div>
        </OnboardingEnter>

        <OnboardingEnter className="flex w-full flex-col gap-2">
          {CALL_ROUTING_MODES.map((id) => (
            <RoutingModeOption
              key={id}
              id={id}
              active={mode === id}
              onSelect={setMode}
            />
          ))}
        </OnboardingEnter>

        <ModeDetailPanel
          mode={mode}
          transferPhone={transferPhone}
          onTransferPhoneChange={setTransferPhone}
          forwardingCodes={forwardingCodes}
          hasNumber={Boolean(displayNumber)}
          copiedKey={copiedKey}
          onCopy={copy}
        />

      {error ? (
        <p className="text-center text-[13px] text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <OnboardingEnter className="flex w-full flex-col items-center gap-2 pt-1">
        <OnboardingPrimaryButton
          type="button"
          pending={saving}
          onClick={handleContinue}
          className="min-w-[12rem]"
        >
          {saving ? "Saving…" : "Continue"}
          {!saving ? <ArrowRight className="size-4" aria-hidden /> : null}
        </OnboardingPrimaryButton>
        <p className="max-w-sm text-center text-[12px] leading-relaxed text-slate-400">
          {mode === "cliste_number"
            ? "Next, give Cara a quick test call."
            : "You can set up forwarding now or later."}
        </p>
      </OnboardingEnter>
    </div>
  );
}

const OPTION_MOTION_EASE = ONBOARDING_EASE;
const OPTION_MOTION_MS = 280;

function RoutingModeOption({
  id,
  active,
  onSelect,
}: {
  id: CallRoutingMode;
  active: boolean;
  onSelect: (mode: CallRoutingMode) => void;
}) {
  const meta = CALL_ROUTING_MODE_META[id];

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={active}
      className={cn(
        ONBOARDING_SELECTION_CARD,
        "px-4 py-2.5 text-left transition-[border-color,box-shadow,transform] duration-300 ease-out",
        active && ONBOARDING_SELECTION_CARD_ACTIVE,
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-[border-color,background-color,color] duration-300 ease-out",
            active
              ? "border-[#0b1220] bg-[#0b1220] text-white"
              : "border-slate-300 bg-white text-transparent",
          )}
          aria-hidden
        >
          <Check
            className={cn(
              "size-3 transition-[opacity,transform] duration-300 ease-out",
              active ? "scale-100 opacity-100" : "scale-75 opacity-0",
            )}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-snug text-[#0b1220]">
            {meta.title}
          </p>
          <div className="relative mt-0.5">
            <p
              className={cn(
                "text-[12.5px] leading-snug text-slate-500 transition-opacity ease-[cubic-bezier(0.22,1,0.36,1)]",
                active
                  ? "pointer-events-none absolute inset-x-0 top-0 opacity-0"
                  : "relative opacity-100",
              )}
              style={{ transitionDuration: `${OPTION_MOTION_MS}ms` }}
              aria-hidden={active}
            >
              {meta.tagline}
            </p>
            <div
              className={cn(
                "grid transition-[grid-template-rows] ease-[cubic-bezier(0.22,1,0.36,1)]",
                active ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
              style={{ transitionDuration: `${OPTION_MOTION_MS}ms` }}
            >
              <div className="min-h-0 overflow-hidden">
                <p
                  className={cn(
                    "text-[12.5px] leading-snug text-slate-500 transition-opacity ease-[cubic-bezier(0.22,1,0.36,1)]",
                    active ? "opacity-100" : "opacity-0",
                  )}
                  style={{ transitionDuration: `${OPTION_MOTION_MS}ms` }}
                  aria-hidden={!active}
                >
                  {meta.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function ModeDetailPanel({
  mode,
  transferPhone,
  onTransferPhoneChange,
  forwardingCodes,
  hasNumber,
  copiedKey,
  onCopy,
}: {
  mode: CallRoutingMode;
  transferPhone: string;
  onTransferPhoneChange: (value: string) => void;
  forwardingCodes: ReturnType<typeof forwardingCodesForMode>;
  hasNumber: boolean;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => Promise<void>;
}) {
  const reduceMotion = useReducedMotion();
  const showTransfer = mode === "cliste_number";
  const panelKey = showTransfer ? "transfer" : "forward";
  const panelTransition = reduceMotion
    ? { duration: 0 }
    : { duration: OPTION_MOTION_MS / 1000, ease: OPTION_MOTION_EASE };

  return (
    <motion.div
      key={panelKey}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={panelTransition}
      className="w-full will-change-[opacity]"
    >
      {showTransfer ? (
        <div className={ONBOARDING_FIELD_BOX}>
          <label htmlFor="transfer-phone" className={ONBOARDING_FIELD_LABEL}>
            Transfer to a person (optional)
          </label>
          <input
            id="transfer-phone"
            inputMode="tel"
            value={transferPhone}
            onChange={(e) => onTransferPhoneChange(e.target.value)}
            placeholder="+353…"
            className={ONBOARDING_FIELD_INPUT}
          />
          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
            When Cara can’t help, she’ll offer to put the caller through to this
            number. Leave blank and she’ll take a message instead.
          </p>
        </div>
      ) : (
        <ForwardingInstructions
          codes={forwardingCodes}
          hasNumber={hasNumber}
          copiedKey={copiedKey}
          onCopy={onCopy}
        />
      )}
    </motion.div>
  );
}

function ForwardingInstructions({
  codes,
  hasNumber,
  copiedKey,
  onCopy,
}: {
  codes: ReturnType<typeof forwardingCodesForMode>;
  hasNumber: boolean;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => Promise<void>;
}) {
  return (
    <div className={cn(ONBOARDING_FIELD_BOX, "px-4 py-3.5")}>
      <div className="flex items-center gap-2">
        <PhoneForwarded className="size-4 shrink-0 text-[#0b1220]" aria-hidden />
        <p className="text-[13px] font-semibold text-[#0b1220]">
          Forward your number to Cara
        </p>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
        From your business phone, dial a code and press call. Works on Eir, Vodafone,
        Three, and most Irish mobile networks.
      </p>

      <ul className="mt-2.5 space-y-2.5">
        {codes.map((code) => (
          <li key={code.kind}>
            <p className="text-[12.5px] font-medium text-[#0b1220]">{code.label}</p>
            <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
              {code.hint}
            </p>
            <div className="mt-2 flex items-stretch gap-2">
              <code className="min-w-0 flex-1 rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-2.5 font-mono text-[11.5px] leading-snug break-all text-[#0b1220] sm:text-[12px]">
                {code.activate}
              </code>
              <CopyButton
                copied={copiedKey === code.kind}
                onClick={() => void onCopy(code.kind, code.activate)}
                label="Copy"
                disabled={!hasNumber}
                className="self-center"
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11.5px] leading-relaxed text-slate-400">
        To turn forwarding off, dial{" "}
        <span className="font-mono text-slate-500">{CANCEL_ALL_FORWARDING_CODE}</span>.
        Landline?{" "}
        <a
          href="mailto:hello@clistesystems.ie"
          className="font-medium text-slate-500 underline-offset-2 hover:underline"
        >
          Email us
        </a>{" "}
        and we’ll help.
      </p>
    </div>
  );
}

function CopyButton({
  copied,
  onClick,
  label,
  disabled = false,
  className,
}: {
  copied: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-3 py-2 text-[12px] font-medium text-[#0b1220] transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50",
        className,
      )}
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-600" aria-hidden />
      ) : (
        <Copy className="size-3.5 text-slate-400" aria-hidden />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}
