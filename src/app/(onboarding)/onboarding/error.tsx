"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

import { ErrorShell } from "@/components/errors/error-shell";

type OnboardingErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function OnboardingError({ error, reset }: OnboardingErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <ErrorShell
      title="Setup interrupted"
      description="Something went wrong during onboarding. Try again or continue from your current step."
      digest={error.digest}
      homeHref="/onboarding"
      homeLabel="Continue setup"
      onRetry={reset}
    />
  );
}
