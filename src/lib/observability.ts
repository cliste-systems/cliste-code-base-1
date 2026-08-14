import * as Sentry from "@sentry/nextjs";

import { scrubObservabilityExtra } from "@/lib/sentry-scrub";

/**
 * Best-effort error capture — forwards to Sentry when configured.
 */
export async function captureObservedError(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const scrubbed = scrubObservabilityExtra(context);
  console.error("[observability]", error, scrubbed ?? {});
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;
  Sentry.captureException(error, { extra: scrubbed });
}
