/** Client-safe types and copy for booking menu import (no server-only). */

export type BookingMenuImportService = {
  name: string;
  category: string;
  price: number | null;
  durationMinutes: number | null;
  notes: string;
};

export function formatBookingImportSuccessMessage(
  serviceCount: number,
  mergedCount: number,
): string {
  const base = `Imported ${serviceCount} service${serviceCount === 1 ? "" : "s"}`;
  if (mergedCount > 0) {
    return `${base}, merged ${mergedCount} duplicate${mergedCount === 1 ? "" : "s"}. Review prices and times.`;
  }
  return `${base}. Review prices and times.`;
}
