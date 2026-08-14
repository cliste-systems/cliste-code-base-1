import * as Sentry from "@sentry/nextjs";

import { createSentryBeforeSend } from "./src/lib/sentry-scrub";

const dsn = process.env.SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
    sendDefaultPii: false,
    beforeSend: createSentryBeforeSend(),
  });
}
