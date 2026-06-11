import {
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
  DASHBOARD_VIEWPORT_LAYOUT,
} from "@/components/dashboard/dashboard-surface";

import { RoutingFormProvider } from "./routing-form-context";
import { RoutingShell } from "./routing-shell";
import { loadRoutingPageData } from "./load-routing-page-data";

export const dynamic = "force-dynamic";

export default async function RoutingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await loadRoutingPageData();

  return (
    <div className={DASHBOARD_VIEWPORT_LAYOUT}>
      <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
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
  );
}
