import { createClient } from "@supabase/supabase-js";

import { supabaseFetch } from "./fetch-with-timeout";

/**
 * Service-role Supabase client — bypasses RLS. Server-only; never import in
 * Client Components or pass the key to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      "Founder admin needs SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase Dashboard → Project Settings → API → service_role secret). " +
        "Restart npm run dev after saving. Never commit this key."
    );
  }

  return createClient(url, key, {
    global: { fetch: supabaseFetch },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
