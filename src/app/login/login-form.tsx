"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";

import {
  OnboardingFieldBox,
  OnboardingFieldSurfaceProvider,
} from "@/components/onboarding/onboarding-form-card";
import { OnboardingEnter } from "@/components/onboarding/onboarding-enter";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import {
  ONBOARDING_FIELD_HINT,
  ONBOARDING_FIELD_INPUT,
} from "@/components/onboarding/onboarding-ui";
import { cn } from "@/lib/utils";

import { passwordSignIn } from "./actions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = Partial<Record<"email" | "password" | "captcha", string>>;

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [requiresCaptcha, setRequiresCaptcha] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileSiteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const errors: FieldErrors = {};
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !EMAIL_RE.test(trimmedEmail)) {
      errors.email = "Enter a valid email address.";
    }
    if (!password) {
      errors.password = "Enter your password.";
    }
    if (requiresCaptcha && turnstileSiteKey && !turnstileToken) {
      errors.captcha = "Please complete the security check.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setPending(true);
    const result = await passwordSignIn({
      email: trimmedEmail,
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
    <OnboardingFieldSurfaceProvider surface="profile">
      <form onSubmit={handleSubmit} noValidate className="w-full space-y-3">
        <OnboardingFieldBox
          label="Email address"
          htmlFor="login-email"
          error={fieldErrors.email}
        >
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@business.ie"
            value={email}
            aria-invalid={Boolean(fieldErrors.email)}
            onChange={(event) => {
              setEmail(event.target.value);
              clearFieldError("email");
            }}
            className={ONBOARDING_FIELD_INPUT}
          />
        </OnboardingFieldBox>

        <OnboardingFieldBox
          label="Password"
          htmlFor="login-password"
          error={fieldErrors.password ?? fieldErrors.captcha}
        >
          <p className={ONBOARDING_FIELD_HINT}>Use the password from your invite</p>
          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              aria-invalid={Boolean(fieldErrors.password)}
              onChange={(event) => {
                setPassword(event.target.value);
                clearFieldError("password");
              }}
              className={cn(ONBOARDING_FIELD_INPUT, "pr-10")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute top-1/2 right-0 -translate-y-1/2 p-1 text-slate-400 transition-colors hover:text-[#0b1220]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </OnboardingFieldBox>

        {requiresCaptcha ? (
          <OnboardingEnter tone="profile">
            <div className="rounded-2xl border border-slate-200/75 bg-white px-4 py-3.5">
              <p className="text-[12px] leading-relaxed text-slate-600">
                Extra security check is required after failed attempts.
              </p>
              {turnstileSiteKey ? (
                <div className="mt-3 flex justify-center">
                  <Turnstile
                    siteKey={turnstileSiteKey}
                    onSuccess={(token) => {
                      setTurnstileToken(token);
                      clearFieldError("captcha");
                    }}
                    onExpire={() => setTurnstileToken(null)}
                    options={{ theme: "light", size: "normal" }}
                  />
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-amber-700">
                  Captcha site key missing (
                  <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code>).
                </p>
              )}
            </div>
          </OnboardingEnter>
        ) : null}

        {error ? (
          <OnboardingEnter tone="profile">
            <p className="text-center text-sm text-red-600" role="alert">
              {error}
            </p>
          </OnboardingEnter>
        ) : null}

        <OnboardingEnter tone="profile" className="flex justify-center pt-2">
          <OnboardingPrimaryButton
            type="submit"
            pending={pending}
            className="w-full max-w-none sm:min-w-[14rem]"
          >
            {pending ? "Signing in…" : "Sign in"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </OnboardingPrimaryButton>
        </OnboardingEnter>
      </form>
    </OnboardingFieldSurfaceProvider>
  );
}
