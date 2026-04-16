import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/utils/supabase/server";

/**
 * Lightweight session helper for the public book.clistesystems.ie client
 * accounts. Unlike `dashboard-session`, we do NOT require a row in
 * `public.profiles` — operators/staff have profiles; end-customers do not.
 *
 * Note: all public pages (salon storefront, directory) render the heart
 * icon and Login button based on this value, so keep the query cheap.
 */
export type ClientAccountSession = {
  user: User;
};

export const getClientAccountSession = cache(
  async (): Promise<ClientAccountSession | null> => {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    return { user };
  },
);
