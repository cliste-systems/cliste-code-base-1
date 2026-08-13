"use client";

import { Field } from "@/components/dashboard/field";
import { DASHBOARD_INPUT_CLASS } from "@/components/dashboard/dashboard-surface";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { CountyChipEditor } from "@/app/(dashboard)/dashboard/cara-setup/county-chip-editor";
import {
  CaraTrainingStepShell,
  TRAINING_SURFACE,
} from "./cara-training-step-shell";
import { TrainCaraInlineNotice } from "./train-cara-inline-notice";

type Props = {
  title: string;
  subtitle: string;
  helper?: string;
  locationAddress: string;
  onLocationAddressChange: (value: string) => void;
  baseTown: string;
  onBaseTownChange: (value: string) => void;
  locationCounty: string;
  onLocationCountyChange: (value: string) => void;
  locationEircode: string;
  onLocationEircodeChange: (value: string) => void;
  prefilledNotice?: string;
  showServiceArea?: boolean;
  serviceAreaItems?: string[];
  onServiceAreaItemsChange?: (items: string[]) => void;
  disabled?: boolean;
};

const INPUT = cn(DASHBOARD_INPUT_CLASS, "h-10 text-[13px]");

export function TrainCaraLocationStep({
  title,
  subtitle,
  helper,
  locationAddress,
  onLocationAddressChange,
  baseTown,
  onBaseTownChange,
  locationCounty,
  onLocationCountyChange,
  locationEircode,
  onLocationEircodeChange,
  prefilledNotice,
  showServiceArea = false,
  serviceAreaItems = [],
  onServiceAreaItemsChange,
  disabled = false,
}: Props) {
  return (
    <CaraTrainingStepShell
      title={title}
      subtitle={subtitle}
      helper={helper}
      compact
    >
      <div className={cn("w-full", TRAINING_SURFACE, "space-y-4 p-4 sm:p-5")}>
        <TrainCaraInlineNotice message={prefilledNotice} tone="brand" />
        <Field label="Street" htmlFor="train-cara-location-street">
          <Input
            id="train-cara-location-street"
            value={locationAddress}
            onChange={(event) => onLocationAddressChange(event.target.value)}
            placeholder="e.g. 14 Grafton Street"
            disabled={disabled}
            className={INPUT}
            autoComplete="street-address"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Town" htmlFor="train-cara-location-town">
            <Input
              id="train-cara-location-town"
              value={baseTown}
              onChange={(event) => onBaseTownChange(event.target.value)}
              placeholder="e.g. Letterkenny"
              disabled={disabled}
              className={INPUT}
              autoComplete="address-level2"
            />
          </Field>
          <Field label="County" htmlFor="train-cara-location-county">
            <Input
              id="train-cara-location-county"
              value={locationCounty}
              onChange={(event) => onLocationCountyChange(event.target.value)}
              placeholder="e.g. Donegal"
              disabled={disabled}
              className={INPUT}
              autoComplete="address-level1"
            />
          </Field>
        </div>

        <Field label="Eircode" htmlFor="train-cara-location-eircode">
          <Input
            id="train-cara-location-eircode"
            value={locationEircode}
            onChange={(event) =>
              onLocationEircodeChange(event.target.value.toUpperCase())
            }
            placeholder="e.g. F94 VKR9"
            disabled={disabled}
            className={cn(INPUT, "sm:max-w-[11rem]")}
            autoComplete="postal-code"
          />
        </Field>

        {showServiceArea && onServiceAreaItemsChange ? (
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <p className="text-[13px] font-medium text-slate-800">Areas you cover</p>
            <p className="text-[12px] text-slate-500">
              Counties or towns you travel to — tap to add.
            </p>
            <CountyChipEditor
              value={serviceAreaItems}
              onChange={onServiceAreaItemsChange}
            />
          </div>
        ) : null}
      </div>
    </CaraTrainingStepShell>
  );
}
