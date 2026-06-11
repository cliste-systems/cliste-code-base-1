import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { AuthMarketingShell } from "@/components/auth/auth-marketing-shell";
import { describeAuthCallbackError } from "@/lib/auth-error-message";
import { createClient } from "@/utils/supabase/server";

import { AuthParamForwarder } from "./auth-param-forwarder";

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
        title="Authenticate"
        subtitle="Continue to your Cliste account"
        marketingHeadline={
          <>
            The New Standard for
            <br />
            <span className="text-zinc-300/90">AI Voice in Ireland.</span>
          </>
        }
        marketingBody="Cara is your AI phone agent — an Irish voice that answers every call, runs your call flow, and puts follow-ups in your Action Inbox."
        urlError={urlError}
      >
        <LoginForm />
      </AuthMarketingShell>
    </>
  );
}
