import "server-only";

/**
 * Local-only dashboard without signing in.
 *
 * Enable: `CLISTE_LOCAL_DASHBOARD_UNLOCK=1` in `.env.local`
 * Optional: `CLISTE_LOCAL_DASHBOARD_ORG_ID`, `CLISTE_LOCAL_DASHBOARD_PROFILE_ID`
 * Optional: `DASHBOARD_HOME_MOCK=1` for demo home charts
 *
 * Uses a real org when Supabase keys work; otherwise an offline preview
 * session so `/dashboard` still renders for local UI testing.
 *
 * **Never set in production.** Ignored when `NODE_ENV=production`.
 */
export function isLocalDashboardPreviewEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.CLISTE_LOCAL_DASHBOARD_UNLOCK === "1";
}

/** False for empty or `.env.example` placeholder service-role keys. */
export function supabaseServiceRoleLooksConfigured(): boolean {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!key || /^your_/i.test(key)) return false;
  return key.length > 20;
}
