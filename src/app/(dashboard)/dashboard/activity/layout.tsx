import { DASHBOARD_VIEWPORT_LAYOUT } from "@/components/dashboard/dashboard-surface";

/** Locks Activity to the dashboard viewport; scrolling happens inside the feed panel. */
export default function ActivityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={DASHBOARD_VIEWPORT_LAYOUT}>{children}</div>;
}
