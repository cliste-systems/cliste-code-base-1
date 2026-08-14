import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DASHBOARD_ROUTES,
  dashboardStripRedirect,
} from "./dashboard-routes";

describe("dashboardStripRedirect", () => {
  it("leaves the three store screens, legal, settings, support, and files", () => {
    assert.equal(dashboardStripRedirect("/dashboard"), null);
    assert.equal(dashboardStripRedirect("/dashboard/calls"), null);
    assert.equal(dashboardStripRedirect("/dashboard/setup"), null);
    assert.equal(dashboardStripRedirect("/dashboard/settings"), null);
    assert.equal(dashboardStripRedirect("/dashboard/support"), null);
    assert.equal(dashboardStripRedirect("/dashboard/legal"), null);
    assert.equal(dashboardStripRedirect("/dashboard/legal/data-requests"), null);
    assert.equal(dashboardStripRedirect("/dashboard/business/files"), null);
    assert.equal(dashboardStripRedirect("/dashboard/set-password"), null);
  });

  it("folds Action Inbox and contacts into Calls", () => {
    assert.equal(
      dashboardStripRedirect("/dashboard/action-inbox"),
      DASHBOARD_ROUTES.calls,
    );
    assert.equal(
      dashboardStripRedirect("/dashboard/action-inbox/x"),
      DASHBOARD_ROUTES.calls,
    );
    assert.equal(
      dashboardStripRedirect("/dashboard/contacts"),
      DASHBOARD_ROUTES.calls,
    );
  });

  it("sends retired setup surfaces to Setup and Knowledge Gaps", () => {
    assert.equal(
      dashboardStripRedirect("/dashboard/cara-training"),
      DASHBOARD_ROUTES.home,
    );
    assert.equal(
      dashboardStripRedirect("/dashboard/business/profile"),
      DASHBOARD_ROUTES.setup,
    );
    assert.equal(
      dashboardStripRedirect("/dashboard/cara-setup/services"),
      DASHBOARD_ROUTES.setup,
    );
    assert.equal(
      dashboardStripRedirect("/dashboard/routing/routes"),
      DASHBOARD_ROUTES.home,
    );
    assert.equal(
      dashboardStripRedirect("/dashboard/team"),
      DASHBOARD_ROUTES.home,
    );
    assert.equal(
      dashboardStripRedirect("/dashboard/locations"),
      DASHBOARD_ROUTES.home,
    );
    assert.equal(
      dashboardStripRedirect("/dashboard/cara/greeting"),
      DASHBOARD_ROUTES.setup,
    );
    assert.equal(
      dashboardStripRedirect("/dashboard/business/faqs"),
      DASHBOARD_ROUTES.setup,
    );
  });
});
