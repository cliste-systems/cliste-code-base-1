/**
 * Validates required production configuration at boot.
 */

type EnvIssue = { key: string; message: string };

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

function requireVar(key: string, issues: EnvIssue[]): string | null {
  const value = process.env[key]?.trim();
  if (!value) {
    issues.push({ key, message: "required in production" });
    return null;
  }
  return value;
}

function forbidVar(key: string, issues: EnvIssue[]): void {
  if (process.env[key]?.trim() === "1") {
    issues.push({ key, message: "must not be enabled in production" });
  }
}

export function validateProductionEnv(): void {
  if (!isProd()) return;

  const issues: EnvIssue[] = [];

  requireVar("NEXT_PUBLIC_SUPABASE_URL", issues);
  requireVar("NEXT_PUBLIC_SUPABASE_ANON_KEY", issues);
  requireVar("SUPABASE_SERVICE_ROLE_KEY", issues);
  requireVar("CLISTE_EDGE_SHARED_SECRET", issues);
  requireVar("AUTH_RATE_LIMIT_SALT", issues);
  requireVar("CLISTE_SUPPORT_DASHBOARD_SECRET", issues);
  requireVar("SENTRY_DSN", issues);
  requireVar("STRIPE_WEBHOOK_SECRET", issues);
  requireVar("CRON_SECRET", issues);
  requireVar("CLISTE_VOICE_WEBHOOK_SECRET", issues);

  forbidVar("CLISTE_ALLOW_UNSIGNED_STRIPE_WEBHOOKS", issues);
  forbidVar("CLISTE_LOCAL_DASHBOARD_UNLOCK", issues);
  forbidVar("CLISTE_SIGNUP_ONBOARDING_DEV", issues);
  forbidVar("CLISTE_ONBOARDING_FREE_NAV", issues);
  forbidVar("CLISTE_ONBOARDING_PREVIEW", issues);
  forbidVar("DASHBOARD_HOME_MOCK", issues);
  forbidVar("CLISTE_VOICE_ALLOW_LEGACY_ORG_ID", issues);
  forbidVar("VOICE_SMS_ALLOW_ALL_COUNTRIES", issues);

  if (issues.length === 0) return;

  const lines = issues.map((i) => `  - ${i.key}: ${i.message}`);
  throw new Error(`Invalid production environment:\n${lines.join("\n")}`);
}
