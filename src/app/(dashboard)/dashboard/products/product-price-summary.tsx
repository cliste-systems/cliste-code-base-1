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

function buildOfferDetail(price: RetailPricePresentation): string | null {
  const parts: string[] = [];

  if (price.isMultibuy && price.multibuyTotalEur != null) {
    const multibuyUnitPrice =
      price.multibuyQuantity != null
        ? Number((price.multibuyTotalEur / price.multibuyQuantity).toFixed(2))
        : null;
    if (multibuyUnitPrice != null) {
      parts.push(`${formatRetailPriceEur(multibuyUnitPrice)} each`);
    }
    if (price.multibuySavingEur != null) {
      parts.push(`Save ${formatRetailPriceEur(price.multibuySavingEur)}`);
    }
  } else if (price.savingsEur != null) {
    parts.push(
      `Save ${formatRetailPriceEur(price.savingsEur)}${
        price.savingsPercent != null
          ? ` (${Math.round(price.savingsPercent)}%)`
          : ""
      }`,
    );
  }

  const compactOffer = compactRetailOfferLabel(price.offerLabel);
  const hasComputedSavings =
    price.savingsEur != null || price.multibuySavingEur != null;
  if (compactOffer && !hasComputedSavings) {
    parts.push(compactOffer);
  }

  if (price.pricePerUnit) parts.push(price.pricePerUnit);

  return parts.length > 0 ? parts.join(" · ") : null;
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
  const offerDetail = buildOfferDetail(price);
  const synced = formatSyncedAt(syncedAt);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {price.isMultibuy && price.multibuyTotalEur != null ? (
          <>
            <span className="text-[15px] font-semibold tabular-nums tracking-tight text-[#11181d]">
              {price.multibuyQuantity} for{" "}
              {formatRetailPriceEur(price.multibuyTotalEur)}
            </span>
            {multibuyRegularTotal != null &&
            multibuyRegularTotal > price.multibuyTotalEur + 0.001 ? (
              <span className="text-[12px] tabular-nums text-[#87958f] line-through">
                {formatRetailPriceEur(multibuyRegularTotal)}
              </span>
            ) : null}
          </>
        ) : current ? (
          <>
            <span className="text-[15px] font-semibold tabular-nums tracking-tight text-[#11181d]">
              {current}
            </span>
            {showWas && regular ? (
              <span className="text-[12px] tabular-nums text-[#87958f] line-through">
                {regular}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-[13px] font-medium text-[#87958f]">No price</span>
        )}
        {price.loyaltyRequired ? (
          <span className="rounded-full border border-[#d9e2dd] bg-[#f7faf8] px-2 py-0.5 text-[10px] font-semibold text-[#4d5f58]">
            {price.loyaltyProgram ?? "Real Rewards"}
          </span>
        ) : null}
      </div>

      {offerDetail ? (
        <p className="text-[11px] leading-4 text-[#2f6b4f]">{offerDetail}</p>
      ) : null}

      <p
        className="text-[10px] leading-4 text-[#87958f]"
        title={sourceLabel}
      >
        {synced ? `Synced ${synced}` : "Sync time unknown"}
      </p>
    </div>
  );
}
