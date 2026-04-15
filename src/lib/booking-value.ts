import type { SupabaseClient } from "@supabase/supabase-js";

function priceFromServicesJoin(
  services: unknown,
): number {
  if (!services) return 0;
  const row = Array.isArray(services) ? services[0] : services;
  if (!row || typeof row !== "object") return 0;
  const p = (row as { price?: unknown }).price;
  const n = typeof p === "number" ? p : Number(p ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export type SumAppointmentBookingValueOpts = {
  /** When omitted, sums across all organizations (service role / admin client). */
  organizationId?: string;
  rangeStartIso: string;
  rangeEndExclusiveIso: string | null;
};

/**
 * Sum of service prices for appointments in the time range (by `created_at`),
 * counting only confirmed or completed bookings.
 */
export async function sumAppointmentBookingValueEur(
  supabase: SupabaseClient,
  opts: SumAppointmentBookingValueOpts,
): Promise<number> {
  let q = supabase
    .from("appointments")
    .select("services(price)")
    .gte("created_at", opts.rangeStartIso)
    .in("status", ["confirmed", "completed"]);
  if (opts.organizationId) {
    q = q.eq("organization_id", opts.organizationId);
  }
  if (opts.rangeEndExclusiveIso) {
    q = q.lt("created_at", opts.rangeEndExclusiveIso);
  }
  const { data, error } = await q;
  if (error || !data) return 0;
  return data.reduce((sum, row) => sum + priceFromServicesJoin(row.services), 0);
}

export function formatBookingValueEur(amount: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
