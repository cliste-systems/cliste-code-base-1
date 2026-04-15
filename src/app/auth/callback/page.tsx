"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseCallbackClient } from "@/utils/supabase/callback-client";

const EMAIL_OTP_TYPES = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function mergeAuthParamsFromUrl(href: string): Record<string, string> {
  const out: Record<string, string> = {};
  const url = new URL(href);
  if (url.hash.startsWith("#")) {
    new URLSearchParams(url.hash.slice(1)).forEach((value, key) => {
      out[key] = value;
    });
  }
  url.searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

const CALLBACK_CLAIM_PREFIX = "cliste_auth_cb:";

/** One-time Supabase params; React Strict Mode runs this effect twice in dev and would consume the link twice. */
function getCallbackClaimKey(params: Record<string, string>): string | null {
  if (params.token_hash && params.type) {
    return `${CALLBACK_CLAIM_PREFIX}otp:${params.type}:${params.token_hash}`;
  }
  const code = params.code;
  if (code) {
    return `${CALLBACK_CLAIM_PREFIX}pkce:${code}`;
  }
  if (params.access_token && params.refresh_token) {
    return `${CALLBACK_CLAIM_PREFIX}implicit:${params.access_token.slice(0, 64)}`;
  }
  return null;
}

type CallbackGate = "proceed" | "skip_wait" | "skip_done";

function tryBeginAuthCallback(claimKey: string | null): CallbackGate {
  if (!claimKey) return "proceed";
  try {
    const state = sessionStorage.getItem(claimKey);
    if (state === "done") return "skip_done";
    if (state === "processing") return "skip_wait";
    sessionStorage.setItem(claimKey, "processing");
  } catch {
    /* private mode / blocked storage — still try once */
  }
  return "proceed";
}

function finishAuthCallback(claimKey: string | null, success: boolean) {
  if (!claimKey) return;
  try {
    if (success) {
      sessionStorage.setItem(claimKey, "done");
    } else {
      sessionStorage.removeItem(claimKey);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Finishes Supabase email flows (invite, magic link, confirm signup).
 * Handles token_hash + type, PKCE ?code=, and implicit hash tokens (invite
 * often cannot use PKCE when the link is opened outside the tab that started
 * the flow — we recover via setSession from hash params).
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    let claimKey: string | null = null;
    void (async () => {
      try {
        const supabase = createSupabaseCallbackClient();

        const href = window.location.href;
        const params = mergeAuthParamsFromUrl(href);

        if (params.error || params.error_description) {
          const msg =
            params.error_description ||
            params.error ||
            "Sign-in link is invalid or expired.";
          setMessage(String(msg));
          router.replace(
            `/login?error=${encodeURIComponent(String(msg).slice(0, 200))}`
          );
          return;
        }

        claimKey = getCallbackClaimKey(params);
        const gate = tryBeginAuthCallback(claimKey);
        if (gate === "skip_done") {
          router.replace("/dashboard");
          router.refresh();
          return;
        }
        if (gate === "skip_wait") {
          return;
        }

        await supabase.auth.getSession();

        const tokenHash = params.token_hash;
        const otpType = params.type;
        if (
          tokenHash &&
          otpType &&
          EMAIL_OTP_TYPES.has(otpType)
        ) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType as
              | "signup"
              | "invite"
              | "magiclink"
              | "recovery"
              | "email_change"
              | "email",
          });
          if (error) {
            finishAuthCallback(claimKey, false);
            setMessage(error.message);
            router.replace(
              `/login?error=${encodeURIComponent(error.message)}`
            );
            return;
          }
          finishAuthCallback(claimKey, true);
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        const search = window.location.search;
        if (search.includes("code=")) {
          const { error } =
            await supabase.auth.exchangeCodeForSession(search);
          if (error) {
            finishAuthCallback(claimKey, false);
            setMessage(error.message);
            router.replace(
              `/login?error=${encodeURIComponent(error.message)}`
            );
            return;
          }
          finishAuthCallback(claimKey, true);
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        const accessToken = params.access_token;
        const refreshToken = params.refresh_token;
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            finishAuthCallback(claimKey, false);
            setMessage(error.message);
            router.replace(
              `/login?error=${encodeURIComponent(error.message)}`
            );
            return;
          }
          finishAuthCallback(claimKey, true);
          window.history.replaceState(
            window.history.state,
            "",
            `${window.location.pathname}${window.location.search}`
          );
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        finishAuthCallback(claimKey, false);
        setMessage("Could not complete sign-in.");
        router.replace(
          "/login?error=session&message=" +
            encodeURIComponent(
              "This sign-in link could not be completed. Try opening it in the same browser you use for the app, or request a new invite."
            )
        );
      } catch {
        finishAuthCallback(claimKey, false);
        setMessage("Something went wrong.");
        router.replace("/login?error=unknown");
      }
    })();
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
