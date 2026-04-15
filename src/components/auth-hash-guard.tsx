"use client";

import { useEffect } from "react";

function stripHashInPlace(): void {
  const u = new URL(window.location.href);
  u.hash = "";
  window.history.replaceState(window.history.state, "", u.toString());
}

/**
 * Cleans stale auth hash errors and forwards auth tokens to /auth/callback.
 * This prevents users landing on /dashboard with noisy `#error=...` fragments.
 */
export function AuthHashGuard() {
  useEffect(() => {
    const current = new URL(window.location.href);
    if (!current.hash.startsWith("#")) return;

    const params = new URLSearchParams(current.hash.slice(1));
    const hasTokenPayload = Boolean(
      params.get("access_token") ||
        params.get("refresh_token") ||
        params.get("token_hash") ||
        params.get("type")
    );
    const hasErrorPayload = Boolean(
      params.get("error") ||
        params.get("error_code") ||
        params.get("error_description")
    );

    if (current.pathname !== "/auth/callback" && hasTokenPayload) {
      const target = new URL("/auth/callback", current.origin);
      target.search = current.search;
      target.hash = current.hash;
      window.location.replace(target.toString());
      return;
    }

    if (hasErrorPayload && current.pathname !== "/auth/callback") {
      stripHashInPlace();
    }
  }, []);

  return null;
}
