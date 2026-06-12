"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import {
  LegalAcceptanceCheckbox,
  LegalDocLink,
} from "@/components/legal/legal-acceptance-checkbox";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import { ONBOARDING_EASE } from "@/components/onboarding/onboarding-motion";
import {
  ONBOARDING_SELECTION_CARD,
  ONBOARDING_SELECTION_CARD_ACTIVE,
} from "@/components/onboarding/onboarding-ui";
import { cn } from "@/lib/utils";
import type { BillingInterval, PlanTier } from "@/lib/cliste-plans";

import { startPlanCheckout } from "../actions";

type PlanRow = {
  tier: PlanTier;
  name: string;
  tagline: string;
  monthlyCents: number;
  annualCents: number;
  includedMinutes: number;
  includedSms: number;
  overageRateCents: number;
  smsOverageRateCents: number;
  applicationFeeBps: number;
  features: string[];
  recommended: boolean;
  selfServe: boolean;
};

type Props = {
  plans: PlanRow[];
  defaultPlan: PlanTier;
  defaultInterval: BillingInterval;
  initialError?: string | null;
};

const INITIAL = { ok: false as const, message: "" };
const CUSTOM_MAILTO =
  "mailto:hello@clistesystems.ie?subject=Cliste%20Custom%20plan";

