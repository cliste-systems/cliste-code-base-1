import { parseCallRoutingMode } from "@/lib/call-routing";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { signupSegmentLabel } from "@/lib/signup-segment-label";

import { SettingsView } from "./settings-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data: org, error } = await supabase
    .from("organizations")
    .select(
      "is_active, status, name, phone_number, niche, agent_business_type, notification_email, notification_phone, call_routing_mode, fallback_number",
    )
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    return <p className="text-sm text-red-600">{error.message}</p>;
  }

  if (!org) {
    return (
      <p className="text-sm text-slate-600">
        No organization found for this session. Check your profile and sign in
        again.
      </p>
    );
  }

  const status = (org.status as string | null)?.trim().toLowerCase() ?? "";
  const accountStatus =
    status === "suspended"
      ? "Paused"
      : status && status !== "active"
        ? "—"
        : "Active";

  return (
    <SettingsView
      className="min-h-0 flex-1"
      initial={{
        isActive: org.is_active ?? true,
        businessName: org.name ?? "",
        phoneNumber: org.phone_number ?? "",
        signupSegment: signupSegmentLabel({
          niche: org.niche,
          businessType: org.agent_business_type,
        }),
        notificationEmail: org.notification_email ?? "",
        notificationPhone: org.notification_phone ?? "",
        callRoutingMode: parseCallRoutingMode(org.call_routing_mode),
        transferNumber: (org.fallback_number as string | null) ?? "",
        accountStatus,
      }}
    />
  );
}
