"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MapPin, Plus } from "lucide-react";

import {
  addAccountLocation,
  type LocationActionResult,
} from "@/app/(dashboard)/dashboard/locations/actions";
import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { Field } from "@/components/dashboard/field";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import {
  DASHBOARD_HOME_CARD,
  DASHBOARD_ICON_CHIP_SM,
  DASHBOARD_ICON_GLYPH_SM,
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import type { AccountLocationRow } from "@/lib/account-locations";
import { formatE164ForDisplay } from "@/lib/call-history-types";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { resolveOrganizationDisplayName } from "@/lib/organization-display-name";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type LocationsViewProps = {
  locations: AccountLocationRow[];
  accountName: string;
  locationLabel: string;
  canAddLocation: boolean;
  upgradeMessage: string | null;
  activeOrganizationId: string;
};

const initialState: LocationActionResult = { ok: false, message: "" };

const fieldClass = cn(DASHBOARD_INPUT_CLASS, "text-[13px] text-[#0b1220]");

export function LocationsView({
  locations,
  accountName,
  locationLabel,
  canAddLocation,
  upgradeMessage,
  activeOrganizationId,
}: LocationsViewProps) {
  const [state, formAction, pending] = useActionState(
    addAccountLocation,
    initialState,
  );

  const locationLabelLower = locationLabel.toLowerCase();
  const locationLabelPlural = `${locationLabelLower}s`;

  return (
    <div
      className={cn(DASHBOARD_PAGE_SHELL_FILL_WHITE, "overflow-hidden")}
      data-dashboard-fill
    >
      <DashboardAnimatedPageSections className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <DashboardPageHeader
          eyebrow="Locations"
          title={`${locationLabel}s`}
          icon={MapPin}
          description={`Manage every ${locationLabelLower} under ${accountName}.`}
          descriptionLine2="Each site gets its own phone number and Cara setup."
          summary={[
            { value: String(locations.length), label: locationLabelPlural },
          ]}
        />

        <section className={cn(DASHBOARD_HOME_CARD, "shrink-0")}>
          <h2 className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
            Your {locationLabelPlural}
          </h2>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200/90">
            {locations.map((location) => {
              const name = resolveOrganizationDisplayName(
                location.name,
                location.slug,
              );
              const isActive = location.id === activeOrganizationId;
              const phone = location.phoneNumber?.trim();
              const phoneDisplay = phone
                ? formatE164ForDisplay(phone) || phone
                : "Phone provisioning pending";

              return (
                <li
                  key={location.id}
                  className="flex flex-col gap-3 px-4 py-3.5 first:rounded-t-xl last:rounded-b-xl sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={DASHBOARD_ICON_CHIP_SM}>
                      <MapPin
                        className={DASHBOARD_ICON_GLYPH_SM}
                        aria-hidden
                      />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[14px] font-medium text-[#0b1220]">
                          {name}
                        </p>
                        {location.isPrimaryLocation ? (
                          <StatusPill variant="neutral">Primary</StatusPill>
                        ) : null}
                        {isActive ? (
                          <StatusPill variant="success" dot>
                            Active
                          </StatusPill>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[12px] text-slate-500">
                        {phoneDisplay}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 pl-10 sm:pl-0">
                    <Link
                      href={DASHBOARD_ROUTES.caraSetup}
                      className={cn(
                        DASHBOARD_SECONDARY_BUTTON_CLASS,
                        "inline-flex h-9 items-center px-3.5",
                      )}
                    >
                      Cara setup
                    </Link>
                    <Link
                      href={DASHBOARD_ROUTES.settings}
                      className={cn(
                        DASHBOARD_SECONDARY_BUTTON_CLASS,
                        "inline-flex h-9 items-center px-3.5",
                      )}
                    >
                      Settings
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {canAddLocation ? (
          <SectionCard
            icon={Plus}
            title={`Add ${locationLabelLower}`}
            description={`Open another ${locationLabelLower} under ${accountName}.`}
            className="shrink-0"
          >
            <form action={formAction} className="space-y-4">
              <Field label={`${locationLabel} name`} htmlFor="locationName">
                <Input
                  id="locationName"
                  name="locationName"
                  className={fieldClass}
                  placeholder="e.g. Riverside Dundrum"
                  required
                  minLength={2}
                  maxLength={120}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Address" htmlFor="address">
                  <Input
                    id="address"
                    name="address"
                    className={fieldClass}
                    placeholder="Street address"
                  />
                </Field>
                <Field label="Eircode" htmlFor="eircode">
                  <Input
                    id="eircode"
                    name="eircode"
                    className={fieldClass}
                    placeholder="D02 X285"
                  />
                </Field>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Button
                  type="submit"
                  disabled={pending}
                  className={DASHBOARD_PRIMARY_BUTTON_CLASS}
                >
                  {pending ? "Adding…" : `Add ${locationLabelLower}`}
                </Button>
                {state.ok === false && state.message ? (
                  <p className="text-[13px] text-red-600">{state.message}</p>
                ) : null}
                {state.ok ? (
                  <p className="text-[13px] text-emerald-700">
                    Location added. Switch to it from the sidebar to finish Cara
                    setup.
                  </p>
                ) : null}
              </div>
            </form>
          </SectionCard>
        ) : upgradeMessage ? (
          <p className="shrink-0 text-[13px] leading-relaxed text-slate-500">
            {upgradeMessage}{" "}
            <Link
              href={DASHBOARD_ROUTES.usage}
              className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
            >
              View plans
            </Link>
          </p>
        ) : null}
      </DashboardAnimatedPageSections>
    </div>
  );
}
