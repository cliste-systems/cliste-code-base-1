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

export function NewClientDialog() {
  const nameId = useId();
  const slugId = useId();
  const tierId = useId();
  const nicheId = useId();
  const ownerEmailId = useId();
  const ownerNameId = useId();
  const addressId = useId();
  const eircodeId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [tier, setTier] = useState<"connect" | "native">("native");
  const [niche, setNiche] = useState<OrganizationNiche>("retail");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [address, setAddress] = useState("");
  const [storefrontEircode, setStorefrontEircode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!slugTouched) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlug(slugify(name));
    }
  }, [name, slugTouched]);

  const reset = useCallback(() => {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setTier("native");
    setNiche("retail");
    setOwnerEmail("");
    setOwnerName("");
    setAddress("");
    setStorefrontEircode("");
    setError(null);
  }, []);

  const canSubmit = Boolean(
    name.trim() && ownerEmail.trim() && ownerName.trim()
  );

  const submit = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const result = await createOrganization({
        name,
        slug: slug || slugify(name),
        tier,
        niche,
        ownerEmail,
        ownerName,
        address: address.trim() || null,
        storefrontEircode: storefrontEircode.trim() || null,
        clientOrigin:
          typeof window !== "undefined" ? window.location.origin : null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      reset();
    });
  }, [name, slug, tier, niche, ownerEmail, ownerName, address, storefrontEircode, reset]);

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
            Creates the tenant and emails the owner an invite. Assign the phone
            number, call routing, and Cara config from the organization page
            after this step.
          </DialogDescription>
        </DialogHeader>
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
            <p className="text-muted-foreground text-xs">
              Internal identifier; auto-filled from name until you edit it.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={tierId}>Tier</Label>
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
          <div className="space-y-2">
            <Label htmlFor={addressId}>Address (optional)</Label>
            <Input
              id={addressId}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, town"
              autoComplete="street-address"
            />
            <p className="text-muted-foreground text-xs">
              Used by Cara for directions and location questions.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={eircodeId}>Eircode (optional)</Label>
            <Input
              id={eircodeId}
              value={storefrontEircode}
              onChange={(e) => setStorefrontEircode(e.target.value.toUpperCase())}
              placeholder="F94 X2R8"
              className="font-mono text-sm tracking-wide"
              autoComplete="postal-code"
            />
            <p className="text-muted-foreground text-xs">
              Resolved with Google Maps Geocoding to pin the store&apos;s
              location.
            </p>
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
            <p className="text-muted-foreground text-xs">
              Retail is the pilot default — it tailors the client dashboard for
              stores.
            </p>
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
            <p className="text-muted-foreground text-xs">
              Shown in the dashboard sidebar (&quot;Logged in as …&quot;).
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
            <p className="text-muted-foreground text-xs">
              Must not already be registered in this project.
            </p>
          </div>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || !canSubmit}
            onClick={submit}
          >
            {pending ? "Provisioning…" : "Provision & email invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
