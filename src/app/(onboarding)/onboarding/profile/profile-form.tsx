"use client";

import { useActionState } from "react";

import { saveProfileStep, type SaveProfileResult } from "../actions";

const INITIAL: SaveProfileResult = { ok: true };

type Props = {
  defaultName: string;
  defaultNiche: string;
  defaultAddress: string;
  defaultEircode: string;
  defaultGreeting: string;
  niches: Array<{ value: string; label: string }>;
};

export function ProfileForm(props: Props) {
  const [state, formAction, pending] = useActionState(
    async (_prev: SaveProfileResult, formData: FormData) =>
      saveProfileStep(_prev, formData),
    INITIAL,
  );

  const errorMessage = !state.ok && state.message ? state.message : null;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field label="Salon name" htmlFor="name">
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={props.defaultName}
          className={inputCls}
        />
      </Field>

      <Field label="Business type" htmlFor="niche">
        <select
          id="niche"
          name="niche"
          defaultValue={props.defaultNiche}
          className={inputCls}
        >
          {props.niches.map((n) => (
            <option key={n.value} value={n.value}>
              {n.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
        <Field label="Address" htmlFor="address">
          <input
            id="address"
            name="address"
            type="text"
            defaultValue={props.defaultAddress}
            placeholder="Street, town"
            className={inputCls}
          />
        </Field>
        <Field label="Eircode" htmlFor="eircode">
          <input
            id="eircode"
            name="eircode"
            type="text"
            defaultValue={props.defaultEircode}
            placeholder="e.g. D06 X2P6"
            className={inputCls}
          />
        </Field>
      </div>

      <Field
        label="AI greeting (optional)"
        htmlFor="greeting"
        hint="How would you like the AI to answer? We'll use a default if you leave this blank."
      >
        <textarea
          id="greeting"
          name="greeting"
          rows={3}
          defaultValue={props.defaultGreeting}
          placeholder='e.g. "Thanks for ringing Riverside Hair — how can I help?"'
          className={inputCls}
        />
      </Field>

      {errorMessage ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Continue to payments"}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-gray-800">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}
