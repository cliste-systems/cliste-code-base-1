import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseBookingMenuFromHtml,
  parseDurationCaption,
} from "./booking-menu-platform-parsers";

const FRESHA_FIXTURE = `
<html>
<body>
<script id="__NEXT_DATA__" type="application/json">{
  "props": {
    "pageProps": {
      "data": {
        "location": {
          "services": [
            {
              "name": "Hand & Foot Treatments",
              "items": [
                {
                  "name": "Mini Manicure",
                  "retailPrice": { "currency": "EUR", "value": 30 },
                  "caption": "35 min",
                  "description": "Quick tidy-up."
                },
                {
                  "name": "Deluxe Pedicure",
                  "retailPrice": { "currency": "EUR", "value": 70 },
                  "caption": "1 hr 10 min",
                  "description": ""
                }
              ]
            },
            {
              "name": "Gel Polish & BIAB",
              "items": [
                {
                  "name": "BIAB / Gel Overlay",
                  "retailPrice": { "currency": "EUR", "value": 50 },
                  "caption": "1 hr, 5 min",
                  "description": "Long-lasting overlay."
                }
              ]
            }
          ]
        }
      }
    }
  }
}</script>
</body>
</html>
`;

const BOOKSY_FIXTURE = `
<html>
<body>
<script type="application/ld+json">{
  "@context": "https://schema.org",
  "@type": "HairSalon",
  "makesOffer": [
    {"@type":"Offer","name":"Haircut + Wash + Style","priceCurrency":"EUR","price":37},
    {"@type":"Offer","name":"Hot towel shave","priceCurrency":"EUR","price":30},
    {"@type":"Offer","name":"Haircut","priceCurrency":"EUR","price":40}
  ]
}</script>
{"@type":"Offer","name":"Haircut + Wash + Style","priceCurrency":"EUR","price":37}
{"@type":"Offer","name":"Hot towel shave","priceCurrency":"EUR","price":30}
</body>
</html>
`;

describe("parseDurationCaption", () => {
  it("parses minutes only", () => {
    assert.equal(parseDurationCaption("35 min"), 35);
  });

  it("parses hours and minutes", () => {
    assert.equal(parseDurationCaption("1 hr 10 min"), 70);
    assert.equal(parseDurationCaption("1 hr, 5 min"), 65);
  });

  it("returns null for empty input", () => {
    assert.equal(parseDurationCaption(""), null);
    assert.equal(parseDurationCaption("   "), null);
  });
});

describe("parseBookingMenuFromHtml", () => {
  it("extracts Fresha services from __NEXT_DATA__", () => {
    const services = parseBookingMenuFromHtml(
      "www.fresha.com",
      FRESHA_FIXTURE,
    );
    assert.ok(services);
    assert.equal(services.length, 3);

    const manicure = services.find((s) => s.name === "Mini Manicure");
    assert.ok(manicure);
    assert.equal(manicure.category, "Hand & Foot Treatments");
    assert.equal(manicure.price, 30);
    assert.equal(manicure.durationMinutes, 35);
    assert.equal(manicure.notes, "");

    const biab = services.find((s) => s.name === "BIAB / Gel Overlay");
    assert.ok(biab);
    assert.equal(biab.category, "Gel Polish & BIAB");
    assert.equal(biab.price, 50);
    assert.equal(biab.durationMinutes, 65);
  });

  it("extracts Booksy offers from inline schema JSON", () => {
    const services = parseBookingMenuFromHtml("booksy.com", BOOKSY_FIXTURE);
    assert.ok(services);
    assert.equal(services.length, 3);
    assert.deepEqual(
      services.map((s) => s.name).sort(),
      ["Haircut", "Haircut + Wash + Style", "Hot towel shave"],
    );
    assert.equal(
      services.find((s) => s.name === "Haircut + Wash + Style")?.price,
      37,
    );
  });

  it("returns null for unsupported hosts", () => {
    assert.equal(
      parseBookingMenuFromHtml("example.com", FRESHA_FIXTURE),
      null,
    );
  });

  it("returns null when Fresha payload is missing", () => {
    assert.equal(
      parseBookingMenuFromHtml("fresha.com", "<html><body>No data</body></html>"),
      null,
    );
  });
});
