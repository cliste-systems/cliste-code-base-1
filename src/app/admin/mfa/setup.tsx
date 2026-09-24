"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";

type Mode = "loading" | "enroll" | "verify" | "done";

export function AdminMfaSetup() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      const supabase = createClient();

      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalError) {
        if (!cancelled) {
          setError("Could not check MFA status. Refresh and try again.");
          setMode("verify");
        }
        return;
      }

      if (aal.currentLevel === "aal2") {
        if (!cancelled) {
          setMode("done");
          router.replace("/admin");
          router.refresh();
        }
        return;
      }

      const { data: factors, error: factorError } =
        await supabase.auth.mfa.listFactors();

      if (factorError) {
        if (!cancelled) {
          setError("Could not load your MFA factors.");
          setMode("verify");
        }
        return;
      }

      const totpFactors = factors.totp ?? [];
      const verifiedTotp = totpFactors.find(
        (factor) => factor.status === "verified",
      );

      if (verifiedTotp) {
        if (!cancelled) {
          setFactorId(verifiedTotp.id);
          setMode("verify");
        }
        return;
      }

      // Remove stale, unfinished TOTP enrolments so the QR code shown below
      // always corresponds to the factor being verified.
      for (const factor of totpFactors) {
        if (factor.status !== "verified") {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }

      const { data: enrolled, error: enrollError } =
        await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Cliste Systems Admin",
        });

      if (enrollError || !enrolled?.totp) {
        if (!cancelled) {
          setError(
            enrollError?.message ||
              "Could not start authenticator setup. Check Supabase MFA settings.",
          );
          setMode("verify");
        }
        return;
      }

      if (!cancelled) {
        setFactorId(enrolled.id);
        setQrCode(enrolled.totp.qr_code);
        setSecret(enrolled.totp.secret);
        setMode("enroll");
      }
    }

    void prepare();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function verify() {
    if (!factorId || !/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: verifyError } =
        await supabase.auth.mfa.challengeAndVerify({
          factorId,
          code: code.trim(),
        });

      if (verifyError) {
        setError(verifyError.message || "That verification code was not accepted.");
        return;
      }

      setMode("done");
      router.replace("/admin");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "loading") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Checking admin security…
      </div>
    );
  }

  if (mode === "done") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <CheckCircle2 className="size-5" aria-hidden />
        Verification complete.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {mode === "enroll" ? (
        <>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-slate-700" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Set up an authenticator app
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Scan this QR code with an authenticator app such as 1Password,
                  Microsoft Authenticator, Google Authenticator or Authy.
                </p>
              </div>
            </div>

            {qrCode ? (
              <div className="mt-4 flex justify-center rounded-xl bg-white p-4">
                {/* Supabase returns the QR code as a data URL. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCode}
                  alt="Authenticator setup QR code"
                  className="size-48"
                />
              </div>
            ) : null}

            {secret ? (
              <details className="mt-3 text-xs text-slate-600">
                <summary className="cursor-pointer font-medium text-slate-700">
                  Can’t scan the QR code?
                </summary>
                <p className="mt-2 break-all rounded-lg bg-white p-2 font-mono">
                  {secret}
                </p>
              </details>
            ) : null}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">
            Enter your authenticator code
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Your account already has MFA configured. Enter the current 6-digit
            code to continue.
          </p>
        </div>
      )}

      <div>
        <label
          htmlFor="admin-mfa-code"
          className="mb-1.5 block text-xs font-medium text-slate-700"
        >
          6-digit code
        </label>
        <input
          id="admin-mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") void verify();
          }}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center font-mono text-xl tracking-[0.35em] outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          placeholder="000000"
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={submitting || code.length !== 6 || !factorId}
        onClick={() => void verify()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {submitting ? "Verifying…" : "Verify and continue"}
      </button>
    </div>
  );
}
