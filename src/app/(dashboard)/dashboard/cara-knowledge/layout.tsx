import { DASHBOARD_VIEWPORT_LAYOUT } from "@/components/dashboard/dashboard-surface";

/** Locks Cara's Knowledge to the dashboard viewport; scrolling happens inside panels. */
export default function CaraKnowledgeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className={DASHBOARD_VIEWPORT_LAYOUT}>{children}</div>;
}
