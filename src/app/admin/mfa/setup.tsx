"use client";

import {
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";

type Mode = "loading" | "enroll" | "verify" | "done";

export function AdminMfaSetup() {
  const router = useRouter();
  const codeInputRef = useRef<HTMLInputElement>(null);
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

      const prepareResponse = await fetch("/api/admin/mfa/prepare", {
        method: "POST",
        cache: "no-store",
      });

      if (!prepareResponse.ok) {
        const prepareBody = (await prepareResponse.json().catch(() => null)) as
          | { error?: string; code?: string }
          | null;

        if (prepareBody?.code === "gate_required") {
          window.location.assign("/admin/login");
          return;
        }
        if (prepareBody?.code === "session_required") {
          window.location.assign("/authenticate");
          return;
        }

        if (!cancelled) {
          setError(
            prepareBody?.error ||
              "Could not reset the unfinished authenticator setup.",
          );
          setMode("verify");
        }
        return;
      }

      const enrollmentSuffix =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID().slice(0, 8)
          : Date.now().toString(36);

      const { data: enrolled, error: enrollError } =
        await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `Cliste Systems Admin ${enrollmentSuffix}`,
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

  useEffect(() => {
    if (mode === "verify") {
      codeInputRef.current?.focus();
    }
  }, [mode]);

  async function verify() {
    if (!factorId || !/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your authenticator app.");
      codeInputRef.current?.focus();
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
        setError(
          verifyError.message || "That verification code was not accepted.",
        );
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
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
            <Loader2 className="size-4 animate-spin text-slate-600" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Preparing secure verification
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Checking your account security…
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "done") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <CheckCircle2 className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-emerald-950">
              Verification complete
            </p>
            <p className="mt-0.5 text-xs text-emerald-700">
              Taking you to the admin console…
            </p>
          </div>
        </div>
      </div>
    );
  }

  const digits = Array.from({ length: 6 }, (_, index) => code[index] ?? "");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Authenticator", complete: mode === "verify" },
          { label: "Code", complete: false },
          { label: "Admin", complete: false },
        ].map((item, index) => {
          const active =
            (mode === "enroll" && index === 0) ||
            (mode === "verify" && index === 1);

          return (
            <div
              key={item.label}
              className={[
                "rounded-xl border px-3 py-2 transition-colors",
                active
                  ? "border-slate-300 bg-slate-50"
                  : "border-slate-200 bg-white",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold tracking-[0.12em] text-slate-400">
                  0{index + 1}
                </span>
                {item.complete ? (
                  <Check className="size-3.5 text-slate-700" aria-hidden />
                ) : null}
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-700">
                {item.label}
              </p>
            </div>
          );
        })}
      </div>

      {mode === "enroll" ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
              <ScanLine className="size-4 text-slate-700" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">
                Scan with your authenticator app
              </p>
              <p className="mt-1 text-xs leading-4.5 text-slate-500">
                Use 1Password, Microsoft Authenticator, Google Authenticator,
                Authy or Apple Passwords.
              </p>
            </div>
          </div>

          {qrCode ? (
            <div className="mt-3 flex justify-center">
              <div className="rounded-[20px] border border-slate-200 bg-white p-3 shadow-sm">
                {/* Supabase returns the QR code as a data URL. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCode}
                  alt="Authenticator setup QR code"
                  className="size-36 sm:size-40"
                />
              </div>
            </div>
          ) : null}

          {secret ? (
            <details className="group mt-3 rounded-xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-xs font-medium text-slate-700">
                Can’t scan the QR code?
                <ChevronDown className="size-3.5 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-slate-100 px-3.5 py-2.5">
                <p className="text-[11px] leading-5 text-slate-500">
                  Enter this setup key manually in your authenticator app.
                </p>
                <p className="mt-2 break-all rounded-lg bg-slate-50 p-2.5 font-mono text-[11px] text-slate-700">
                  {secret}
                </p>
              </div>
            </details>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
              <ShieldCheck className="size-4 text-slate-700" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-950">
                Authenticator ready
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Open your authenticator app and enter the current 6-digit code.
              </p>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label
            htmlFor="admin-mfa-code"
            className="text-xs font-semibold text-slate-700"
          >
            Verification code
          </label>
          <span className="text-[10px] text-slate-400">6 digits</span>
        </div>

        <div
          className="relative cursor-text"
          onClick={() => codeInputRef.current?.focus()}
        >
          <input
            ref={codeInputRef}
            id="admin-mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(event) => {
              setError(null);
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") void verify();
            }}
            className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
            aria-label="6-digit authenticator code"
          />

          <div className="grid grid-cols-6 gap-1.5">
            {digits.map((digit, index) => (
              <div
                key={index}
                className={[
                  "flex h-12 min-w-0 items-center justify-center rounded-xl border bg-white font-mono text-lg font-semibold shadow-sm transition",
                  code.length === index
                    ? "border-slate-400 ring-2 ring-slate-200"
                    : "border-slate-200",
                ].join(" ")}
                aria-hidden
              >
                {digit || (
                  <span className="size-1.5 rounded-full bg-slate-200" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-5 text-red-700">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        disabled={submitting || code.length !== 6 || !factorId}
        onClick={() => void verify()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <ShieldCheck className="size-4" aria-hidden />
        )}
        {submitting ? "Verifying…" : "Verify and continue"}
      </button>

      <p className="text-center text-[11px] leading-4 text-slate-400">
        Admin verification
      </p>
    </div>
  );
}
