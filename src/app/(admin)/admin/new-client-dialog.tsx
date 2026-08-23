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
import {
  ADMIN_PROVISIONING_NICHES,
  ORGANIZATION_NICHE_ADMIN_LABELS,
  type AdminProvisioningNiche,
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

export function NewClientDialog() {
  const nameId = useId();
  const slugId = useId();
  const nicheId = useId();
  const ownerEmailId = useId();
  const ownerNameId = useId();
  const ownerMobileId = useId();
  const addressId = useId();
  const eircodeId = useId();
  const assignPhoneId = useId();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [assignPhoneNumber, setAssignPhoneNumber] = useState(true);
  const [niche, setNiche] = useState<AdminProvisioningNiche>("retail");
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
    setName("");
    setSlug("");
    setSlugTouched(false);
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

  const canSubmit = Boolean(name.trim() && ownerEmail.trim() && ownerName.trim());

  const submit = useCallback(() => {
    setError(null);
    setWarning(null);
    startTransition(async () => {
      const result = await createOrganization({
        name,
        slug: slug || slugify(name),
        tier: "native",
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
        New client
      </DialogTrigger>
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
          <DialogDescription>
            Business details, owner contact, and optional phone assignment.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor={nameId}>Business name</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Ltd"
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
                setNiche(e.target.value as AdminProvisioningNiche)
              }
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              {ADMIN_PROVISIONING_NICHES.map((key) => (
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
              Stored as the notification number for alerts.
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
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending || !canSubmit} onClick={submit}>
            {pending ? "Provisioning…" : "Provision & email invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
