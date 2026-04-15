"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearSupportDashboardCookie } from "./actions";
import { createClient } from "@/utils/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setPending(false);
    if (signError) {
      setError(signError.message);
      return;
    }
    await clearSupportDashboardCookie();
    router.push("/dashboard");
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
      <label className="flex w-max cursor-pointer items-center gap-2.5 pt-1 pb-2">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={staySignedIn}
          onChange={(e) => setStaySignedIn(e.target.checked)}
          aria-label="Stay signed in"
        />
        <span className="flex h-4 w-4 items-center justify-center rounded-[4px] border border-slate-300 bg-white text-white transition-colors peer-checked:border-emerald-600 peer-checked:bg-emerald-600">
          <Check className="h-3 w-3 opacity-0 transition-opacity peer-checked:opacity-100" />
        </span>
        <span className="text-sm text-slate-500 transition-colors hover:text-slate-800">
          Stay signed in
        </span>
      </label>
      {!staySignedIn ? (
        <p className="-mt-2 text-xs text-slate-400">
          Session persistence is managed securely by Supabase in this browser.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#111827] px-4 py-2.5 text-sm font-normal text-white transition-colors hover:bg-[#0b1220] disabled:opacity-60"
        disabled={pending}
      >
        {pending ? "Signing in..." : "Sign in"}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </form>
  );
}
