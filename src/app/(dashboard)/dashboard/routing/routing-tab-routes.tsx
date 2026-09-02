import dynamic from "next/dynamic";

import { DashboardRouteLoading } from "@/components/dashboard/dashboard-route-loading";

const RoutingFlowCanvas = dynamic(
  () => import("./routing-flow-canvas").then((mod) => mod.RoutingFlowCanvas),
  {
    loading: () => <DashboardRouteLoading label="Loading call flow editor" />,
  },
);

export function RoutingTabRoutes() {
  return <RoutingFlowCanvas />;
}
