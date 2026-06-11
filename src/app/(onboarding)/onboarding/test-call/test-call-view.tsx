"use client";

import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Loader2,
  Phone,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { OnboardingEnter } from "@/components/onboarding/onboarding-enter";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import {
  ONBOARDING_FIELD_BOX,
  ONBOARDING_FIELD_LABEL,
  ONBOARDING_SECONDARY_BUTTON,
} from "@/components/onboarding/onboarding-ui";
import { formatPhoneForDisplay } from "@/lib/phone-display";
import { cn } from "@/lib/utils";

import {
  checkTestCallReceived,
  completeTestCallStep,
  retryPhoneProvision,
} from "./actions";

type Props = {
  phoneNumber: string | null;
  allowProceedWithoutCall: boolean;
  suggestedPrompts?: string[];
};

const POLL_MS = 3000;
const TIMEOUT_AFTER_POLLS = 30;

const DEFAULT_PROMPTS = [
  "What are your opening hours?",
  "Do you have availability this week?",
  "Can I speak to someone?",
];

function mergePrompts(suggested?: string[]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const raw of suggested ?? []) {
    const prompt = String(raw ?? "").trim();
    if (!prompt) continue;
    const key = prompt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(prompt);
  }

  for (const fallback of DEFAULT_PROMPTS) {
    if (merged.length >= 3) break;
    const key = fallback.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(fallback);
  }

  return merged.slice(0, 3);
}

export function TestCallView({
  phoneNumber,
  allowProceedWithoutCall,
  suggestedPrompts,
}: Props) {
  const [displayNumber, setDisplayNumber] = useState(phoneNumber);
  const [callReceived, setCallReceived] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [finishing, startFinish] = useTransition();
  const [retrying, startRetry] = useTransition();

  const formatted = displayNumber
    ? formatPhoneForDisplay(displayNumber) || displayNumber
    : null;

  const prompts = useMemo(
    () => mergePrompts(suggestedPrompts),
    [suggestedPrompts],
  );

  const canFinish = callReceived || allowProceedWithoutCall;
  const timedOut = pollCount >= TIMEOUT_AFTER_POLLS;
  const waiting = Boolean(formatted) && !callReceived;

  useEffect(() => {
    if (!displayNumber || callReceived) return;

    let cancelled = false;

    async function poll() {
      const result = await checkTestCallReceived();
      if (cancelled) return;
      if (result.received) {
        setCallReceived(true);
      } else {
        setPollCount((n) => n + 1);
      }
    }

    void poll();
    const id = window.setInterval(() => {
      void poll();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [displayNumber, callReceived]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  function handleRetryProvision() {
    setProvisionError(null);
    startRetry(async () => {
      const result = await retryPhoneProvision();
      if (result.ok) {
        setDisplayNumber(result.phoneNumber);
      } else {
        setProvisionError(result.message);
      }
    });
  }

  function handleFinish() {
    startFinish(async () => {
      await completeTestCallStep();
    });
  }

  async function handleCopyNumber() {
    if (!displayNumber) return;
    try {
      await navigator.clipboard.writeText(displayNumber);
      setCopied(true);
    } catch {
      // Clipboard may be blocked — ignore.
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <OnboardingEnter className="w-full max-w-md">
        {formatted ? (
          <div
            className={cn(
              ONBOARDING_FIELD_BOX,
              "overflow-hidden px-0 py-0",
              callReceived && "border-emerald-200/90 ring-1 ring-emerald-100",
            )}
          >
            <div className="px-5 pb-4 pt-5 text-center">
              <p className={ONBOARDING_FIELD_LABEL}>Your Cliste number</p>

              <p
                className={cn(
                  "mt-3 text-[2rem] font-semibold leading-none tracking-tight text-[#0b1220] tabular-nums sm:text-[2.25rem]",
                  callReceived && "text-emerald-800",
                )}
              >
                {formatted}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {callReceived ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[13px] font-medium text-emerald-700">
                    <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
                    Cara answered — she&apos;s ready
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleCopyNumber()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-[#0b1220]"
                  >
                    <Copy className="size-3.5" aria-hidden />
                    {copied ? "Copied" : "Copy number"}
                  </button>
                )}
              </div>
            </div>

            {waiting ? (
              <div className="border-t border-slate-200/70 bg-slate-50/60 px-5 py-4">
                <p className="text-center text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
                  Try asking Cara
                </p>
                <ul className="mt-3 space-y-2">
                  {prompts.map((prompt, index) => (
                    <li
                      key={prompt}
                      className="flex justify-center"
                      style={{ paddingLeft: `${index * 6}px` }}
                    >
                      <span
                        className={cn(
                          "inline-block max-w-full rounded-2xl rounded-bl-md border border-slate-200/80 bg-white px-3.5 py-2.5",
                          "text-[13px] leading-snug text-[#0b1220] shadow-[0_2px_10px_rgba(15,23,42,0.04)]",
                        )}
                      >
                        &ldquo;{prompt}&rdquo;
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div
            className={cn(
              ONBOARDING_FIELD_BOX,
              "flex flex-col items-center gap-3 px-5 py-8 text-center",
            )}
          >
            <Loader2
              className="size-7 animate-spin text-slate-400"
              aria-hidden
            />
            <p className="max-w-xs text-[13px] leading-relaxed text-slate-500">
              We&apos;re setting up your Irish number. This usually takes a few
              seconds.
            </p>
            <button
              type="button"
              disabled={retrying}
              onClick={handleRetryProvision}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#0b1220] underline-offset-2 hover:underline disabled:opacity-50"
            >
              <RefreshCw
                className={cn("size-3.5", retrying && "animate-spin")}
                aria-hidden
              />
              {retrying ? "Trying again…" : "Try again"}
            </button>
          </div>
        )}
      </OnboardingEnter>

      {provisionError ? (
        <p className="text-center text-[13px] text-red-600" role="alert">
          {provisionError}
        </p>
      ) : null}

      {formatted ? (
        <OnboardingEnter className="flex w-full flex-col items-center gap-2.5">
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
            {waiting ? (
              <a
                href={`tel:${displayNumber}`}
                className={ONBOARDING_SECONDARY_BUTTON}
              >
                <Phone className="size-4" aria-hidden />
                Call now
              </a>
            ) : null}
            <OnboardingPrimaryButton
              type="button"
              disabled={!canFinish}
              pending={finishing}
              onClick={handleFinish}
              className={cn("min-w-[11rem]", callReceived && "min-w-[220px]")}
            >
              {finishing ? "Continuing…" : "Continue"}
              {!finishing ? <ArrowRight className="size-4" aria-hidden /> : null}
            </OnboardingPrimaryButton>
          </div>

          {waiting ? (
            <div className="flex flex-col items-center gap-1.5">
              <p className="max-w-sm text-center text-[12px] leading-relaxed text-slate-400">
                Continue unlocks once Cara picks up. Next you&apos;ll pick a plan
                to go live.
              </p>
              {!allowProceedWithoutCall ? (
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={finishing}
                  className="text-[12px] font-medium text-slate-500 underline-offset-2 hover:text-[#0b1220] hover:underline disabled:opacity-50"
                >
                  I&apos;ll test Cara later
                </button>
              ) : null}
              {timedOut ? (
                <p className="mt-1 max-w-sm text-center text-[12px] leading-relaxed text-amber-700">
                  Still nothing? Dial the number above from another phone. If
                  Cara doesn&apos;t answer, email hello@clistesystems.ie and
                  we&apos;ll jump in.
                </p>
              ) : null}
            </div>
          ) : null}
        </OnboardingEnter>
      ) : null}
    </div>
  );
}
