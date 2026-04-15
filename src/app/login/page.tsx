import { redirect } from "next/navigation";

import { getOptionalDashboardSession } from "@/lib/dashboard-session";

import { LoginForm } from "./login-form";

function describeAuthCallbackError(
  error: string | undefined,
  message: string | undefined
): string | null {
  if (!error) return null;
  if (error === "session") {
    if (message) {
      try {
        return decodeURIComponent(message);
      } catch {
        return null;
      }
    }
    return (
      "That sign-in link did not finish in the browser. Open the invite link again, " +
      "or use the same browser you normally use for this site. You can also sign in below if you already set a password."
    );
  }
  if (error === "profile") {
    return (
      "You are signed in, but this account is not linked to a salon yet. " +
      "Finish the invite link from your email, or ask your administrator to add you to the organization."
    );
  }
  try {
    return decodeURIComponent(error);
  } catch {
    return error;
  }
}

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getOptionalDashboardSession();
  if (session) {
    redirect("/dashboard");
  }

  const q = await searchParams;
  const urlError = describeAuthCallbackError(q.error, q.message);

  return (
    <div className="bg-muted/30 flex min-h-full flex-1 flex-col items-center justify-center p-6">
      <div className="border-border bg-card w-full max-w-md space-y-6 rounded-xl border p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-muted-foreground text-sm">
            Sign in with the email and password for your salon account — the
            same ones from your Cliste invite, or what you set after accepting it.
          </p>
        </div>
        {urlError ? (
          <p className="text-destructive text-sm leading-relaxed" role="alert">
            {urlError}
          </p>
        ) : null}
        <LoginForm />
      </div>
    </div>
  );
}
