import { DashboardAnimatedStack } from "@/components/dashboard/dashboard-animated-group";
import { CallerNoticeTemplates } from "@/content/legal/caller-notice-templates";
import { requireDashboardSession } from "@/lib/dashboard-session";

export const metadata = {
  title: "Caller privacy notice — Legal — Cliste",
};

export default async function LegalCallerNoticePage() {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data: org } = await supabase
    .from("organizations")
    .select("caller_privacy_acknowledged_at")
    .eq("id", organizationId)
    .maybeSingle();

  return (
    <DashboardAnimatedStack embedded>
      <CallerNoticeTemplates
        acknowledgedAt={org?.caller_privacy_acknowledged_at ?? null}
      />
    </DashboardAnimatedStack>
  );
}
