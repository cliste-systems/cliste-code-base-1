"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";

import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import {
  OnboardingFieldBox,
  OnboardingFieldSurfaceProvider,
} from "@/components/onboarding/onboarding-form-card";
import { ONBOARDING_FIELD_INPUT } from "@/components/onboarding/onboarding-ui";
import { cn } from "@/lib/utils";

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
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
              setError(null);
            }}
            aria-invalid={Boolean(error)}
            className={cn(
              ONBOARDING_FIELD_INPUT,
              "text-center text-[20px] font-semibold tracking-[0.4em]",
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
          disabled={code.length !== 6}
          className="w-full max-w-none"
        >
          {pending ? "Verifying…" : "Verify and continue"}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </OnboardingPrimaryButton>

        <p className="text-center text-[12px] text-slate-500">
          Didn&apos;t get it? Check spam, or{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendPending}
            className="font-medium text-[#0b1220] underline underline-offset-2 disabled:opacity-60"
          >
            {resendPending ? "sending…" : "resend the email"}
          </button>
          .
        </p>
      </form>
    </OnboardingFieldSurfaceProvider>
  );
}
