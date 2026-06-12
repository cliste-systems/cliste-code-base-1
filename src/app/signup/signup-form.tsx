"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import type { TurnstileInstance } from "@marsidev/react-turnstile";

import { AuthInvisibleTurnstile } from "@/components/auth/auth-turnstile-field";
import {
  OnboardingFieldBox,
  OnboardingFieldRow,
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
import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import { cn } from "@/lib/utils";
import type { BillingInterval, PlanTier } from "@/lib/cliste-plans";

import { startSignup, type SignupResult } from "./actions";

const INITIAL: SignupResult = { ok: false, message: "" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SIGNUP_FIELD_BOX = "px-3.5 py-2.5";

type SignupFieldErrors = Partial<
  Record<
    "firstName" | "lastName" | "salonName" | "email" | "password" | "acceptLegal",
    string
  >
>;

function validateSignupFields(formData: FormData): SignupFieldErrors {
  const errors: SignupFieldErrors = {};
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const salonName = String(formData.get("salonName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!firstName) errors.firstName = "Enter your first name.";
  if (!lastName) errors.lastName = "Enter your last name.";
  if (!salonName || salonName.length < 2) {
    errors.salonName = "Enter your business name.";
  }
  if (!email || !EMAIL_RE.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  if (password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }
  if (formData.get("acceptLegal") !== "on") {
    errors.acceptLegal =
      "You must agree to the terms of service and privacy notice.";
  }

  return errors;
}

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
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [verifyingSecurity, setVerifyingSecurity] = useState(false);
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const turnstileSiteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  const errorMessage = !state.ok && state.message ? state.message : null;

  function clearFieldError(field: keyof SignupFieldErrors) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const errors = validateSignupFields(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    let token = turnstileToken;
    if (turnstileSiteKey) {
      if (!token) {
        setVerifyingSecurity(true);
        try {
          turnstileRef.current?.execute();
          const verified = await turnstileRef.current?.getResponsePromise(20_000);
          if (!verified) {
            throw new Error("missing token");
          }
          token = verified;
          setTurnstileToken(token);
        } catch {
          setFieldErrors({
            email: "Security check failed. Please try again.",
          });
          turnstileRef.current?.reset();
          setTurnstileToken(null);
          setVerifyingSecurity(false);
          return;
        }
        setVerifyingSecurity(false);
      }
      formData.set("turnstileToken", token);
    }

    setFieldErrors({});
    formAction(formData);
  }

  return (
    <OnboardingFieldSurfaceProvider surface="profile">
      <form
        action={formAction}
        onSubmit={handleSubmit}
        noValidate
        className="w-full space-y-2"
      >
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

        <OnboardingFieldRow className="grid gap-2 sm:grid-cols-2">
          <OnboardingFieldBox
            label="First name"
            htmlFor="firstName"
            error={fieldErrors.firstName}
            className={SIGNUP_FIELD_BOX}
          >
            <input
              id="firstName"
              name="firstName"
              type="text"
              autoComplete="given-name"
              placeholder="Jane"
              aria-invalid={Boolean(fieldErrors.firstName)}
              onChange={() => clearFieldError("firstName")}
              className={ONBOARDING_FIELD_INPUT}
            />
          </OnboardingFieldBox>
          <OnboardingFieldBox
            label="Last name"
            htmlFor="lastName"
            error={fieldErrors.lastName}
            className={SIGNUP_FIELD_BOX}
          >
            <input
              id="lastName"
              name="lastName"
              type="text"
              autoComplete="family-name"
              placeholder="Smith"
              aria-invalid={Boolean(fieldErrors.lastName)}
              onChange={() => clearFieldError("lastName")}
              className={ONBOARDING_FIELD_INPUT}
            />
          </OnboardingFieldBox>
        </OnboardingFieldRow>

        <OnboardingFieldBox
          label="Business name"
          htmlFor="salonName"
          error={fieldErrors.salonName}
          className={SIGNUP_FIELD_BOX}
        >
          <input
            id="salonName"
            name="salonName"
            type="text"
            autoComplete="organization"
            placeholder="e.g. Riverside Studio"
            aria-invalid={Boolean(fieldErrors.salonName)}
            onChange={() => clearFieldError("salonName")}
            className={ONBOARDING_FIELD_INPUT}
          />
        </OnboardingFieldBox>

        <OnboardingFieldBox
          label="Email address"
          htmlFor="email"
          error={fieldErrors.email}
          className={SIGNUP_FIELD_BOX}
        >
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@business.ie"
            aria-invalid={Boolean(fieldErrors.email)}
            onChange={() => clearFieldError("email")}
            className={ONBOARDING_FIELD_INPUT}
          />
        </OnboardingFieldBox>

        <OnboardingFieldBox
          label="Password"
          htmlFor="password"
          error={fieldErrors.password}
          className={SIGNUP_FIELD_BOX}
        >
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPw ? "text" : "password"}
              maxLength={128}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              aria-invalid={Boolean(fieldErrors.password)}
              onChange={() => clearFieldError("password")}
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

        <OnboardingEnter tone="profile">
          <div className="space-y-1">
            <LegalAcceptanceCheckbox
              id="acceptLegal"
              name="acceptLegal"
              required={false}
              compact
              onCheckedChange={() => clearFieldError("acceptLegal")}
              className={cn(
                fieldErrors.acceptLegal &&
                  "border-red-300/90 bg-red-50/60 ring-1 ring-red-200",
              )}
            >
              I agree to the{" "}
              <LegalDocLink href="/legal/terms">terms of service</LegalDocLink>{" "}
              and{" "}
              <LegalDocLink href="/legal/privacy">privacy notice</LegalDocLink>.
            </LegalAcceptanceCheckbox>
            {fieldErrors.acceptLegal ? (
              <p className="px-1 text-[11px] font-medium leading-snug text-red-600">
                {fieldErrors.acceptLegal}
              </p>
            ) : null}
          </div>
        </OnboardingEnter>

        {turnstileSiteKey ? (
          <AuthInvisibleTurnstile
            ref={turnstileRef}
            siteKey={turnstileSiteKey}
            onSuccess={setTurnstileToken}
            onExpire={() => setTurnstileToken(null)}
            onError={() => setTurnstileToken(null)}
          />
        ) : null}

        <AuthFormAlert message={errorMessage || null} />

        <OnboardingEnter tone="profile" className="flex justify-center pt-0.5">
          <OnboardingPrimaryButton
            type="submit"
            pending={pending || verifyingSecurity}
            className="w-full max-w-none sm:min-w-[14rem]"
          >
            {verifyingSecurity
              ? "Verifying…"
              : pending
                ? "Creating your account…"
                : "Create account"}
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
