import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compileCaraOwnerPreview } from "./compile-cara-owner-preview";

describe("compileCaraOwnerPreview", () => {
  it("keeps voice short and business-focused", () => {
    const { voice, locked } = compileCaraOwnerPreview({
      businessName: "Sweeney Renewables",
      assistantDisplayName: "Cara",
      businessType: "Plumber",
      locationAddress: "Tullycullion",
      openingHours: "Mon–Fri 9–6",
      servicesOffered: "Plumbing\nBoiler servicing",
      faqs: [
        {
          question: "Do you offer quotes?",
          answer: "Yes, we can quote over the phone.",
        },
      ],
    });

    assert.match(voice, /Sweeney Renewables/);
    assert.match(voice, /Plumbing/);
    assert.match(voice, /Do you offer quotes/);
    assert.doesNotMatch(voice, /On a call, I can only promise/);
    assert.doesNotMatch(voice, /never change/);
    assert.doesNotMatch(voice, /From your call flow/);
    assert.equal(locked.length >= 5, true);
    assert.equal(
      locked.some((item) => item.title === "AI disclosure"),
      true,
    );
  });

  it("omits link wording when call flow has no routes or transfer", () => {
    const { voice } = compileCaraOwnerPreview({
      businessName: "Example Salon",
      assistantDisplayName: "Cara",
      businessType: "Salon",
      servicesOffered: "Cuts and colour",
    });

    assert.doesNotMatch(voice, /text them the link/i);
    assert.doesNotMatch(voice, /booking link/i);
  });

  it("mentions configured call flow actions in plain sentences", () => {
    const { voice } = compileCaraOwnerPreview({
      businessName: "Example Co",
      assistantDisplayName: "Cara",
      businessType: "Business",
      routes: [{ trigger: "Booking link", action: "text them the saved link" }],
      transferNumber: "+353 1 234 5678",
    });

    assert.match(voice, /booking link/i);
    assert.match(voice, /text them the link/i);
    assert.match(voice, /put them through/i);
    assert.doesNotMatch(voice, /Anything else →/);
  });
});