export function PlanPicker({
  plans,
  defaultPlan,
  defaultInterval,
  initialError,
}: Props) {
  const selfServePlans = plans.filter((p) => p.selfServe);
  const customPlan = plans.find((p) => !p.selfServe);

  const defaultSelfServe =
    selfServePlans.find((p) => p.tier === defaultPlan)?.tier ??
    selfServePlans.find((p) => p.recommended)?.tier ??
    selfServePlans[0]?.tier ??
    "pro";

  const [plan, setPlan] = useState<PlanTier>(defaultSelfServe);
  const [interval, setInterval] = useState<BillingInterval>(defaultInterval);
  const [submittingTier, setSubmittingTier] = useState<PlanTier | null>(null);
  const reduceMotion = useReducedMotion();

  const [state, formAction, pending] = useActionState(
    async (_prev: { ok: false; message: string }, formData: FormData) =>
      startPlanCheckout(_prev, formData),
    INITIAL,
  );

  const errorMessage =
    (!state.ok && state.message ? state.message : null) ??
    (initialError
      ? "We couldn't confirm your payment. Please try again."
      : null);

  return (
    <form
      action={formAction}
      noValidate
      className="flex w-full flex-col items-center gap-4 text-center sm:gap-5"
    >
      <input type="hidden" name="interval" value={interval} />

      <div className="inline-flex rounded-full border border-slate-200/75 bg-white p-1 text-xs font-medium shadow-[0_4px_20px_rgba(15,23,42,0.06)]">
        <button
          type="button"
          onClick={() => setInterval("month")}
          className={cn(
            "cursor-pointer rounded-full px-4 py-1.5 transition",
            interval === "month"
              ? "bg-[#0b1220] text-white"
              : "text-slate-600",
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setInterval("year")}
          className={cn(
            "cursor-pointer rounded-full px-4 py-1.5 transition",
            interval === "year"
              ? "bg-[#0b1220] text-white"
              : "text-slate-600",
          )}
        >
          Annual{" "}
          <span className="text-[10px] font-normal opacity-80">
            (2 months free)
          </span>
        </button>
      </div>

      <div className="grid w-full gap-4 md:grid-cols-3 md:items-stretch">
        {selfServePlans.map((p) => {
          const selected = plan === p.tier;
          const popular = p.recommended;
          const isSubmitting = pending && submittingTier === p.tier;

          return (
            <div
              key={p.tier}
              className={cn(
                "flex min-h-[22rem] flex-col p-5 transition-[border-color,box-shadow,transform,min-height] duration-300 ease-out sm:min-h-[23.5rem] sm:p-6",
                ONBOARDING_SELECTION_CARD,
                popular &&
                  "border-[#0b1220]/20 shadow-[0_10px_32px_rgba(11,18,32,0.1)]",
                popular &&
                  selected &&
                  "border-[#0b1220]/30 shadow-[0_14px_40px_rgba(11,18,32,0.14)] ring-1 ring-[#0b1220]/12",
                !popular && selected && ONBOARDING_SELECTION_CARD_ACTIVE,
              )}
            >
              <button
                type="button"
                onClick={() => setPlan(p.tier)}
                aria-pressed={selected}
                className="flex flex-1 flex-col text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[15px] font-medium text-[#0b1220]">
                    {p.name}
                  </span>
                  {popular ? (
                    <span className="shrink-0 rounded-full bg-[#0b1220] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                      Popular
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-[12px] font-light leading-snug text-slate-500">
                  {p.tagline}
                </p>

                <div className="mt-4 flex items-baseline gap-1">
                  <motion.span
                    key={`${p.tier}-${interval}`}
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: ONBOARDING_EASE }}
                    className="text-[1.875rem] font-light leading-none tracking-tight text-[#0b1220] sm:text-[2rem]"
                  >
                    {formatEuro(
                      interval === "year" ? p.annualCents / 12 : p.monthlyCents,
                    )}
                  </motion.span>
                  <span className="text-xs font-light text-slate-500">/mo</span>
                </div>

                <AnimatePresence initial={false}>
                  {interval === "year" ? (
                    <motion.div
                      key={`${p.tier}-annual-billed`}
                      initial={
                        reduceMotion
                          ? false
                          : { height: 0, opacity: 0, marginTop: 0 }
                      }
                      animate={{ height: "auto", opacity: 1, marginTop: 4 }}
                      exit={{ height: 0, opacity: 0, marginTop: 0 }}
                      transition={{ duration: 0.32, ease: ONBOARDING_EASE }}
                      className="overflow-hidden"
                    >
                      <p className="text-[11px] font-light text-slate-400">
                        Billed {formatEuro(p.annualCents)}/yr
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <motion.div
                  layout={!reduceMotion}
                  transition={{ duration: 0.32, ease: ONBOARDING_EASE }}
                  className="mt-4 space-y-2 border-t border-slate-100 pt-4"
                >
                  <p className="text-[12px] font-medium text-slate-600">
                    {p.includedMinutes.toLocaleString()} min ·{" "}
                    {p.includedSms.toLocaleString()} SMS / mo
                  </p>
                  <p className="text-[11px] font-light text-slate-400">
                    {formatEuro(p.overageRateCents)}/min ·{" "}
                    {formatEuro(p.smsOverageRateCents)}/SMS overage
                  </p>
                </motion.div>

                <motion.ul
                  layout={!reduceMotion}
                  transition={{ duration: 0.32, ease: ONBOARDING_EASE }}
                  className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-[12px] font-light leading-snug text-slate-600"
                >
                  {p.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </motion.ul>
              </button>

              <motion.div
                layout={!reduceMotion}
                transition={{ duration: 0.32, ease: ONBOARDING_EASE }}
                className="w-full"
              >
              <PlanContinueButton
                tier={p.tier}
                disabled={pending}
                isSubmitting={isSubmitting}
                onContinue={() => {
                  setPlan(p.tier);
                  setSubmittingTier(p.tier);
                }}
              />
              </motion.div>
            </div>
          );
        })}
      </div>

      {customPlan ? (
        <div className="flex w-full flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200/75 bg-white/85 px-5 py-4 text-left shadow-[0_4px_20px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:px-6">
          <div className="min-w-0 space-y-1 sm:text-left">
            <p className="text-[14px] font-medium text-[#0b1220]">
              {customPlan.name} — talk to our team
            </p>
            <p className="text-[13px] font-light leading-relaxed text-slate-500">
              {customPlan.tagline}
            </p>
          </div>
          <Link
            href={CUSTOM_MAILTO}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-5 text-[13px] font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-[#0b1220]"
          >
            Talk to our team
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      ) : null}

      <div className="grid w-full gap-2.5 text-left md:grid-cols-2">
        <LegalAcceptanceCheckbox
          id="acceptCallerPrivacy"
          name="acceptCallerPrivacy"
          required={false}
          compact
          className="h-full"
        >
          I confirm I have added (or will display before go-live) caller privacy
          information on my website or in my premises — including that calls may be
          handled by an AI assistant and may be recorded and transcribed.
        </LegalAcceptanceCheckbox>

        <LegalAcceptanceCheckbox
          id="acceptDpa"
          name="acceptDpa"
          required={false}
          compact
          className="h-full"
        >
          I accept the{" "}
          <LegalDocLink href="/legal/dpa">Data Processing Agreement</LegalDocLink>{" "}
          so Cliste may process my callers&apos; data when I go live.
        </LegalAcceptanceCheckbox>
      </div>

      {errorMessage ? (
        <p className="w-full rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-center text-[12px] text-red-700">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}

function formatEuro(cents: number): string {
  const value = cents / 100;
  if (Number.isInteger(value)) return `€${value}`;
  return `€${value.toFixed(2)}`;
}

function PlanContinueButton({
  tier,
  disabled,
  isSubmitting,
  onContinue,
}: {
  tier: PlanTier;
  disabled: boolean;
  isSubmitting: boolean;
  onContinue: () => void;
}) {
  return (
    <OnboardingPrimaryButton
      type="submit"
      name="planTier"
      value={tier}
      disabled={disabled}
      pending={isSubmitting}
      onClick={onContinue}
      className="mt-4 w-full px-4 text-[13px]"
    >
      {isSubmitting ? "Continuing…" : "Continue"}
      {!isSubmitting ? <ArrowRight className="size-3.5" aria-hidden /> : null}
    </OnboardingPrimaryButton>
  );
}
