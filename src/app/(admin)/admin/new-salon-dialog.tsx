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
  return s || "salon";
}

export function NewSalonDialog() {
  const nameId = useId();
  const slugId = useId();
  const tierId = useId();
  const nicheId = useId();
  const ownerEmailId = useId();
  const ownerNameId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [tier, setTier] = useState<"connect" | "native">("native");
  const [niche, setNiche] = useState<OrganizationNiche>("hair_salon");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [error, setError] = useState<string | null>(null);
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
    setTier("native");
    setNiche("hair_salon");
    setOwnerEmail("");
    setOwnerName("");
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
  }, [name, slug, tier, niche, ownerEmail, ownerName, reset]);

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
        New salon
      </DialogTrigger>
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New organization</DialogTitle>
          <DialogDescription>
            Creates the tenant and emails the owner an invite.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor={nameId}>Salon name</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bella Salon"
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
              placeholder="bella-salon"
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs">
              Public URL segment; auto-filled from name until you edit it.
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
              Shown beside Cliste in the salon dashboard (e.g. Salon or Barber).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={ownerNameId}>Salon owner name</Label>
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
