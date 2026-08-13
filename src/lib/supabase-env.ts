/** Hosted Supabase URL + anon key (tenant sign-in, session refresh). */
export function isSupabasePublicConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

/** Service-role key for server-side admin queries. */
export function isSupabaseServiceConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

/**
 * Local dev: the admin password gate is enough to browse the console shell.
 * Production always requires a real Supabase admin session.
 */
export function allowAdminDevWithoutSupabase(): boolean {
  return process.env.NODE_ENV !== "production" && !isSupabasePublicConfigured();
}
