"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  sendClientSignInCode,
  verifyClientSignInCode,
} from "@/app/account/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "email" | "code";

export function ClientSignInForm({ next }: { next: string }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSendCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await sendClientSignInCode(email);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setStep("code");
      setInfo(`We sent a 6-digit code to ${email.trim().toLowerCase()}.`);
    });
  }

  function onVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await verifyClientSignInCode(email, code);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.replace(next || "/account");
      router.refresh();
    });
  }

  function resend() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await sendClientSignInCode(email);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setInfo("New code sent.");
    });
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <Link
          href="/"
          className="text-xs tracking-widest text-zinc-500 uppercase transition-colors hover:text-emerald-600"
        >
          ← Back to Cliste
        </Link>
        <h1 className="mt-6 text-2xl font-light tracking-tight text-black">
          Sign in to Cliste
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {step === "email"
            ? "Enter your email and we\u2019ll send a 6-digit code. No password needed."
            : "Enter the code we sent. It expires in a few minutes."}
        </p>
      </div>

      {error ? (
        <p
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {info ? (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {info}
        </p>
      ) : null}

      {step === "email" ? (
        <form onSubmit={onSendCode} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-email">Email</Label>
            <Input
              id="client-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.ie"
            />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Sending…" : "Send code"}
          </Button>
          <p className="text-xs text-zinc-500">
            We&apos;ll create an account if you&apos;re new — no extra steps.
          </p>
        </form>
      ) : (
        <form onSubmit={onVerify} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-code">6-digit code</Label>
            <Input
              id="client-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D+/g, ""))}
              placeholder="123456"
              className="text-center text-lg tracking-[0.4em]"
            />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Verifying…" : "Verify & sign in"}
          </Button>
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setInfo(null);
                setError(null);
              }}
              className="text-zinc-500 underline-offset-4 hover:underline"
            >
              Use another email
            </button>
            <button
              type="button"
              onClick={resend}
              disabled={pending}
              className="text-emerald-700 underline-offset-4 hover:underline disabled:opacity-50"
            >
              Resend code
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
