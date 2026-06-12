"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";

import { switchDashboardLocation } from "@/app/(dashboard)/dashboard/location-actions";
import type { AccountLocationRow } from "@/lib/account-locations";
import { resolveOrganizationDisplayName } from "@/lib/organization-display-name";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type LocationSwitcherProps = {
  locations: AccountLocationRow[];
  activeOrganizationId: string;
  viewAllLocations: boolean;
  locationLabel: string;
  accountName: string;
};

function labelForLocation(location: AccountLocationRow, accountName: string) {
  const locationName = resolveOrganizationDisplayName(
    location.name,
    location.slug,
  );
  if (!locationName || locationName === accountName) return locationName;
  return locationName;
}

export function LocationSwitcher({
  locations,
  activeOrganizationId,
  viewAllLocations,
  locationLabel,
  accountName,
}: LocationSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!locations || locations.length <= 1) return null;

  const activeLocation =
    locations.find((l) => l.id === activeOrganizationId) ?? locations[0]!;
  const triggerLabel = viewAllLocations
    ? `All ${locationLabel.toLowerCase()}s`
    : labelForLocation(activeLocation, accountName);

  function onSelect(organizationId: string) {
    startTransition(async () => {
      const result = await switchDashboardLocation(organizationId);
      if (result.ok) router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="flex h-auto w-full items-center justify-between rounded-[18px] border border-slate-200/80 bg-white px-3 py-2.5 text-left shadow-[0_10px_28px_rgba(15,23,42,0.04)] hover:bg-[#fcfcfd] disabled:opacity-60"
      >
        <span className="flex min-w-0 items-center gap-2">
          <MapPin className="size-4 shrink-0 text-[#64748b]" aria-hidden />
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-semibold text-[#0f172a]">
              {triggerLabel}
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-[#64748b]">
              {accountName}
            </span>
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-[#cbd5e1]" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[232px]">
        <DropdownMenuLabel>{locationLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => onSelect("all")}
        >
          <span className="flex w-full items-center justify-between gap-2">
            <span>All {locationLabel.toLowerCase()}s</span>
            {viewAllLocations ? (
              <Check className="size-4 text-emerald-600" aria-hidden />
            ) : null}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {locations.map((location) => {
          const selected =
            !viewAllLocations && location.id === activeOrganizationId;
          return (
            <DropdownMenuItem
              key={location.id}
              className={cn("cursor-pointer", selected && "bg-slate-50")}
              onSelect={() => onSelect(location.id)}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="truncate">
                  {labelForLocation(location, accountName)}
                </span>
                {selected ? (
                  <Check className="size-4 shrink-0 text-emerald-600" aria-hidden />
                ) : null}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
