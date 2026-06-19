import { buildTransactionalEmailHtml } from "@/lib/transactional-email-layout";

export function inviteEmailLogoUrl(origin: string, logoPath: string): string {
  return `${origin}${logoPath}`;
}

export type BuildInviteEmailBodiesInput = {
  actionLink: string;
  recipientName?: string;
  businessName: string;
  productName: string;
  logoUrl: string;
};

export function buildInviteEmailBodies(input: BuildInviteEmailBodiesInput): {
  subject: string;
  text: string;
  html: string;
} {
  const recipientName = input.recipientName?.trim() ?? "";
  const businessName = input.businessName.trim() || "your team";
  const productName = input.productName.trim() || "Business";

  const subject = recipientName
    ? `${recipientName}, you've been invited to Cliste`
    : "You've been invited to Cliste";

  const text = [
    recipientName ? `Hi ${recipientName},` : "Hi,",
    "",
    `You've been invited to join ${businessName} on Cliste.`,
    `You'll set up your password and access the ${productName} dashboard.`,
    "",
    "Accept your invitation:",
    input.actionLink,
    "",
    "This link expires after a while. If you did not expect this invitation, you can ignore this email.",
  ].join("\n");

  const html = buildTransactionalEmailHtml({
    subject,
    logoUrl: input.logoUrl,
    headline: `Join ${businessName} on Cliste`,
    bodyHtml: `You&apos;ve been invited to the ${productName} dashboard. Tap below to accept, set your password, and get started.`,
    ctaLabel: "Accept invitation",
    ctaHref: input.actionLink,
    footerHtml:
      "If you did not expect this invitation, you can ignore this email.",
  });

  return { subject, text, html };
}
