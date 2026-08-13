import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dashboardBreadcrumbs } from "./dashboard-breadcrumbs";
import { DASHBOARD_ROUTES } from "./dashboard-routes";

describe("dashboardBreadcrumbs", () => {
  it("uses Workspace > Overview for home", () => {
    assert.deepEqual(dashboardBreadcrumbs("/dashboard"), [
      { label: "Workspace", href: DASHBOARD_ROUTES.home },
      { label: "Overview" },
    ]);
  });

  it("uses Workspace > Activity for activity", () => {
    assert.deepEqual(dashboardBreadcrumbs(DASHBOARD_ROUTES.activity), [
      { label: "Workspace", href: DASHBOARD_ROUTES.home },
      { label: "Activity" },
    ]);
  });

  it("uses Cara > Greeting for greeting", () => {
    assert.deepEqual(dashboardBreadcrumbs(DASHBOARD_ROUTES.caraGreeting), [
      { label: "Cara", href: DASHBOARD_ROUTES.caraGreeting },
      { label: "Greeting" },
    ]);
  });

  it("uses Workspace > Training for training", () => {
    assert.deepEqual(dashboardBreadcrumbs(DASHBOARD_ROUTES.caraTraining), [
      { label: "Workspace", href: DASHBOARD_ROUTES.home },
      { label: "Training" },
    ]);
  });

  it("uses Business > Files for files", () => {
    assert.deepEqual(dashboardBreadcrumbs(DASHBOARD_ROUTES.businessFiles), [
      { label: "Business", href: DASHBOARD_ROUTES.businessProfile },
      { label: "Files" },
    ]);
  });

  it("uses Account > Settings for settings", () => {
    assert.deepEqual(dashboardBreadcrumbs(DASHBOARD_ROUTES.settings), [
      { label: "Account", href: DASHBOARD_ROUTES.settings },
      { label: "Settings" },
    ]);
  });

  it("uses Account > Legal for legal subpages", () => {
    assert.deepEqual(dashboardBreadcrumbs(DASHBOARD_ROUTES.legalDataRequests), [
      { label: "Account", href: DASHBOARD_ROUTES.settings },
      { label: "Legal" },
    ]);
  });
});
