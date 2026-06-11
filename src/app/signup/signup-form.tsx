"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

import {
  OnboardingFieldBox,
  OnboardingFieldSurfaceProvider,
} from "@/components/onboarding/onboarding-form-card";
import { OnboardingEnter } from "@/components/onboarding/onboarding-enter";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import {
  ONBOARDING_FIELD_INPUT,
  ONBOARDING_GLASS_PREVIEW,
} from "@/components/onboarding/onboarding-ui";
import {
  LegalAcceptanceCheckbox,
  LegalDocLink,
} from "@/components/legal/legal-acceptance-checkbox";
import { cn } from "@/lib/utils";
import type { BillingInterval, PlanTier } from "@/lib/cliste-plans";

import { startSignup, type SignupResult } from "./actions";

const INITIAL: SignupResult = { ok: false, message: "" };

type Props = {
  planTier: PlanTier | null;
  billingInterval: BillingInterval;
  selectedPlanName: string | null;
  selectedPlanPriceCents: number | null;
  billingIntervalLabel: "monthly" | "annual";
};

export function SignupForm({
  planTier,
  billingInterval,
  selectedPlanName,
  selectedPlanPriceCents,
  billingIntervalLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(
    async (_prev: SignupResult, formData: FormData) => {
      return startSignup(_prev, formData);
    },
    INITIAL,
  );

  const [showPw, setShowPw] = useState(false);
  const errorMessage = !state.ok && state.message ? state.message : null;

  return (
    <OnboardingFieldSurfaceProvider surface="profile">
      <form action={formAction} className="w-full space-y-3">
        {planTier ? (
          <input type="hidden" name="planTier" value={planTier} />
        ) : null}
        <input type="hidden" name="billingInterval" value={billingInterval} />

        {selectedPlanName && selectedPlanPriceCents != null ? (
          <OnboardingEnter tone="profile">
            <div className={cn(ONBOARDING_GLASS_PREVIEW, "rounded-2xl px-4 py-3.5")}>
              <p className="text-[14px] font-medium text-[#0b1220]">
                {selectedPlanName} · {formatEuro(selectedPlanPriceCents)}{" "}
                {billingIntervalLabel === "annual" ? "billed annually" : "/ month"}
              </p>
              <p className="mt-1 text-[12px] leading-snug text-slate-500">
                Payment is confirmed in the next step after your account is created.
              </p>
            </div>
          </OnboardingEnter>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <OnboardingFieldBox label="First name" htmlFor="firstName">
            <input
              id="firstName"
              name="firstName"
              type="text"
              required
              autoComplete="given-name"
              placeholder="Jane"
              className={ONBOARDING_FIELD_INPUT}
            />
          </OnboardingFieldBox>
          <OnboardingFieldBox label="Last name" htmlFor="lastName">
            <input
              id="lastName"
              name="lastName"
              type="text"
              required
              autoComplete="family-name"
              placeholder="Smith"
              className={ONBOARDING_FIELD_INPUT}
            />
          </OnboardingFieldBox>
        </div>

        <OnboardingFieldBox label="Business name" htmlFor="salonName">
          <input
            id="salonName"
            name="salonName"
            type="text"
            required
            autoComplete="organization"
            placeholder="e.g. Riverside Studio"
            className={ONBOARDING_FIELD_INPUT}
          />
        </OnboardingFieldBox>

        <OnboardingFieldBox label="Email address" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@business.ie"
            className={ONBOARDING_FIELD_INPUT}
          />
        </OnboardingFieldBox>

        <OnboardingFieldBox label="Password" htmlFor="password">
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPw ? "text" : "password"}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className={cn(ONBOARDING_FIELD_INPUT, "pr-10")}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute top-1/2 right-0 -translate-y-1/2 p-1 text-slate-400 transition-colors hover:text-[#0b1220]"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </OnboardingFieldBox>

        <LegalAcceptanceCheckbox id="acceptLegal" name="acceptLegal">
          I agree to the{" "}
          <LegalDocLink href="/legal/terms">terms of service</LegalDocLink> and{" "}
          <LegalDocLink href="/legal/privacy">privacy notice</LegalDocLink>.
        </LegalAcceptanceCheckbox>

        {errorMessage ? (
          <p className="text-center text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <OnboardingEnter tone="profile" className="flex justify-center pt-2">
          <OnboardingPrimaryButton
            type="submit"
            pending={pending}
            className="w-full max-w-none sm:min-w-[14rem]"
          >
            {pending ? "Creating your account…" : "Create account"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </OnboardingPrimaryButton>
        </OnboardingEnter>

      </form>
    </OnboardingFieldSurfaceProvider>
  );
}

function formatEuro(cents: number): string {
  const value = cents / 100;
  if (Number.isInteger(value)) return `€${value}`;
  return `€${value.toFixed(2)}`;
}
