import { BadgePercent, CircleDollarSign, Tags } from "lucide-react";

import {
  compactRetailOfferLabel,
  formatRetailPriceEur,
  type RetailPricePresentation,
} from "@/lib/retail-price-presentation";

function formatSyncedAt(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-IE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Dublin",
  });
}

export function ProductPriceSummary({
  price,
  sourceLabel,
  syncedAt,
}: {
  price: RetailPricePresentation;
  sourceLabel: string;
  syncedAt: string | null;
}) {
  const current = formatRetailPriceEur(price.currentPriceEur);
  const regular = formatRetailPriceEur(price.regularPriceEur);
  const compactOffer = compactRetailOfferLabel(price.offerLabel);
  const synced = formatSyncedAt(syncedAt);
  const showWas =
    price.currentPriceEur != null &&
    price.regularPriceEur != null &&
    price.regularPriceEur > price.currentPriceEur + 0.001;

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-3 lg:w-[18rem] lg:shrink-0">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <CircleDollarSign className="h-3.5 w-3.5" aria-hidden />
          Cara price
        </p>
        {price.loyaltyRequired ? (
          <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700">
            {price.loyaltyProgram ?? "Real Rewards"}
          </span>
        ) : price.isOnOffer ? (
          <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700">
            On offer
          </span>
        ) : null}
      </div>

      {price.isMultibuy && price.multibuyTotalEur != null ? (
        <div className="mt-2">
          <p className="text-xl font-semibold tracking-tight text-slate-950">
            {price.multibuyQuantity} for{" "}
            {formatRetailPriceEur(price.multibuyTotalEur)}
          </p>
          {current ? (
            <p className="mt-1 text-xs text-slate-500">
              Single-item price {current}
            </p>
          ) : null}
          {price.multibuySavingEur != null ? (
            <p className="mt-1 text-xs font-medium text-slate-700">
              Save {formatRetailPriceEur(price.multibuySavingEur)} versus{" "}
              {price.multibuyQuantity} at the regular price
            </p>
          ) : null}
        </div>
      ) : current ? (
        <div className="mt-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-xl font-semibold tracking-tight text-slate-950">
              {current}
            </p>
            {showWas && regular ? (
              <span className="text-xs text-slate-400 line-through">
                {regular}
              </span>
            ) : null}
          </div>
          {price.savingsEur != null ? (
            <p className="mt-1 text-xs font-medium text-slate-700">
              Save {formatRetailPriceEur(price.savingsEur)}
              {price.savingsPercent != null
                ? " (" + Math.round(price.savingsPercent) + "%)"
                : ""}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-sm font-medium text-slate-500">
          Price unavailable
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {compactOffer ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700">
            {price.isMultibuy ? (
              <Tags className="h-3 w-3" aria-hidden />
            ) : (
              <BadgePercent className="h-3 w-3" aria-hidden />
            )}
            {compactOffer}
          </span>
        ) : null}
        {price.pricePerUnit ? (
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
            {price.pricePerUnit}
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-[10px] leading-4 text-slate-500">
        {sourceLabel}
        {synced ? " · synced " + synced : ""}
      </p>
    </div>
  );
}
