"use client";

import Link from "next/link";
import { Cookie } from "lucide-react";
import { useEffect, useState } from "react";

import { ONBOARDING_GLASS_FLOAT } from "@/components/onboarding/onboarding-ui";
import { cn } from "@/lib/utils";

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
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
    try {
      if (typeof window === "undefined") return;
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (seen) setDismissed(true);
    } catch {
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
      className={cn(
        ONBOARDING_GLASS_FLOAT,
        "fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-3xl items-center gap-2.5 rounded-xl px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
    >
      <Cookie
        className="hidden size-4 shrink-0 text-slate-500 sm:block"
        aria-hidden
      />
      <p className="min-w-0 flex-1 text-[12px] leading-snug text-slate-600 sm:text-[13px]">
        Strictly necessary cookies only — sign-in, security, bot protection. No
        ads or analytics.{" "}
        <Link
          href="/legal/cookies"
          className="font-medium text-[#0b1220] underline decoration-slate-300 underline-offset-2 hover:decoration-[#0b1220]"
        >
          Cookie policy
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 cursor-pointer rounded-lg bg-[#0b1220] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#05070b] sm:px-3.5"
      >
        Got it
      </button>
    </div>
  );
}
