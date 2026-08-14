import type { ErrorEvent, EventHint } from "@sentry/nextjs";

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const E164_RE = /\+[1-9]\d{7,14}\b/g;

function scrubString(value: string): string {
  return value
    .replace(E164_RE, "+***REDACTED***")
    .replace(EMAIL_RE, "***@redacted.invalid");
}

function scrubUnknown(value: unknown): unknown {
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map(scrubUnknown);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = scrubUnknown(nested);
    }
    return out;
  }
  return value;
}

export function scrubSentryEvent<T extends ErrorEvent>(event: T): T {
  if (event.message) {
    event.message = scrubString(event.message);
  }

  if (event.extra) {
    event.extra = scrubUnknown(event.extra) as typeof event.extra;
  }

  if (event.request) {
    if (event.request.headers) {
      event.request.headers = scrubUnknown(
        event.request.headers,
      ) as typeof event.request.headers;
    }
    if (event.request.data) {
      event.request.data = scrubUnknown(event.request.data);
    }
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      message: crumb.message ? scrubString(crumb.message) : crumb.message,
      data: crumb.data ? (scrubUnknown(crumb.data) as typeof crumb.data) : crumb.data,
    }));
  }

  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = scrubString(ex.value);
    }
  }

  return event;
}

export function createSentryBeforeSend() {
  return (event: ErrorEvent, _hint: EventHint) => scrubSentryEvent(event);
}

/** Scrub PII from observability `extra` payloads before `captureException`. */
export function scrubObservabilityExtra(
  extra?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!extra) return undefined;
  return scrubUnknown(extra) as Record<string, unknown>;
}
