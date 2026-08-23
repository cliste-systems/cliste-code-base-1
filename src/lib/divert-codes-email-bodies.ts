import { buildTransactionalEmailHtml } from "@/lib/transactional-email-layout";
import { PRODUCT_NAME } from "@/lib/company-details";
import type { ForwardingCode } from "@/lib/call-routing";

export type BuildDivertCodesEmailBodiesInput = {
  recipientName?: string;
  businessName: string;
  clisteNumber: string;
  codes: ForwardingCode[];
  cancelCode: string;
  logoUrl: string;
};

export function buildDivertCodesEmailBodies(
  input: BuildDivertCodesEmailBodiesInput,
): { subject: string; text: string; html: string } {
  const recipientName = input.recipientName?.trim() ?? "";
  const businessName = input.businessName.trim() || "your store";
  const clisteNumber = input.clisteNumber.trim();

  const subject = `Divert codes for ${businessName} — ${PRODUCT_NAME}`;

  const codeLines = input.codes.map(
    (c) =>
      `${c.label}: dial ${c.activate} (${c.hint}). Cancel: ${c.cancel}`,
  );

  const text = [
    recipientName ? `Hi ${recipientName},` : "Hi,",
    "",
    `Here are the call divert codes to connect ${businessName} to Cara on ${clisteNumber}.`,
    "",
    ...codeLines,
    "",
    `Cancel all diverts: ${input.cancelCode}`,
    "",
    "Dial these from the store mobile that will forward calls. Landline stores may need their carrier portal instead.",
  ].join("\n");

  const bodyHtml = [
    `<p>Connect <strong>${businessName}</strong> to Cara on <strong>${clisteNumber}</strong>.</p>`,
    "<ul>",
    ...input.codes.map(
      (c) =>
        `<li><strong>${c.label}</strong>: <code>${c.activate}</code><br/><span style="color:#64748b;font-size:13px">${c.hint}</span></li>`,
    ),
    "</ul>",
    `<p>Cancel every divert: <code>${input.cancelCode}</code></p>`,
  ].join("");

  const html = buildTransactionalEmailHtml({
    subject,
    logoUrl: input.logoUrl,
    headline: "Store divert codes",
    bodyHtml,
    ctaLabel: "Open dashboard",
    ctaHref: input.logoUrl.replace(/\/[^/]*$/, "/dashboard"),
    footerHtml:
      "Landline stores may configure forwarding in their carrier portal instead of dialling these codes.",
  });

  return { subject, text, html };
}
