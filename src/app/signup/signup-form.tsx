"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { startSignup, type SignupResult } from "./actions";

const INITIAL: SignupResult = { ok: false, message: "" };

export function SignupForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: SignupResult, formData: FormData) => {
      return startSignup(_prev, formData);
    },
    INITIAL,
  );

  const [showPw, setShowPw] = useState(false);
  const errorMessage = !state.ok && state.message ? state.message : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="salonName"
          className="text-sm font-medium text-gray-800"
        >
          Salon / business name
        </label>
        <input
          id="salonName"
          name="salonName"
          type="text"
          required
          autoComplete="organization"
          placeholder="e.g. Riverside Hair Studio"
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-gray-800">
          Your email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@salon.ie"
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-gray-800">
          Create a password
        </label>
        <div className="flex items-stretch gap-2">
          <input
            id="password"
            name="password"
            type={showPw ? "text" : "password"}
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="rounded-md border border-gray-300 bg-white px-3 text-xs text-gray-700 hover:bg-gray-50"
          >
            {showPw ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating your account…" : "Create account"}
      </button>

      <p className="text-center text-xs text-gray-500">
        By creating an account you agree to our{" "}
        <Link href="/legal/terms" className="underline">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" className="underline">
          privacy policy
        </Link>
        .
      </p>

      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link
          href="/authenticate"
          className="font-medium text-emerald-700 hover:text-emerald-800"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
