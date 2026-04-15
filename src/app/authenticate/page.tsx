import Image from "next/image";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { describeAuthCallbackError } from "@/lib/auth-error-message";
import { getOptionalDashboardSession } from "@/lib/dashboard-session";

type AuthenticatePageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function AuthenticatePage({
  searchParams,
}: AuthenticatePageProps) {
  const session = await getOptionalDashboardSession();
  if (session) {
    redirect("/dashboard");
  }

  const q = await searchParams;
  const urlError = describeAuthCallbackError(q.error, q.message);

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-[#FAFAFA] via-[#FAFAFA] to-emerald-50/60 p-4 text-zinc-600 antialiased sm:p-6 lg:p-8">
      <main className="relative z-10 grid w-full max-w-[1040px] overflow-hidden rounded-[24px] bg-white shadow-[0_12px_40px_-16px_rgba(0,0,0,0.08)] ring-1 ring-zinc-200/50 lg:grid-cols-[1.2fr_420px]">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-12 text-white lg:flex">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-500/15 via-zinc-950 to-zinc-950" />
          <div className="relative z-10">
            <div className="mb-16 flex h-9 w-9 items-center justify-center rounded-md bg-white shadow-sm">
              <Image
                src="/cliste-logo.png"
                alt="Cliste"
                width={24}
                height={24}
                className="h-6 w-6 object-contain"
                priority
              />
            </div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-800/60 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400 backdrop-blur-md">
              Admin Portal
            </div>
            <h2 className="mb-6 text-3xl leading-[1.15] font-light tracking-tight text-zinc-100 lg:text-4xl">
              Automate the ringing phone.
              <br />
              <span className="text-zinc-500">The standard for AI voice.</span>
            </h2>
            <p className="max-w-sm text-sm leading-relaxed font-light text-zinc-400/80">
              Manage hyper-realistic voice agents built to handle your administrative
              workload securely and efficiently.
            </p>
          </div>
          <div className="relative z-10 mt-16 flex items-center gap-3 pt-6 text-xs text-zinc-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-20" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
            </span>
            All systems operational
          </div>
        </section>

        <section className="relative flex flex-col justify-center bg-white p-8 sm:p-12">
          <div className="mb-10 flex flex-col lg:hidden">
            <div className="mb-6 flex h-9 w-9 items-center justify-center rounded-md bg-zinc-950 shadow-sm">
              <Image
                src="/cliste-logo.png"
                alt="Cliste"
                width={24}
                height={24}
                className="h-6 w-6 object-contain invert"
                priority
              />
            </div>
            <h1 className="mb-1.5 text-2xl font-light tracking-tight text-zinc-900">
              Authenticate
            </h1>
            <p className="text-sm font-light text-zinc-500">
              Continue to your Cliste account
            </p>
          </div>

          <div className="mb-10 hidden lg:block">
            <h1 className="mb-1.5 text-2xl font-light tracking-tight text-zinc-900">
              Authenticate
            </h1>
            <p className="text-sm font-light text-zinc-500">
              Continue to your Cliste account
            </p>
          </div>

          {urlError ? (
            <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm leading-relaxed text-red-700">
              {urlError}
            </p>
          ) : null}

          <LoginForm />
        </section>
      </main>
    </div>
  );
}
