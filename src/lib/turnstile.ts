/**
 * Cloudflare Turnstile verification for public-facing forms (login, etc.).
 */

/**
 * Verify Cloudflare Turnstile token (server).
 *
 * Turnstile is enforced only when **both** `TURNSTILE_SECRET_KEY` and
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are set. In **production** we additionally
 * require both to be present — silently skipping bot challenge when env
 * vars are misconfigured opens endpoints to scripted abuse. In dev we still
 * allow skipping so local development isn't blocked by Turnstile setup.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const turnstileEnabled = Boolean(secret && siteKey);

  if (!turnstileEnabled) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[turnstile] production request but TURNSTILE_SECRET_KEY / NEXT_PUBLIC_TURNSTILE_SITE_KEY not configured — refusing.",
      );
      return {
        ok: false,
        message: "Request is temporarily unavailable. Please try again shortly.",
      };
    }
    return { ok: true };
  }

  const t = token?.trim();
  if (!t) {
    return { ok: false, message: "Please complete the security check." };
  }
  const secretKey = secret!;
  try {
    const body = new URLSearchParams();
    body.set("secret", secretKey);
    body.set("response", t);
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      },
    );
    const json = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (json.success === true) return { ok: true };
    return {
      ok: false,
      message: "Security check failed. Please try again.",
    };
  } catch {
    return { ok: false, message: "Could not verify security check." };
  }
}
