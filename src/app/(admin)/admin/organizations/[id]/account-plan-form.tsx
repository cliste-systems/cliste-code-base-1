"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { updateAccountPlanTier } from "../../actions";

const PLAN_TIER_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Professional",
  business: "Business",
  enterprise: "Custom / Enterprise",
};

type AccountPlanFormProps = {
  accountId: string;
  initialPlanTier: string;
};

/** Manual plan assignment — pilot clients are invoiced outside Stripe. */
export function AccountPlanForm({
  accountId,
  initialPlanTier,
}: AccountPlanFormProps) {
  const [tier, setTier] = useState(initialPlanTier);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        Plan
      </h2>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        Set the plan manually — pilot clients are invoiced directly, not
        through in-app checkout. Controls included minutes and location limits.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          startTransition(async () => {
            const r = await updateAccountPlanTier(accountId, tier);
            setMsg(r.ok ? "Saved." : r.message);
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="account-plan-tier">Plan tier</Label>
          <select
            id="account-plan-tier"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            disabled={pending}
            className="border-input bg-background h-9 w-full max-w-md rounded-md border px-3 text-sm"
          >
            {Object.entries(PLAN_TIER_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save plan"}
          </Button>
          {msg ? (
            <p
              className={cn(
                "text-sm",
                msg === "Saved."
                  ? "font-medium text-emerald-700"
                  : "text-destructive",
              )}
            >
              {msg}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
