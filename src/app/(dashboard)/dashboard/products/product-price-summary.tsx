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
  const multibuyRegularTotal =
    price.isMultibuy &&
    price.multibuyQuantity != null &&
    price.regularPriceEur != null
      ? Number((price.multibuyQuantity * price.regularPriceEur).toFixed(2))
      : null;
  const multibuyUnitPrice =
    price.isMultibuy &&
    price.multibuyQuantity != null &&
    price.multibuyTotalEur != null
      ? Number((price.multibuyTotalEur / price.multibuyQuantity).toFixed(2))
      : null;

  return (
    <div className="w-full rounded-lg border border-[#d9e2dd] bg-[#f6faf7] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#6b7c75]">
          <CircleDollarSign className="h-3.5 w-3.5" aria-hidden />
          Cara price
        </p>
        {price.loyaltyRequired ? (
          <span className="rounded-full border border-[#cfd9d4] bg-[#fbfcfb] px-2 py-0.5 text-[10px] font-semibold text-[#35443f]">
            {price.loyaltyProgram ?? "Real Rewards"}
          </span>
        ) : price.isOnOffer ? (
          <span className="rounded-full border border-[#cfd9d4] bg-[#fbfcfb] px-2 py-0.5 text-[10px] font-semibold text-[#35443f]">
            On offer
          </span>
        ) : null}
      </div>

      {price.isMultibuy && price.multibuyTotalEur != null ? (
        <div className="mt-1.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-[19px] font-semibold tracking-tight text-[#11181d]">
              {price.multibuyQuantity} for{" "}
              {formatRetailPriceEur(price.multibuyTotalEur)}
            </p>
            {multibuyRegularTotal != null &&
            multibuyRegularTotal > price.multibuyTotalEur + 0.001 ? (
              <span className="text-[11px] text-[#87958f] line-through">
                {formatRetailPriceEur(multibuyRegularTotal)}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
            {multibuyUnitPrice != null ? (
              <span className="text-[#6b7c75]">
                {formatRetailPriceEur(multibuyUnitPrice)} each
              </span>
            ) : null}
            {price.multibuySavingEur != null ? (
              <span className="font-medium text-[#35443f]">
                Save {formatRetailPriceEur(price.multibuySavingEur)}
              </span>
            ) : null}
          </div>
        </div>
      ) : current ? (
        <div className="mt-1.5">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-[19px] font-semibold tracking-tight text-[#11181d]">
              {current}
            </p>
            {showWas && regular ? (
              <span className="text-[11px] text-[#87958f] line-through">
                {regular}
              </span>
            ) : null}
          </div>
          {price.savingsEur != null ? (
            <p className="mt-0.5 text-[11px] font-medium text-[#35443f]">
              Save {formatRetailPriceEur(price.savingsEur)}
              {price.savingsPercent != null
                ? " (" + Math.round(price.savingsPercent) + "%)"
                : ""}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-1.5 text-[13px] font-medium text-[#6b7c75]">
          Price unavailable
        </p>
      )}

      {(compactOffer || price.pricePerUnit) ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {compactOffer ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#d9e2dd] bg-[#fbfcfb] px-1.5 py-0.5 text-[9.5px] font-medium text-[#4d5f58]">
              {price.isMultibuy ? (
                <Tags className="h-2.5 w-2.5" aria-hidden />
              ) : (
                <BadgePercent className="h-2.5 w-2.5" aria-hidden />
              )}
              {compactOffer}
            </span>
          ) : null}
          {price.pricePerUnit ? (
            <span className="rounded-full border border-[#d9e2dd] bg-[#fbfcfb] px-1.5 py-0.5 text-[9.5px] font-medium text-[#6b7c75]">
              {price.pricePerUnit}
            </span>
          ) : null}
        </div>
      ) : null}

      <p className="mt-1.5 truncate text-[9.5px] leading-4 text-[#87958f]" title={sourceLabel}>
        {sourceLabel}
        {synced ? " · synced " + synced : ""}
      </p>
    </div>
  );
}
