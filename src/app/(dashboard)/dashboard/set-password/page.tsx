import Link from "next/link";

import { SetPasswordForm } from "./set-password-form";

export default function SetPasswordPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="space-y-2 text-center sm:text-left">
        <h1 className="text-xl font-semibold tracking-tight text-[#0b1220]">
          Set your password
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Your invite signed you in without a password. Choose one now so you
          can also use{" "}
          <Link
            href="/authenticate"
            className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
          >
            email sign-in
          </Link>{" "}
          later.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <SetPasswordForm />
      </div>
    </div>
  );
}
