import { DASHBOARD_VIEWPORT_LAYOUT } from "@/components/dashboard/dashboard-surface";

/** Locks Calls to the dashboard viewport; scrolling happens inside list/detail panels. */
export default function CallHistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={DASHBOARD_VIEWPORT_LAYOUT}>{children}</div>;
}
