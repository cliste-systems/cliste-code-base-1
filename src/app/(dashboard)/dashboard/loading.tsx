import { DashboardRouteLoading } from "@/components/dashboard/dashboard-route-loading";

/** Shown in the main column while a dashboard route’s RSC tree resolves. */
export default function DashboardLoading() {
  return <DashboardRouteLoading label="Loading dashboard" />;
}
