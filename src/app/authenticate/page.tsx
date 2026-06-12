import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { AuthMarketingShell } from "@/components/auth/auth-marketing-shell";
import { describeAuthCallbackError } from "@/lib/auth-error-message";
import { PUBLIC_ASSETS } from "@/lib/public-assets";
import { createClient } from "@/utils/supabase/server";

import { AuthenticateSignUpLink } from "./authenticate-sign-up-link";
import { AuthParamForwarder } from "./auth-param-forwarder";

export const metadata: Metadata = {
  title: "Sign in — Cliste Systems",
  description: "Sign in to your Cliste account and manage Cara, your AI phone agent.",
};

type AuthenticatePageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function AuthenticatePage({
  searchParams,
}: AuthenticatePageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/auth/post-login");
  }

  const q = await searchParams;
  const urlError = describeAuthCallbackError(q.error, q.message);

  return (
    <>
      <AuthParamForwarder />
      <AuthMarketingShell
        title="Sign in"
        subtitle="Welcome back — pick up where you left off with Cara."
        pageBackground={PUBLIC_ASSETS.onboarding.authSignup}
        urlError={urlError}
      >
        <LoginForm />
        <AuthenticateSignUpLink />
      </AuthMarketingShell>
    </>
  );
}
