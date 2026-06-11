import {
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
        className={cn(
          DASHBOARD_PAGE_SHELL_FILL_WHITE,
          "gap-2 p-3 sm:p-4 lg:px-8 lg:py-4",
        )}
        data-dashboard-fill
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
