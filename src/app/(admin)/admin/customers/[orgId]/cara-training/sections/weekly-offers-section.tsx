"use client";

import { useCallback, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CaraTrainingField } from "@/components/admin/cara-training-field";
import { CaraTrainingSectionFooter } from "@/components/admin/cara-training-feedback";

import {
  previewSupervaluWeeklyOfferSearch,
  refreshSupervaluWeeklyOffers,
  type CaraTrainingData,
} from "@/app/(admin)/admin/organizations/[id]/cara-training/cara-training-actions";

import { SectionCard } from "./section-card";

type Props = {
  data: CaraTrainingData;
  onChange: (patch: Partial<CaraTrainingData>) => void;
  onSaved: () => Promise<void>;
};

export function WeeklyOffersSection({ data, onChange, onSaved }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await refreshSupervaluWeeklyOffers();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(
        `Synced ${result.offerCount} offers for ${result.organizationsUpdated} SuperValu store(s).` +
          (result.serviceAreaCounts
            ? ` Butcher ${result.serviceAreaCounts.butcher ?? 0}, deli ${result.serviceAreaCounts.deli ?? 0}, produce ${result.serviceAreaCounts.produce ?? 0}, off-licence ${result.serviceAreaCounts.off_licence ?? 0}.`
            : ""),
      );
      onChange({
        offersSyncedAt: result.syncedAt,
        offersOfferCount: result.offerCount,
        offersWeekStart: result.offerWeekStart,
        offersWeekEnd: result.offerWeekEnd,
      });
      await onSaved();
    });
  }, [onChange, onSaved]);

  const previewSearch = useCallback(() => {
    setPreview(null);
    startTransition(async () => {
      const result = await previewSupervaluWeeklyOfferSearch(data.previewOfferQuery);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setPreview(
        result.matches.length > 0
          ? result.matches.map((match) => match.quoteText).join("\n\n")
          : "No matching offer in the latest sync.",
      );
    });
  }, [data.previewOfferQuery]);

  if (data.retailBanner !== "supervalu") return null;

  const syncedLabel = data.offersSyncedAt
    ? new Date(data.offersSyncedAt).toLocaleString("en-IE", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Dublin",
      })
    : "Not synced yet";

  return (
    <SectionCard
      title="Weekly offers sync"
      description="National SuperValu promotional snapshot — butcher, deli, fish, produce, off-licence, and grocery. Cara quotes these via searchSuperValuProducts on calls."
    >
      <CaraTrainingField label="Last sync" feed="prompt">
        <p className="text-sm text-slate-700">
          {syncedLabel}
          {data.offersOfferCount > 0
            ? ` — ${data.offersOfferCount} active offer rows`
            : ""}
          {data.offersWeekStart && data.offersWeekEnd
            ? ` (${data.offersWeekStart} to ${data.offersWeekEnd})`
            : ""}
        </p>
      </CaraTrainingField>

      <CaraTrainingField
        label="Search preview"
        feed="prompt"
        hint="Try Heinz ketchup, weekly offers, or rashers to verify sync quality."
      >
        <div className="flex flex-wrap gap-2">
          <Input
            value={data.previewOfferQuery}
            onChange={(e) => onChange({ previewOfferQuery: e.target.value })}
            placeholder="striploin steak"
            className="max-w-sm"
          />
          <Button type="button" variant="outline" disabled={pending} onClick={previewSearch}>
            Preview match
          </Button>
        </div>
        {preview ? (
          <p className="text-muted-foreground mt-2 whitespace-pre-wrap text-xs">{preview}</p>
        ) : null}
      </CaraTrainingField>

      <CaraTrainingSectionFooter saved={Boolean(message)} error={error}>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={pending} onClick={refresh}>
            <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
            {pending ? "Syncing…" : "Refresh weekly offers now"}
          </Button>
          <a
            href="/api/admin/supervalu-offers-snapshot"
            download="supervalu-weekly-offers.json"
            className={buttonVariants({ variant: "outline" })}
          >
            Download JSON snapshot
          </a>
        </div>
        {message ? <span className="text-emerald-700 text-xs">{message}</span> : null}
      </CaraTrainingSectionFooter>
    </SectionCard>
  );
}
