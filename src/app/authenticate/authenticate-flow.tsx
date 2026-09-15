"use client";

import { useState } from "react";

import { LoginForm } from "@/app/login/login-form";
import { AuthMarketingShell } from "@/components/auth/auth-marketing-shell";
import { PUBLIC_ASSETS } from "@/lib/public-assets";

import { AuthenticateSignUpLink } from "./authenticate-sign-up-link";

type AuthenticateFlowProps = {
  urlError?: string | null;
  showSignUpLink: boolean;
};

export function AuthenticateFlow({
  urlError,
  showSignUpLink,
}: AuthenticateFlowProps) {
  const [panelExiting, setPanelExiting] = useState(false);

  return (
    <AuthMarketingShell
      title="Sign in"
      pageBackground={PUBLIC_ASSETS.onboarding.authSignup}
      urlError={urlError}
      contentExiting={panelExiting}
    >
      <LoginForm onTransitionStart={() => setPanelExiting(true)} />
      {showSignUpLink ? <AuthenticateSignUpLink /> : null}
    </AuthMarketingShell>
  );
}
