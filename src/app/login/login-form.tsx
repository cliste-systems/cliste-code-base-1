"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordSignIn } from "./actions";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [requiresCaptcha, setRequiresCaptcha] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileSiteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (requiresCaptcha && turnstileSiteKey && !turnstileToken) {
      setError("Please complete the security check.");
      return;
    }
    setPending(true);
    const result = await passwordSignIn({
      email,
      password,
      turnstileToken: turnstileToken ?? null,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      setRequiresCaptcha(result.requiresCaptcha);
      if (result.requiresCaptcha) {
        setTurnstileToken(null);
      }
      return;
    }
    router.push("/auth/post-login");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="login-email" className="text-xs text-zinc-500">
          Email address
        </Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          placeholder="name@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-slate-200/90 bg-slate-50/70 text-slate-900 placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password" className="text-xs text-slate-500">
            Password
          </Label>
          <span className="text-xs text-slate-400">Use your invite password</span>
        </div>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border-slate-200/90 bg-slate-50/70 pr-10 text-slate-900 placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-900"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>
      {requiresCaptcha ? (
        <div className="space-y-2 rounded-md border border-emerald-200/70 bg-emerald-50/40 p-3">
          <p className="text-xs text-slate-600">
            Extra security check is required after failed attempts.
          </p>
          {turnstileSiteKey ? (
            <Turnstile
              siteKey={turnstileSiteKey}
              onSuccess={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken(null)}
            />
          ) : (
            <p className="text-xs text-amber-700">
              Captcha site key missing (
              <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code>).
            </p>
          )}
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#090b0f] px-4 py-2.5 text-sm font-normal text-white transition-colors hover:bg-[#05070b] disabled:opacity-60"
        disabled={pending}
      >
        {pending ? "Signing in..." : "Sign in"}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </form>
  );
}
