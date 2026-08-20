import { redirect } from "next/navigation";

import {
  DASHBOARD_HOME_CONTENT_COLUMN,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
  DASHBOARD_VIEWPORT_LAYOUT,
} from "@/components/dashboard/dashboard-surface";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { requireDashboardSession } from "@/lib/dashboard-session";
import { verticalPackForNiche } from "@/lib/verticals";

import { RoutingFormProvider } from "./routing-form-context";
import { RoutingShell } from "./routing-shell";
import { loadRoutingPageData } from "./load-routing-page-data";

export const dynamic = "force-dynamic";

export default async function RoutingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireDashboardSession();
  const { data: org } = await session.supabase
    .from("organizations")
    .select("niche")
    .eq("id", session.organizationId)
    .maybeSingle();

  const pack = verticalPackForNiche(String(org?.niche ?? ""));
  if (pack.nav?.hiddenHrefs?.includes(DASHBOARD_ROUTES.routing)) {
    redirect(DASHBOARD_ROUTES.home);
  }

  const data = await loadRoutingPageData();

  return (
    <div className={DASHBOARD_VIEWPORT_LAYOUT}>
      <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
        <div className={DASHBOARD_HOME_CONTENT_COLUMN}>
          <RoutingFormProvider
            initialRoutes={data.initialRoutes}
            sendableFiles={data.sendableFiles}
            caraContext={data.caraContext}
            setupContext={data.setupContext}
          >
            <RoutingShell>{children}</RoutingShell>
          </RoutingFormProvider>
        </div>
      </div>
    </div>
  );
}
