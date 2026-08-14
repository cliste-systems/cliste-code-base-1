"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

import { ErrorShell } from "@/components/errors/error-shell";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <ErrorShell
          title="Something went wrong"
          description="An unexpected error occurred. Our team has been notified."
          digest={error.digest}
          homeHref="/dashboard"
          homeLabel="Go to dashboard"
          onRetry={reset}
        />
      </body>
    </html>
  );
}
