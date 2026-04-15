import Link from "next/link";

import { SetPasswordForm } from "./set-password-form";

export default function SetPasswordPage() {
  return (
    <div className="from-muted/25 via-background to-background mx-auto max-w-2xl space-y-6 bg-gradient-to-b pb-8">
      <header className="border-border/60 border-b pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Set your password
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          If your invite link signed you in without choosing a password, define
          one here so you can also use{" "}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            email sign-in
          </Link>{" "}
          later.
        </p>
      </header>
      <SetPasswordForm />
    </div>
  );
}
