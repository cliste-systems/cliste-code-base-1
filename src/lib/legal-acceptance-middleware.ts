import {
  isLegalAcceptanceBypassPath,
} from "@/lib/legal-documents";
import { userHasCurrentLegalAcceptances } from "@/lib/legal-acceptance-status";

/** Used from middleware where the request pathname is always known. */
export async function dashboardPathNeedsLegalAcceptance(params: {
  pathname: string;
  userId: string;
  organizationId: string;
}): Promise<boolean> {
  if (!params.pathname.startsWith("/dashboard")) return false;
  if (isLegalAcceptanceBypassPath(params.pathname)) return false;

  const hasAcceptances = await userHasCurrentLegalAcceptances(
    params.userId,
    params.organizationId,
  );
  return !hasAcceptances;
}
