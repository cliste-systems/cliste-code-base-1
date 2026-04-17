"use client";

import { useActionState, useState } from "react";

import type { LaunchTier, PlanTier } from "@/lib/cliste-plans";

import { startPlanCheckout } from "../actions";

type PlanRow = {
  tier: PlanTier;
  name: string;
  tagline: string;
  monthlyCents: number;
  annualCents: number;
  includedMinutes: number;
  overageRateCents: number;
  applicationFeeBps: number;
  features: string[];
  recommended: boolean;
};

type LaunchRow = {
  tier: LaunchTier;
  name: string;
  description: string;
  priceCents: number;
  targetRegion?: string;
};

type Props = {
  plans: PlanRow[];
  launches: LaunchRow[];
  defaultPlan: PlanTier;
  defaultLaunch: LaunchTier;
};

const INITIAL = { ok: false as const, message: "" };

export function PlanPicker({
  plans,
  launches,
  defaultPlan,
  defaultLaunch,
}: Props) {
  const [plan, setPlan] = useState<PlanTier>(defaultPlan);
  const [launch, setLaunch] = useState<LaunchTier>(defaultLaunch);
  const [interval, setInterval] = useState<"month" | "year">("month");

  const [state, formAction, pending] = useActionState(
    async (_prev: { ok: false; message: string }, formData: FormData) =>
      startPlanCheckout(_prev, formData),
    INITIAL,
  );

  const errorMessage = !state.ok && state.message ? state.message : null;

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="planTier" value={plan} />
      <input type="hidden" name="launchTier" value={launch} />
      <input type="hidden" name="interval" value={interval} />

      <div className="flex justify-end">
        <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setInterval("month")}
            className={cx(
              "rounded-full px-3 py-1 transition",
              interval === "month"
                ? "bg-emerald-600 text-white"
                : "text-gray-600",
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval("year")}
            className={cx(
              "rounded-full px-3 py-1 transition",
              interval === "year"
                ? "bg-emerald-600 text-white"
                : "text-gray-600",
            )}
          >
            Annual <span className="text-[10px] font-normal">(2 months free)</span>
          </button>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Subscription
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <button
              type="button"
              key={p.tier}
              onClick={() => setPlan(p.tier)}
              aria-pressed={plan === p.tier}
              className={cx(
                "flex flex-col rounded-xl border bg-white p-5 text-left shadow-sm transition",
                plan === p.tier
                  ? "border-emerald-500 ring-2 ring-emerald-200"
                  : "border-gray-200 hover:border-gray-300",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">
                  {p.name}
                </span>
                {p.recommended ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                    Most popular
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-gray-500">{p.tagline}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-900">
                  {formatEuro(
                    interval === "year" ? p.annualCents / 12 : p.monthlyCents,
                  )}
                </span>
                <span className="text-xs text-gray-500">/mo</span>
              </div>
              {interval === "year" ? (
                <p className="text-[11px] text-gray-500">
                  Billed {formatEuro(p.annualCents)} annually
                </p>
              ) : null}
              <p className="mt-3 text-xs text-gray-600">
                {p.includedMinutes.toLocaleString()} AI call minutes/mo incl.
              </p>
              <p className="text-xs text-gray-600">
                Then {formatEuro(p.overageRateCents)}/minute
              </p>
              <p className="text-xs text-gray-600">
                {(p.applicationFeeBps / 100)
                  .toFixed(2)
                  .replace(/\.00$/, "")}
                % platform fee on card bookings
              </p>
              <ul className="mt-4 space-y-1 text-[12px] text-gray-600">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Launch assistance
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {launches.map((l) => (
            <button
              type="button"
              key={l.tier}
              onClick={() => setLaunch(l.tier)}
              aria-pressed={launch === l.tier}
              className={cx(
                "flex flex-col rounded-xl border bg-white p-4 text-left shadow-sm transition",
                launch === l.tier
                  ? "border-emerald-500 ring-2 ring-emerald-200"
                  : "border-gray-200 hover:border-gray-300",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">
                  {l.name}
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {l.priceCents === 0 ? "Free" : formatEuro(l.priceCents)}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-600">{l.description}</p>
              {l.targetRegion ? (
                <p className="mt-2 text-[11px] uppercase tracking-wide text-gray-500">
                  {l.targetRegion}
                </p>
              ) : null}
            </button>
          ))}
        </div>
      </section>

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
          {pending ? "Starting checkout…" : "Continue to Stripe"}
        </button>
      </div>
    </form>
  );
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function formatEuro(cents: number): string {
  const value = cents / 100;
  if (Number.isInteger(value)) return `€${value}`;
  return `€${value.toFixed(2)}`;
}
