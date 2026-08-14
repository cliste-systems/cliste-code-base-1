"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

import { ErrorShell } from "@/components/errors/error-shell";

type AdminErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdminError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <ErrorShell
      title="Admin console error"
      description="This admin page failed to load. Try again or return to the admin home."
      digest={error.digest}
      homeHref="/admin"
      homeLabel="Admin home"
      onRetry={reset}
    />
  );
}
