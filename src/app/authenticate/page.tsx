import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PRODUCT_NAME } from "@/lib/company-details";
import { describeAuthCallbackError } from "@/lib/auth-error-message";
import { isPublicSignupEnabled } from "@/lib/public-signup";
import { getAuthUserOrNull } from "@/utils/supabase/server";

import { AuthenticateFlow } from "./authenticate-flow";
import { AuthParamForwarder } from "./auth-param-forwarder";

export const metadata: Metadata = {
  title: `Sign in — ${PRODUCT_NAME}`,
  description: `Sign in to your ${PRODUCT_NAME} account and manage Cara, your AI phone agent.`,
};

type AuthenticatePageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export const dynamic = "force-dynamic";

export default async function AuthenticatePage({
  searchParams,
}: AuthenticatePageProps) {
  const user = await getAuthUserOrNull();
  if (user) {
    redirect("/auth/post-login");
  }

  const q = await searchParams;
  const urlError = describeAuthCallbackError(q.error, q.message);

  return (
    <>
      <AuthParamForwarder />
      <AuthenticateFlow
        urlError={urlError}
        showSignUpLink={isPublicSignupEnabled()}
      />
    </>
  );
}
