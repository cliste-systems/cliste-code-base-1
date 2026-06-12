import * as Sentry from "@sentry/nextjs";

/**
 * Best-effort error capture — forwards to Sentry when configured.
 */
export async function captureObservedError(
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  console.error("[observability]", error, context ?? {});
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;
  Sentry.captureException(error, { extra: context });
}
