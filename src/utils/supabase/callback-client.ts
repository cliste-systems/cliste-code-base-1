import { createBrowserClient } from "@supabase/ssr";

/**
 * Fresh client per /auth/callback visit so URL-based auth is evaluated for
 * this navigation (not a stale singleton from another page).
 */
export function createSupabaseCallbackClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { isSingleton: false }
  );
}
