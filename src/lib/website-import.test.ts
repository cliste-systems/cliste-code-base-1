import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hostResolvesToPublic,
  isPrivateIp,
  normalisePublicWebsiteUrl,
} from "./website-import-ssrf";

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
