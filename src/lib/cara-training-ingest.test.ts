import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isRoutineHandoff } from "./cara-training-types";

describe("isRoutineHandoff", () => {
  it("treats routine bookings and callbacks as handoffs (kept out of Teach Cara)", () => {
    assert.equal(
      isRoutineHandoff(
        "Caller would like to book a root colour appointment, patch test required. Preferred Monday at 3pm.",
      ),
      true,
    );
    assert.equal(isRoutineHandoff("Wants a callback about a wedding party."), true);
    assert.equal(isRoutineHandoff("Asked us to ring her back."), true);
  });

  it("keeps genuine unanswered service questions (real training gaps)", () => {
    assert.equal(
      isRoutineHandoff("Martin asked if we offer hair extensions. Follow up to confirm."),
      false,
    );
    assert.equal(
      isRoutineHandoff("Caller asked whether we do gel removal — not on the menu."),
      false,
    );
  });
});

describe("action-ticket default ingest", () => {
  it("is not wired from the voice action-ticket route", async () => {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const path = await import("node:path");
    const repoRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../..",
    );
    const src = await readFile(
      path.join(repoRoot, "src/app/api/voice/action-ticket/route.ts"),
      "utf8",
    );
    assert.doesNotMatch(src, /ingestActionInboxTraining/);
  });
});
