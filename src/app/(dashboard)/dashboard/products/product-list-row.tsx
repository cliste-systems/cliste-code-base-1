import type { LucideIcon } from "lucide-react";

import type { RetailStoreAssortmentStatus } from "@/lib/retail-store-assortment";

import { setProductAssortmentStatus } from "./actions";
import { ProductPriceSummary } from "./product-price-summary";

type ProductListRowProps = {
  productId: string;
  productName: string;
  metaLine: string;
  status: RetailStoreAssortmentStatus;
  statusLabel: string;
  statusClassName: string;
  StatusIcon: LucideIcon;
  areaLabel: string | null;
  fulfilmentLabel: string | null;
  fulfilment: string | null;
  pricing: {
    price: Parameters<typeof ProductPriceSummary>[0]["price"];
    sourceLabel: string;
    syncedAt: string | null;
  } | null;
};

export function ProductListRow({
  productId,
  productName,
  metaLine,
  status,
  statusLabel,
  statusClassName,
  StatusIcon,
  areaLabel,
  fulfilmentLabel,
  fulfilment,
  pricing,
}: ProductListRowProps) {
  return (
    <tr className="border-t border-[#e8efeb] first:border-t-0">
      <td className="px-4 py-3 align-top">
        <div className="min-w-[16rem] space-y-1.5">
          <p
            className="text-[14px] font-semibold leading-5 text-[#11181d]"
            title={productName}
          >
            {productName}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-none ${statusClassName}`}
            >
              <StatusIcon className="h-3 w-3 shrink-0" />
              {statusLabel}
            </span>
            {areaLabel ? (
              <span className="inline-flex items-center rounded-full border border-[#d6dfda] bg-[#f7faf8] px-2.5 py-1 text-[10px] font-semibold leading-none text-[#4d5f58]">
                {areaLabel}
              </span>
            ) : null}
            {fulfilmentLabel ? (
              <span
                className={
                  fulfilment === "counter"
                    ? "inline-flex items-center rounded-full border border-[#9da9a4] bg-[#f3f6f4] px-2.5 py-1 text-[10px] font-semibold leading-none text-[#11181d]"
                    : "inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold leading-none text-slate-600"
                }
              >
                {fulfilmentLabel}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] leading-4 text-[#87958f]" title={metaLine}>
            {metaLine}
          </p>
        </div>
      </td>

      <td className="px-4 py-3 align-top">
        {pricing ? (
          <ProductPriceSummary
            price={pricing.price}
            sourceLabel={pricing.sourceLabel}
            syncedAt={pricing.syncedAt}
          />
        ) : (
          <span className="text-[13px] text-[#87958f]">—</span>
        )}
      </td>

      <td className="px-4 py-3 align-top">
        <div className="grid min-w-[21rem] grid-cols-3 gap-1 rounded-md border border-[#dfe7e2] bg-[#f8faf9] p-1">
          {(
            [
              ["stocked", "Stocked"],
              ["not_stocked", "No stock"],
              ["not_confirmed", "Unconfirmed"],
            ] as const
          ).map(([nextStatus, label]) => (
            <form key={nextStatus} action={setProductAssortmentStatus}>
              <input type="hidden" name="product_id" value={productId} />
              <input type="hidden" name="status" value={nextStatus} />
              <button
                type="submit"
                aria-pressed={status === nextStatus}
                disabled={status === nextStatus}
                title={nextStatus === "not_stocked" ? "Not stocked" : label}
                className={
                  status === nextStatus
                    ? "h-8 w-full whitespace-nowrap rounded-[5px] bg-[#11181d] px-2.5 text-[11px] font-medium text-white"
                    : "h-8 w-full whitespace-nowrap rounded-[5px] px-2.5 text-[11px] font-medium text-[#5b6b65] transition-colors hover:bg-white hover:text-[#11181d]"
                }
              >
                {label}
              </button>
            </form>
          ))}
        </div>
      </td>
    </tr>
  );
}
