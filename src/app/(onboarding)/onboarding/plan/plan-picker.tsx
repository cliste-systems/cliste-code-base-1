"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight } from "lucide-react";

import {
  LegalAcceptanceCheckbox,
  LegalDocLink,
} from "@/components/legal/legal-acceptance-checkbox";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import { OnboardingStepBackButton } from "@/components/onboarding/onboarding-step-back-button";
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
      className="flex w-full flex-col items-center gap-6"
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

      <div className="grid w-full gap-3.5 md:grid-cols-3">
        {selfServePlans.map((p) => {
          const selected = plan === p.tier;
          const popular = p.recommended;
          const isSubmitting = pending && submittingTier === p.tier;

          return (
            <div
              key={p.tier}
              className={cn(
                "flex flex-col p-4 transition-[border-color,box-shadow,transform] duration-200",
                ONBOARDING_SELECTION_CARD,
                popular &&
                  "border-[#0b1220]/20 shadow-[0_10px_32px_rgba(11,18,32,0.1)] md:-translate-y-0.5",
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
                  <span className="text-sm font-medium text-[#0b1220]">
                    {p.name}
                  </span>
                  {popular ? (
                    <span className="shrink-0 rounded-full bg-[#0b1220] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                      Popular
                    </span>
                  ) : null}
                </div>

                <p className="mt-1.5 text-[12px] font-light leading-snug text-slate-500">
                  {p.tagline}
                </p>

                <div className="mt-3.5 flex items-baseline gap-1">
                  <span className="text-[1.75rem] font-light leading-none tracking-tight text-[#0b1220]">
                    {formatEuro(
                      interval === "year" ? p.annualCents / 12 : p.monthlyCents,
                    )}
                  </span>
                  <span className="text-xs font-light text-slate-500">/mo</span>
                </div>

                <p className="mt-1 text-[10px] font-light text-slate-400">
                  14-day free trial
                  {interval === "year"
                    ? ` · then ${formatEuro(p.annualCents)}/yr`
                    : null}
                </p>

                <div className="mt-4 space-y-3">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-medium text-slate-600">
                      {p.includedMinutes.toLocaleString()} min / mo
                    </p>
                    <p className="text-[11px] font-medium text-slate-600">
                      {p.includedSms.toLocaleString()} SMS / mo
                    </p>
                  </div>
                  <div className="space-y-0.5 border-t border-slate-100 pt-3">
                    <p className="text-[10px] font-light text-slate-400">
                      {formatEuro(p.overageRateCents)}/min overage
                    </p>
                    <p className="text-[10px] font-light text-slate-400">
                      {formatEuro(p.smsOverageRateCents)}/SMS overage
                    </p>
                  </div>
                </div>

                <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-[12px] font-light leading-snug text-slate-600">
                  {p.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-slate-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </button>

              <PlanContinueButton
                tier={p.tier}
                disabled={pending}
                isSubmitting={isSubmitting}
                onContinue={() => {
                  setPlan(p.tier);
                  setSubmittingTier(p.tier);
                }}
              />
            </div>
          );
        })}
      </div>

      {customPlan ? (
        <div className="flex w-full flex-col items-start justify-between gap-3 rounded-xl border border-slate-200/75 bg-white/85 px-4 py-3 shadow-[0_4px_20px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:px-5">
          <div className="min-w-0 space-y-1">
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

      <LegalAcceptanceCheckbox
        id="acceptDpa"
        name="acceptDpa"
        className="w-full max-w-3xl"
      >
        I accept the{" "}
        <LegalDocLink href="/legal/dpa">Data Processing Agreement</LegalDocLink>{" "}
        so Cliste may process my callers&apos; data when I go live.
      </LegalAcceptanceCheckbox>

      {errorMessage ? (
        <p className="w-full max-w-lg rounded-md border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex w-full flex-col items-center gap-2">
        <OnboardingStepBackButton />
        <p className="mx-auto max-w-xs text-center text-[11px] font-light leading-relaxed text-slate-500">
          No charge for 14 days. Cancel anytime before your trial ends.
        </p>
      </div>
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
