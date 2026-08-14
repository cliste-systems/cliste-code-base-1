"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

import { ErrorShell } from "@/components/errors/error-shell";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <ErrorShell
      title="Dashboard unavailable"
      description="We could not load this page. You can try again or return to your dashboard home."
      digest={error.digest}
      homeHref="/dashboard"
      homeLabel="Dashboard home"
      onRetry={reset}
    />
  );
}
