import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractBusinessFileText,
  normalizeExtractedBusinessFileText,
} from "./business-file-extract";

const SAMPLE_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n" +
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n" +
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n" +
    "4 0 obj<< /Length 44 >>stream\nBT /F1 24 Tf 100 100 Td (Salon price list) Tj ET\nendstream endobj\n" +
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n" +
    "xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000274 00000 n \n0000000369 00000 n \n" +
    "trailer<< /Size 6 /Root 1 0 R >>\nstartxref\n438\n%%EOF",
);

describe("business-file-extract", () => {
  it("normalizes whitespace in extracted text", () => {
    assert.equal(
      normalizeExtractedBusinessFileText("  Hello   \n\n\n  world  "),
      "Hello\n\n  world",
    );
  });

  it("extracts text from CSV uploads", async () => {
    const result = await extractBusinessFileText(
      Buffer.from("Service,Price\nCut,45\n"),
      "prices.csv",
      "text/csv",
    );
    assert.equal(result.processingStatus, "ready");
    assert.match(result.text ?? "", /Cut,45/);
  });

  it("extracts text from text-based PDF uploads", async () => {
    const result = await extractBusinessFileText(
      SAMPLE_PDF,
      "price-list.pdf",
      "application/pdf",
    );
    assert.equal(result.processingStatus, "ready");
    assert.match(result.text ?? "", /Salon price list/i);
  });

  it("marks invalid PDF buffers as needs_processing", async () => {
    const result = await extractBusinessFileText(
      Buffer.from("not a pdf"),
      "broken.pdf",
      "application/pdf",
    );
    assert.equal(result.processingStatus, "needs_processing");
    assert.equal(result.text, null);
  });
});
