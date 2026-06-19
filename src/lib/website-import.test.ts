import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractIrishEircodes,
  isValidIrishEircode,
  normalizeEircode,
} from "./irish-eircode";
import {
  hostResolvesToPublic,
  isPrivateIp,
  normalisePublicWebsiteUrl,
} from "./website-import-ssrf";
import {
  buildMultiLocationFaq,
  extractLocationsFromPageText,
  finalizeImportLocations,
} from "./website-import-locations";

const SOUTH_EAST_CONTACT_TEXT = `
The South East Hand & Foot Spa (Carrick-on-Shannon) Main Street Carrick-on-Shannon
Leitrim, N41X6T3 Email: hello@thesoutheast.ie Tel: 071 965 0831
The South East Hand & Foot Spa (Sligo) Wine Street Sligo, F91 T638
Email: hellosligo@thesoutheast.ie Tel: 071 914 0291
Zurich, Switzerland Coming Soon
`;

describe("irish-eircode", () => {
  it("normalizes compact and spaced eircodes", () => {
    assert.equal(normalizeEircode("f91t638"), "F91 T638");
    assert.equal(normalizeEircode("N41 X6T3"), "N41 X6T3");
  });

  it("rejects comma-separated multiples", () => {
    assert.equal(normalizeEircode("N41X6T3, F91"), null);
    assert.equal(isValidIrishEircode("N41X6T3, F91"), false);
  });

  it("extracts distinct eircodes from text", () => {
    const codes = extractIrishEircodes(SOUTH_EAST_CONTACT_TEXT);
    assert.deepEqual(codes, ["N41 X6T3", "F91 T638"]);
  });
});

describe("website-import multi-location", () => {
  it("parses multiple branches from contact-style text", () => {
    const locations = extractLocationsFromPageText(SOUTH_EAST_CONTACT_TEXT);
    assert.equal(locations.length, 2);
    assert.equal(locations[0]?.eircode, "N41 X6T3");
    assert.equal(locations[1]?.eircode, "F91 T638");
    assert.match(locations[0]?.label ?? "", /Carrick/i);
    assert.match(locations[1]?.label ?? "", /Sligo/i);
  });

  it("builds a combined location FAQ", () => {
    const locations = extractLocationsFromPageText(SOUTH_EAST_CONTACT_TEXT);
    const faq = buildMultiLocationFaq(locations);
    assert.equal(faq.question, "Where are you located?");
    assert.match(faq.answer, /N41 X6T3/);
    assert.match(faq.answer, /F91 T638/);
  });

  it("rebuilds locations when AI merged eircodes", () => {
    const result = finalizeImportLocations({
      aiLocations: [],
      flatAddress: "Main Street Carrick-on-Shannon Lei",
      flatEircode: "N41X6T3, F91",
      pageText: SOUTH_EAST_CONTACT_TEXT,
    });
    assert.equal(result.address, "");
    assert.equal(result.eircode, "");
    assert.equal(result.locations.length, 2);
    assert.equal(result.locations[0]?.eircode, "N41 X6T3");
    assert.equal(result.locations[1]?.eircode, "F91 T638");
  });
});

describe("website-import SSRF guards", () => {
  it("flags private IPv4", () => {
    assert.equal(isPrivateIp("127.0.0.1"), true);
    assert.equal(isPrivateIp("10.0.0.1"), true);
    assert.equal(isPrivateIp("169.254.169.254"), true);
    assert.equal(isPrivateIp("8.8.8.8"), false);
  });

  it("rejects localhost hostnames", async () => {
    assert.equal(await hostResolvesToPublic("localhost"), false);
    assert.equal(await normalisePublicWebsiteUrl("http://127.0.0.1/"), null);
    assert.equal(
      await normalisePublicWebsiteUrl("http://169.254.169.254/"),
      null,
    );
  });
});
