import { DASHBOARD_VIEWPORT_LAYOUT } from "@/components/dashboard/dashboard-surface";

/** Locks Action Inbox to the dashboard viewport; scrolling happens inside list/detail panels. */
export default function ActionInboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={DASHBOARD_VIEWPORT_LAYOUT}>{children}</div>;
}
