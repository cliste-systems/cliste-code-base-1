/** Hard cap on Article 15 / 20 row fetches so exports cannot unbounded-scan. */
export const GDPR_EXPORT_ROW_CAP = 5000;

export function gdprExportWasTruncated(
  ...rowCounts: number[]
): boolean {
  return rowCounts.some((n) => n >= GDPR_EXPORT_ROW_CAP);
}
