import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  departmentInsertsFromTemplate,
  organizationInsertFromStoreTemplate,
  STORE_TEMPLATE_ORG_COLUMNS,
} from "./store-from-template";

describe("store-from-template", () => {
  it("copies knowledge fields from the primary store", () => {
    const insert = organizationInsertFromStoreTemplate({
      accountId: "acc-1",
      locationName: "Letterkenny",
      slug: "letterkenny",
      address: "Main St",
      eircode: "F92 AAAA",
      planTier: "pro",
      primary: {
        id: "org-1",
        niche: "retail",
        agent_business_type: "supermarket",
        plan_tier: "pro",
        billing_interval: "month",
        tier: "native",
        call_routing_mode: "cliste_number",
        agent_voice_id: "voice-1",
        greeting: "Hello, SuperValu",
        assistant_display_name: "Cara",
        agent_faqs: [{ question: "Hours?", answer: "Nine to six" }],
        agent_opening_hours: "Mon–Sat 9–6",
        business_hours: { monday: { open: true, start: "09:00", end: "18:00" } },
        agent_services_departments: "Deli\nButcher",
        agent_services_not_offered: null,
        agent_business_rules: ["Never guess stock"],
        agent_cara_conduct: null,
        quote_prices_on_calls: false,
      },
    });
    assert.equal(insert.greeting, "Hello, SuperValu");
    assert.equal(insert.niche, "retail");
    assert.deepEqual(insert.agent_faqs, [
      { question: "Hours?", answer: "Nine to six" },
    ]);
    assert.equal(insert.agent_services_departments, "Deli\nButcher");
    assert.equal(insert.is_primary_location, false);
    assert.ok(STORE_TEMPLATE_ORG_COLUMNS.includes("agent_faqs"));
  });

  it("copies department rows onto the new org id without the source ids", () => {
    const rows = departmentInsertsFromTemplate(
      [
        {
          id: "old-id",
          organization_id: "org-1",
          name: "Deli",
          uses_store_hours: true,
          is_off_licence: false,
          is_an_post: false,
          sort_order: 0,
        },
      ],
      "org-2",
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.organization_id, "org-2");
    assert.equal(rows[0]?.name, "Deli");
    assert.equal(rows[0]?.id, undefined);
  });
});
