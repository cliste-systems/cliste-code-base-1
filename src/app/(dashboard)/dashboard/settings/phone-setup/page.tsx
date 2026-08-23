import { loadTenantPhoneSetup } from "@/lib/load-tenant-phone-setup";
import { requireDashboardSession } from "@/lib/dashboard-session";

import { PhoneSetupView } from "./phone-setup-view";

export const dynamic = "force-dynamic";

export default async function PhoneSetupPage() {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data: org } = await supabase
    .from("organizations")
    .select("niche")
    .eq("id", organizationId)
    .maybeSingle();

  if (org?.niche !== "retail") {
    return (
      <p className="text-sm text-slate-600">
        Phone setup details are available for retail stores only.
      </p>
    );
  }

  const setup = await loadTenantPhoneSetup(supabase, organizationId);

  return (
    <PhoneSetupView
      storeName={setup.storeName}
      verdict={setup.verdict}
      activeDepartments={setup.activeDepartments}
      transferVerifiedAt={setup.transferVerifiedAt}
      clisteNumber={setup.clisteReadiness.clisteNumber}
      clisteDetail={setup.clisteReadiness.detail}
    />
  );
}
