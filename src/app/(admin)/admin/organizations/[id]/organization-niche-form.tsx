"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ORGANIZATION_NICHES,
  ORGANIZATION_NICHE_ADMIN_LABELS,
  PRODUCT_NAME_BY_NICHE,
  type OrganizationNiche,
} from "@/lib/organization-niche";
import { cn } from "@/lib/utils";

import { updateOrganizationNiche } from "../../actions";

type OrganizationNicheFormProps = {
  organizationId: string;
  initialNiche: OrganizationNiche;
};

export function OrganizationNicheForm({
  organizationId,
  initialNiche,
}: OrganizationNicheFormProps) {
  const [niche, setNiche] = useState<OrganizationNiche>(initialNiche);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        Product niche
      </h2>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        Controls the label beside Cliste in the salon dashboard. Preview:{" "}
        <span className="text-slate-800 font-medium">
          Cliste {PRODUCT_NAME_BY_NICHE[niche]}
        </span>
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          startTransition(async () => {
            const r = await updateOrganizationNiche(organizationId, niche);
            if (r.ok) setMsg("Saved.");
            else setMsg(r.message);
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="org-niche">Niche</Label>
          <select
            id="org-niche"
            value={niche}
            onChange={(e) => setNiche(e.target.value as OrganizationNiche)}
            disabled={pending}
            className="border-input bg-background h-9 w-full max-w-md rounded-md border px-3 text-sm"
          >
            {ORGANIZATION_NICHES.map((key) => (
              <option key={key} value={key}>
                {ORGANIZATION_NICHE_ADMIN_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save niche"}
          </Button>
          {msg ? (
            <p
              className={cn(
                "text-sm",
                msg === "Saved." ? "font-medium text-emerald-700" : "text-destructive",
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
