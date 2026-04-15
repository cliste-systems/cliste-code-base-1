"use client";

import { useEffect } from "react";

function hasAuthParamsInHash(hash: string): boolean {
  if (!hash.startsWith("#")) return false;
  const p = new URLSearchParams(hash.slice(1));
  return Boolean(
    p.get("access_token") ||
      p.get("refresh_token") ||
      p.get("token_hash") ||
      p.get("type") ||
      p.get("error") ||
      p.get("error_description")
  );
}

function hasAuthParamsInSearch(search: string): boolean {
  const p = new URLSearchParams(search);
  return Boolean(p.get("code") || p.get("token_hash") || p.get("type"));
}

/**
 * Password reset and magic links may land on /authenticate with auth params.
 * Forward to /auth/callback so session exchange completes automatically.
 */
export function AuthParamForwarder() {
  useEffect(() => {
    const href = window.location.href;
    const current = new URL(href);
    if (current.pathname !== "/authenticate") return;

    const shouldForward =
      hasAuthParamsInHash(current.hash) ||
      hasAuthParamsInSearch(current.search);
    if (!shouldForward) return;

    const target = new URL("/auth/callback", current.origin);
    target.search = current.search;
    target.hash = current.hash;
    window.location.replace(target.toString());
  }, []);

  return null;
}
