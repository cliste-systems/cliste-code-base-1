"use client";

import { useState, useTransition } from "react";

import { AuthFormAlert } from "@/components/auth/auth-form-alert";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";

import { resendSignupConfirmationEmail } from "../resend-confirmation";

export function ResendConfirmationButton({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{
    kind: "ok" | "error";
    message: string;
  } | null>(null);

  function handleResend() {
    if (!email.trim()) return;
    setStatus(null);
    startTransition(async () => {
      const result = await resendSignupConfirmationEmail(email);
      if (result.ok) {
        setStatus({
          kind: "ok",
          message: "If that address has an unconfirmed account, we sent a new link.",
        });
        return;
      }
      setStatus({ kind: "error", message: result.message });
    });
  }

  return (
    <div className="space-y-3">
      <AuthFormAlert
        message={status?.kind === "error" ? status.message : null}
      />
      {status?.kind === "ok" ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-[13px] leading-relaxed text-emerald-950">
          {status.message}
        </p>
      ) : null}
      <OnboardingPrimaryButton
        type="button"
        pending={pending}
        onClick={handleResend}
        className="w-full max-w-none"
      >
        {pending ? "Sending…" : "Resend confirmation email"}
      </OnboardingPrimaryButton>
    </div>
  );
}
