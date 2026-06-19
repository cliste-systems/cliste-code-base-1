"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";

import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import {
  OnboardingFieldBox,
  OnboardingFieldSurfaceProvider,
} from "@/components/onboarding/onboarding-form-card";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import { ONBOARDING_FIELD_INPUT } from "@/components/onboarding/onboarding-ui";
import { cn } from "@/lib/utils";

import {
  SIGNUP_EMAIL_OTP_INPUT_MAX,
  SIGNUP_EMAIL_OTP_LENGTH,
} from "@/lib/signup-email-otp";

import { resendSignupConfirmationEmail } from "../resend-confirmation";
import { verifySignupCode } from "../verify-code";

export function VerifyCodeForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [resendPending, startResendTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function handleVerify() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await verifySignupCode(email, code);
      if (result.ok) {
        router.replace("/auth/post-login");
        router.refresh();
        return;
      }
      setError(result.message);
    });
  }

  function handleResend() {
    setError(null);
    setNotice(null);
    startResendTransition(async () => {
      const result = await resendSignupConfirmationEmail(email);
      if (result.ok) {
        setCode("");
        setNotice("New code sent. Check your inbox.");
        return;
      }
      setError(result.message);
    });
  }

  return (
    <OnboardingFieldSurfaceProvider surface="profile">
      <div className="space-y-3">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            handleVerify();
          }}
        >
          <OnboardingFieldBox
            label="Verification code"
            htmlFor="verification-code"
            error={error ?? undefined}
            className="px-3.5 py-2.5"
          >
            <input
              id="verification-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
            maxLength={SIGNUP_EMAIL_OTP_INPUT_MAX}
            placeholder={"0".repeat(SIGNUP_EMAIL_OTP_LENGTH)}
            value={code}
            onChange={(event) => {
              setCode(
                event.target.value
                  .replace(/\D/g, "")
                  .slice(0, SIGNUP_EMAIL_OTP_INPUT_MAX),
              );
              setError(null);
            }}
            aria-invalid={Boolean(error)}
            className={cn(
              ONBOARDING_FIELD_INPUT,
              "text-center font-mono text-[15px] font-semibold tracking-[0.22em] sm:text-[17px] sm:tracking-[0.26em]",
            )}
            />
          </OnboardingFieldBox>

          <AuthFormAlert message={error} />
          {notice ? (
            <p className="text-[12px] leading-relaxed text-emerald-700">
              {notice}
            </p>
          ) : null}

          <OnboardingPrimaryButton
            type="submit"
            pending={pending}
            disabled={code.length !== SIGNUP_EMAIL_OTP_LENGTH}
            className="w-full max-w-none"
          >
            {pending ? "Verifying…" : "Verify and continue"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </OnboardingPrimaryButton>
        </form>

        <p className="text-center text-[12px] text-slate-500">
          Didn&apos;t get it? Check spam.
        </p>

        <button
          type="button"
          onClick={handleResend}
          disabled={resendPending}
          className={cn(
            "w-full cursor-pointer rounded-full border border-slate-200/90 bg-white/90 px-5 py-2.5 text-[13px] font-medium text-[#0b1220] shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition-[color,background-color,border-color,box-shadow] duration-200",
            "hover:border-slate-300 hover:bg-slate-100 hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)]",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {resendPending ? "Sending…" : "Resend email"}
        </button>
      </div>
    </OnboardingFieldSurfaceProvider>
  );
}
