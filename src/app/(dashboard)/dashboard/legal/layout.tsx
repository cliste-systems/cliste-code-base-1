import {
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
  DASHBOARD_VIEWPORT_LAYOUT,
} from "@/components/dashboard/dashboard-surface";
import { DashboardLegalShell } from "@/components/legal/dashboard-legal-shell";

export default function DashboardLegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={DASHBOARD_VIEWPORT_LAYOUT}>
      <div className={DASHBOARD_PAGE_SHELL_FILL_WHITE} data-dashboard-fill>
        <DashboardLegalShell>{children}</DashboardLegalShell>
      </div>
    </div>
  );
}
