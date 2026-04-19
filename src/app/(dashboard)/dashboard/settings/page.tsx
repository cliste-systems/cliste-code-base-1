import { requireDashboardSession } from "@/lib/dashboard-session";

import { parseBusinessHoursFromDb } from "./business-hours";
import { parseBookingRulesFromDb } from "./actions";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data: org, error } = await supabase
    .from("organizations")
    .select("is_active, fresha_url, tier, business_hours, booking_rules")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-[#fafafa] pb-2">
        <p className="text-destructive p-4 text-sm">{error.message}</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-[#fafafa] pb-2">
        <p className="text-muted-foreground p-4 text-sm">
          No organization row found for this session. Check that your profile has
          a valid{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-xs">
            organization_id
          </code>{" "}
          and that RLS allows you to read it, then sign in again.
        </p>
      </div>
    );
  }

  const week = parseBusinessHoursFromDb(org.business_hours);
  const bookingRules = parseBookingRulesFromDb(org.booking_rules);
  const showFreshaSettings = org.tier === "connect";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#fafafa] pb-2">
      <SettingsForm
        showFreshaSettings={showFreshaSettings}
        initial={{
          isActive: org.is_active ?? true,
          freshaUrl: org.fresha_url ?? "",
          week,
          bookingRules,
        }}
      />
    </div>
  );
}
