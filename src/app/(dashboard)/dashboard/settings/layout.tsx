import {
  DASHBOARD_HOME_CONTENT_COLUMN,
  DASHBOARD_PAGE_SHELL_FILL_WHITE,
  DASHBOARD_VIEWPORT_LAYOUT,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={DASHBOARD_VIEWPORT_LAYOUT}>
      <div
        className={cn(DASHBOARD_PAGE_SHELL_FILL_WHITE, "gap-2 overflow-hidden")}
        data-dashboard-fill
      >
        <div className={DASHBOARD_HOME_CONTENT_COLUMN}>{children}</div>
      </div>
    </div>
  );
}
