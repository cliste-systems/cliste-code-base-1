import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BusinessFileListItem } from "./business-files";
import {
  BUSINESS_FILE_PROMPT_CHAR_BUDGET,
  sliceFileTextForPrompt,
} from "./business-file-prompt";
import {
  chunkExtractedText,
  searchBusinessFileText,
  searchBusinessFilesInList,
} from "./business-file-search";

function makeFile(
  partial: Partial<BusinessFileListItem> & Pick<BusinessFileListItem, "id" | "extractedText">,
): BusinessFileListItem {
  return {
    fileName: "menu.pdf",
    fileType: "pdf",
    mimeType: "application/pdf",
    sizeBytes: 1000,
    answerEnabled: true,
    sendEnabled: false,
    documentKind: "price_list",
    title: null,
    caraDescription: null,
    whenToUse: null,
    processingStatus: "ready",
    createdAt: "2026-06-19T00:00:00.000Z",
    ...partial,
  };
}

describe("business-file-search", () => {
  it("chunks long extracted text with overlap", () => {
    const lines = Array.from({ length: 40 }, (_, i) => `Service line ${i + 1} — €${i + 1}0`);
    const text = lines.join("\n");
    const chunks = chunkExtractedText(text, { targetChars: 120, overlapLines: 1 });

    assert.ok(chunks.length > 1);
    assert.ok(chunks.every((chunk) => chunk.text.length <= 200));
  });

  it("finds a price line deep in a large document", () => {
    const filler = "General information about the business.\n".repeat(800);
    const needle = "Gel manicure full set — €45";
    const text = `${filler}${needle}\nClassic pedicure — €35`;

    const slice = sliceFileTextForPrompt(text, BUSINESS_FILE_PROMPT_CHAR_BUDGET);
    assert.equal(slice?.wasTruncated, true);

    const excerpts = searchBusinessFileText({
      text,
      query: "gel manicure price",
    });

    assert.ok(excerpts.length > 0);
    assert.match(excerpts[0]!.text, /Gel manicure full set — €45/);
  });

  it("returns empty results for unrelated queries", () => {
    const text = "Haircut — €30\nColour — €80";
    const excerpts = searchBusinessFileText({
      text,
      query: "plumbing emergency",
    });
    assert.equal(excerpts.length, 0);
  });

  it("scopes search to a specific file in a list", () => {
    const files = [
      makeFile({
        id: "file-a",
        fileName: "salon-menu.pdf",
        extractedText: "Gel manicure — €45",
      }),
      makeFile({
        id: "file-b",
        fileName: "brochure.pdf",
        documentKind: "brochure",
        extractedText: "Company overview and history",
      }),
    ];

    const matches = searchBusinessFilesInList(files, {
      query: "gel manicure",
      fileId: "file-b",
    });

    assert.equal(matches.length, 0);
  });

  it("filters by document kind", () => {
    const files = [
      makeFile({
        id: "file-a",
        extractedText: "Gel manicure — €45",
        documentKind: "price_list",
      }),
      makeFile({
        id: "file-b",
        extractedText: "Gel manicure — €45",
        documentKind: "menu",
      }),
    ];

    const matches = searchBusinessFilesInList(files, {
      query: "gel manicure",
      documentKind: "menu",
    });

    assert.equal(matches.length, 1);
    assert.equal(matches[0]!.fileId, "file-b");
  });
});
