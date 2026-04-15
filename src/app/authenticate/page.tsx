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
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-[#f5f7fb] p-4 text-slate-600 antialiased sm:p-6 lg:p-8">
      <main className="relative z-10 grid w-full max-w-[1080px] overflow-hidden rounded-[24px] bg-white shadow-[0_14px_42px_-16px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80 lg:grid-cols-[1.2fr_440px]">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#030406] via-[#07090d] to-[#0a0c10] p-12 text-white lg:flex">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-400/16 via-transparent to-transparent" />
          <div className="relative z-10">
            <div className="mb-16 flex h-11 w-11 items-center justify-center rounded-lg bg-white shadow-sm">
              <Image
                src="/cliste-logo.png"
                alt="Cliste"
                width={30}
                height={30}
                className="h-7 w-7 object-contain"
                priority
              />
            </div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-100/95 backdrop-blur-md">
              Cliste Systems
            </div>
            <h2 className="mb-6 text-3xl leading-[1.12] font-light tracking-tight text-white lg:text-4xl">
              The New Standard for
              <br />
              <span className="text-zinc-300/90">AI Voice in Ireland.</span>
            </h2>
            <p className="max-w-sm text-sm leading-relaxed font-light text-zinc-300/85">
              Automate the ringing phone. We build hyper-realistic Irish voice
              agents to handle admin 24/7 so your team can focus on their work.
            </p>
          </div>
          <div className="relative z-10 mt-16 flex items-center gap-3 pt-6 text-xs text-zinc-300/80">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-20" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.45)]" />
            </span>
            All systems operational
          </div>
        </section>

        <section className="relative flex flex-col justify-center bg-white p-8 sm:p-12">
          <div className="mb-10 flex flex-col lg:hidden">
            <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
              <Image
                src="/cliste-logo.png"
                alt="Cliste"
                width={30}
                height={30}
                className="h-7 w-7 object-contain"
                priority
              />
            </div>
            <h1 className="mb-1.5 text-2xl font-light tracking-tight text-slate-900">
              Authenticate
            </h1>
            <p className="text-sm font-light text-slate-500">
              Continue to your Cliste account
            </p>
          </div>

          <div className="mb-10 hidden lg:block">
            <h1 className="mb-1.5 text-2xl font-light tracking-tight text-slate-900">
              Authenticate
            </h1>
            <p className="text-sm font-light text-slate-500">
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
