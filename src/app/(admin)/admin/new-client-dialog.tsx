"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLANS, type PlanTier } from "@/lib/cliste-plans.data";
import {
  ORGANIZATION_NICHES,
  ORGANIZATION_NICHE_ADMIN_LABELS,
  type OrganizationNiche,
} from "@/lib/organization-niche";

import { createOrganization } from "./actions";

function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "store";
}

const PLAN_OPTIONS = (["starter", "pro", "business"] as PlanTier[]).map(
  (tier) => ({
    tier,
    label: PLANS[tier].name,
    tagline: PLANS[tier].tagline,
  }),
);

export function NewClientDialog() {
  const nameId = useId();
  const slugId = useId();
  const tierId = useId();
  const planTierId = useId();
  const nicheId = useId();
  const ownerEmailId = useId();
  const ownerNameId = useId();
  const ownerMobileId = useId();
  const addressId = useId();
  const eircodeId = useId();
  const assignPhoneId = useId();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [tier, setTier] = useState<"connect" | "native">("native");
  const [planTier, setPlanTier] = useState<PlanTier>("pro");
  const [assignPhoneNumber, setAssignPhoneNumber] = useState(true);
  const [niche, setNiche] = useState<OrganizationNiche>("retail");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerMobile, setOwnerMobile] = useState("");
  const [address, setAddress] = useState("");
  const [storefrontEircode, setStorefrontEircode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugify(name));
    }
  }, [name, slugTouched]);

  const reset = useCallback(() => {
    setStep(1);
    setName("");
    setSlug("");
    setSlugTouched(false);
    setTier("native");
    setPlanTier("pro");
    setAssignPhoneNumber(true);
    setNiche("retail");
    setOwnerEmail("");
    setOwnerName("");
    setOwnerMobile("");
    setAddress("");
    setStorefrontEircode("");
    setError(null);
    setWarning(null);
  }, []);

  const canContinueStep1 = Boolean(
    name.trim() && ownerEmail.trim() && ownerName.trim(),
  );

  const submit = useCallback(() => {
    setError(null);
    setWarning(null);
    startTransition(async () => {
      const result = await createOrganization({
        name,
        slug: slug || slugify(name),
        tier,
        planTier,
        assignPhoneNumber,
        niche,
        ownerEmail,
        ownerName,
        ownerMobile: ownerMobile.trim() || null,
        address: address.trim() || null,
        storefrontEircode: storefrontEircode.trim() || null,
        clientOrigin:
          typeof window !== "undefined" ? window.location.origin : null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (result.warning) {
        setWarning(result.warning);
      }
      setOpen(false);
      reset();
    });
  }, [
    name,
    slug,
    tier,
    planTier,
    assignPhoneNumber,
    niche,
    ownerEmail,
    ownerName,
    ownerMobile,
    address,
    storefrontEircode,
    reset,
  ]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 focus:outline-none"
          />
        }
      >
        New retail client
      </DialogTrigger>
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New retail client</DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Step 1 of 2 — store identity and owner contact."
              : "Step 2 of 2 — plan and optional phone assignment."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor={nameId}>Store name</Label>
              <Input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="SuperValu Donegal Town"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={slugId}>Slug</Label>
              <Input
                id={slugId}
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase());
                }}
                placeholder="supervalu-donegal-town"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={addressId}>Address (optional)</Label>
              <Input
                id={addressId}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, town"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={eircodeId}>Eircode (optional)</Label>
              <Input
                id={eircodeId}
                value={storefrontEircode}
                onChange={(e) =>
                  setStorefrontEircode(e.target.value.toUpperCase())
                }
                placeholder="F94 X2R8"
                className="font-mono text-sm tracking-wide"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={nicheId}>Niche</Label>
              <select
                id={nicheId}
                value={niche}
                onChange={(e) =>
                  setNiche(e.target.value as OrganizationNiche)
                }
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                {ORGANIZATION_NICHES.map((key) => (
                  <option key={key} value={key}>
                    {ORGANIZATION_NICHE_ADMIN_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={ownerNameId}>Owner / manager name</Label>
              <Input
                id={ownerNameId}
                autoComplete="name"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Mary Murphy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={ownerMobileId}>Owner mobile (optional)</Label>
              <Input
                id={ownerMobileId}
                type="tel"
                autoComplete="tel"
                value={ownerMobile}
                onChange={(e) => setOwnerMobile(e.target.value)}
                placeholder="+353 87 123 4567"
              />
              <p className="text-muted-foreground text-xs">
                Stored as the store notification number for alerts.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={ownerEmailId}>Owner email</Label>
              <Input
                id={ownerEmailId}
                type="email"
                required
                autoComplete="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="owner@example.com"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor={planTierId}>Plan tier</Label>
              <select
                id={planTierId}
                value={planTier}
                onChange={(e) => setPlanTier(e.target.value as PlanTier)}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                {PLAN_OPTIONS.map(({ tier: t, label }) => (
                  <option key={t} value={t}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs">
                {PLANS[planTier].tagline}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={tierId}>Product tier</Label>
              <select
                id={tierId}
                value={tier}
                onChange={(e) =>
                  setTier(e.target.value as "connect" | "native")
                }
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                <option value="native">Native</option>
                <option value="connect">Connect</option>
              </select>
            </div>
            <label
              htmlFor={assignPhoneId}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-3"
            >
              <input
                id={assignPhoneId}
                type="checkbox"
                checked={assignPhoneNumber}
                onChange={(e) => setAssignPhoneNumber(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium text-slate-900">
                  Assign Irish number now
                </span>
                <span className="block text-xs text-slate-500">
                  Claims a Cliste DID from the pool. If the pool is empty, the
                  store is still created — assign manually later.
                </span>
              </span>
            </label>
          </div>
        )}

        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        {warning ? (
          <p className="text-amber-700 text-sm" role="status">
            {warning}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 2 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
              disabled={pending}
            >
              Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          )}
          {step === 1 ? (
            <Button
              type="button"
              disabled={!canContinueStep1}
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
          ) : (
            <Button type="button" disabled={pending} onClick={submit}>
              {pending ? "Provisioning…" : "Provision & email invite"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
