"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "cliste_cookie_notice_v1_acknowledged";

/**
 * Lightweight cookie notice. We only set strictly-necessary + security
 * cookies (Supabase session, dashboard gates, Cloudflare Turnstile),
 * which under Irish ePrivacy Reg 5(5) are exempt from prior consent.
 *
 * This banner is therefore *informational* rather than a consent
 * gate — we display it once, link to the cookie policy, and let the
 * visitor dismiss it. If we ever add analytics or marketing cookies,
 * this component must be replaced with a real consent manager (with
 * "Reject all" given equal prominence to "Accept").
 */
export function CookieNoticeBanner() {
  // Hydration-safe: render nothing on the server, then on the first
  // client render check localStorage and decide whether to show the
  // banner. We track the "checked" state so the banner can re-mount
  // (e.g. after dismiss) without re-querying.
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // We have to flip both flags from inside the effect so the banner
    // never renders during SSR (no localStorage on the server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
    try {
      if (typeof window === "undefined") return;
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (seen) setDismissed(true);
    } catch {
      // localStorage may be blocked (Safari private mode etc); failing
      // closed (no banner) is fine — we're not legally required to show one.
      setDismissed(true);
    }
  }, []);

  const visible = hydrated && !dismissed;

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-3xl flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-lg sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="leading-snug">
        We only use strictly-necessary cookies (sign-in session, security,
        bot protection). No advertising or third-party analytics. See the{" "}
        <Link
          href="/legal/cookies"
          className="font-medium text-gray-900 underline underline-offset-2"
        >
          cookie policy
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="self-end rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 sm:self-auto"
      >
        OK, got it
      </button>
    </div>
  );
}
