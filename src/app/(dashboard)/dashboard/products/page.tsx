import { CheckCircle2, CircleHelp, PackageSearch, XCircle } from "lucide-react";

import { DashboardAnimatedPageSections } from "@/components/dashboard/dashboard-animated-group";
import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_HOME_CONTENT_COLUMN,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
} from "@/components/dashboard/dashboard-surface";
import { requireDashboardSession } from "@/lib/dashboard-session";
import type { RetailStoreAssortmentStatus } from "@/lib/retail-store-assortment";
import { createAdminClient } from "@/utils/supabase/admin";

import { setProductAssortmentStatus } from "./actions";

type ProductsPageProps = {
  searchParams: Promise<{
    q?: string;
    filter?: string;
  }>;
};

type ProductRow = {
  id: string;
  product_name: string;
  brand: string | null;
  department: string | null;
  sku: string | null;
};

const STATUS_COPY: Record<
  RetailStoreAssortmentStatus,
  { label: string; description: string; className: string }
> = {
  stocked: {
    label: "Normally stocked",
    description: "Cara can say this store normally carries it, but not promise live shelf stock.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  not_stocked: {
    label: "Not stocked",
    description: "Cara will say it is in the wider range but this store does not normally stock it.",
    className: "border-rose-200 bg-rose-50 text-rose-800",
  },
  not_confirmed: {
    label: "Not confirmed",
    description: "Safe default. Cara will not claim this store carries it.",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
};

function statusIcon(status: RetailStoreAssortmentStatus) {
  if (status === "stocked") return CheckCircle2;
  if (status === "not_stocked") return XCircle;
  return CircleHelp;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { organizationId } = await requireDashboardSession();
  const params = await searchParams;
  const query = String(params.q ?? "").trim().slice(0, 100);
  const filter =
    params.filter === "stocked" ||
    params.filter === "not_stocked" ||
    params.filter === "not_confirmed"
      ? params.filter
      : "all";

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("niche, retail_banner")
    .eq("id", organizationId)
    .maybeSingle();

  const isRetail = String(org?.niche ?? "") === "retail";
  const retailBanner = String(org?.retail_banner ?? "").trim();

  let products: ProductRow[] = [];
  let loadError: string | null = null;

  if (isRetail && retailBanner && query.length >= 2) {
    let productQuery = admin
      .from("retail_catalog_products")
      .select("id, product_name, brand, department, sku")
      .eq("retail_banner", retailBanner)
      .ilike("search_text", `%${query}%`)
      .order("product_name", { ascending: true })
      .limit(50);

    if (retailBanner === "supervalu") {
      productQuery = productQuery.eq("is_national", true);
    }

    const { data, error } = await productQuery;
    if (error) {
      loadError = error.message;
    } else {
      products = (data ?? []) as ProductRow[];
    }
  }

  const productIds = products.map((product) => product.id);
  const overrides = new Map<string, RetailStoreAssortmentStatus>();

  if (productIds.length > 0) {
    const { data, error } = await admin
      .from("retail_store_product_assortment")
      .select("product_id, status")
      .eq("organization_id", organizationId)
      .in("product_id", productIds);

    if (error) {
      loadError = loadError ?? error.message;
    } else {
      for (const row of data ?? []) {
        if (row.status === "stocked" || row.status === "not_stocked") {
          overrides.set(row.product_id as string, row.status);
        }
      }
    }
  }

  const visibleProducts = products.filter((product) => {
    const status = overrides.get(product.id) ?? "not_confirmed";
    return filter === "all" || status === filter;
  });

  return (
    <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
      <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
        <DashboardAnimatedPageSections>
          <ClistePageHeader
            tone="inbox"
            icon={PackageSearch}
            title="Products"
            description="Tell Cara what this store normally stocks. Catalogue presence alone never means this shop carries an item."
          />

          {!isRetail || !retailBanner ? (
            <div className={`${DASHBOARD_CARD_SURFACE} p-5`}>
              <p className="text-sm font-medium text-slate-900">
                Product assortment is not configured for this store.
              </p>
            </div>
          ) : (
            <>
              <form
                method="get"
                className={`${DASHBOARD_CARD_SURFACE} flex flex-col gap-3 p-4 sm:flex-row sm:items-end`}
              >
                <label className="flex-1">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Search the {retailBanner === "supervalu" ? "SuperValu" : "retailer"} catalogue
                  </span>
                  <input
                    name="q"
                    defaultValue={query}
                    placeholder="e.g. Wagyu sirloin, avocados, Heinz ketchup"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  />
                </label>

                <label className="sm:w-44">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Store status
                  </span>
                  <select
                    name="filter"
                    defaultValue={filter}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                  >
                    <option value="all">All</option>
                    <option value="stocked">Normally stocked</option>
                    <option value="not_stocked">Not stocked</option>
                    <option value="not_confirmed">Not confirmed</option>
                  </select>
                </label>

                <button
                  type="submit"
                  className="h-11 rounded-xl bg-[#11181d] px-5 text-sm font-semibold text-white transition hover:bg-[#222c33]"
                >
                  Search
                </button>
              </form>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <strong className="font-semibold text-slate-800">Safe default:</strong>{" "}
                products start as <strong>Not confirmed</strong>. You only need to change items this store has actually confirmed.
              </div>

              {loadError ? (
                <p className="text-sm text-red-700">Could not load products: {loadError}</p>
              ) : query.length < 2 ? (
                <div className={`${DASHBOARD_CARD_SURFACE} p-6 text-center`}>
                  <PackageSearch className="mx-auto h-6 w-6 text-slate-400" />
                  <p className="mt-2 text-sm font-medium text-slate-800">
                    Search for a product to set this store&apos;s assortment.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    No one has to review thousands of products up front.
                  </p>
                </div>
              ) : visibleProducts.length === 0 ? (
                <div className={`${DASHBOARD_CARD_SURFACE} p-6 text-center text-sm text-slate-600`}>
                  No matching products for this search and filter.
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleProducts.map((product) => {
                    const status = overrides.get(product.id) ?? "not_confirmed";
                    const copy = STATUS_COPY[status];
                    const StatusIcon = statusIcon(status);

                    return (
                      <div
                        key={product.id}
                        className={`${DASHBOARD_CARD_SURFACE} p-4 sm:p-5`}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-[15px] font-semibold text-[#11181d]">
                                {product.product_name}
                              </h2>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${copy.className}`}
                              >
                                <StatusIcon className="h-3 w-3" />
                                {copy.label}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {[product.brand, product.department, product.sku ? `SKU ${product.sku}` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 max-w-2xl text-xs text-slate-600">
                              {copy.description}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {(
                              [
                                ["stocked", "Normally stocked"],
                                ["not_stocked", "Not stocked"],
                                ["not_confirmed", "Not confirmed"],
                              ] as const
                            ).map(([nextStatus, label]) => (
                              <form key={nextStatus} action={setProductAssortmentStatus}>
                                <input type="hidden" name="product_id" value={product.id} />
                                <input type="hidden" name="status" value={nextStatus} />
                                <button
                                  type="submit"
                                  disabled={status === nextStatus}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                  {label}
                                </button>
                              </form>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </DashboardAnimatedPageSections>
      </div>
    </div>
  );
}
