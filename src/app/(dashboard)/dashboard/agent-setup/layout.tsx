import { DASHBOARD_VIEWPORT_LAYOUT } from "@/components/dashboard/dashboard-surface";

/** Locks Cara Setup to the dashboard viewport; scrolling happens inside columns. */
export default function AgentSetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={DASHBOARD_VIEWPORT_LAYOUT}>{children}</div>;
}
