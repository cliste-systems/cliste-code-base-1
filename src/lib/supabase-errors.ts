const MISSING_COLUMN_CODE = "42703";

export function isMissingPostgresColumn(
  error: { code?: string; message?: string } | null | undefined,
  column?: string,
): boolean {
  if (error?.code !== MISSING_COLUMN_CODE) return false;
  if (!column) return true;
  return error.message?.includes(column) ?? false;
}

export function databaseUpdateRequiredMessage(column?: string): string {
  if (column) {
    return `This save needs a database update (${column}). Try again shortly or contact support if it persists.`;
  }
  return "This save needs a database update. Try again shortly or contact support if it persists.";
}
