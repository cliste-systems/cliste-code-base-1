import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/** Config files where vertical branching is permitted. */
const ALLOWLIST = new Set([
  "src/lib/verticals.ts",
  "src/lib/dashboard-vertical-copy.ts",
  "src/app/(onboarding)/onboarding/knowledge/train-cara-vertical-copy.ts",
  "src/app/(onboarding)/onboarding/knowledge/train-cara-services-copy.ts",
  "src/app/(onboarding)/onboarding/knowledge/train-cara-capture-fields.ts",
  "src/app/(onboarding)/onboarding/knowledge/train-cara-faq-suggestions.ts",
  "src/app/(onboarding)/onboarding/knowledge/train-cara-trade-topics.ts",
  "scripts/simulate-generic-niche-scorecard.ts",
]);

const FORBIDDEN_PATTERNS = [
  /===\s*["']salon_beauty["']/,
  /!==\s*["']salon_beauty["']/,
  /===\s*["']generic["']/,
  /!==\s*["']generic["']/,
  /verticalIdForNiche\([^)]*\)\s*===/,
  /verticalIdForNiche\([^)]*\)\s*!==/,
  /===\s*verticalIdForNiche\(/,
  /!==\s*verticalIdForNiche\(/,
];

async function walkSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      files.push(...(await walkSourceFiles(fullPath)));
      continue;
    }

    if (
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.endsWith(".test.ts")
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("vertical fork guardrail", () => {
  it("forbids salon_beauty/generic literal branches outside pack config files", async () => {
    const srcDir = path.join(REPO_ROOT, "src");
    const files = await walkSourceFiles(srcDir);
    const violations: string[] = [];

    for (const filePath of files) {
      const rel = path.relative(REPO_ROOT, filePath).split(path.sep).join("/");
      if (ALLOWLIST.has(rel)) continue;

      const content = await readFile(filePath, "utf8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(line)) {
            violations.push(`${rel}:${i + 1}: ${line.trim()}`);
            break;
          }
        }
      }
    }

    assert.equal(
      violations.length,
      0,
      [
        "Vertical branching belongs in pack config files.",
        "Add a capability flag or copy registry entry instead.",
        "",
        ...violations,
      ].join("\n"),
    );
  });
});
