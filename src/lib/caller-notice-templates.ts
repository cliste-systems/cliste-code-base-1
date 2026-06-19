import { CLISTE_COMPANY } from "@/lib/company-details";

export type CallerNoticeTemplateId = "website" | "signage" | "social";

export type CallerNoticeTemplate = {
  id: CallerNoticeTemplateId;
  title: string;
  description: string;
  body: string;
};

const processorName = CLISTE_COMPANY.legalName;
const processorPrivacyEmail = CLISTE_COMPANY.privacyEmail;

/** Copy-paste templates for salon controllers — replace bracketed placeholders. */
export const CALLER_NOTICE_TEMPLATES: CallerNoticeTemplate[] = [
  {
    id: "website",
    title: "Website privacy notice",
    description:
      "Add a short paragraph to your website privacy page, footer, or contact page before you go live.",
    body: `When you call [Business name], your call may be answered by our AI phone assistant provided by ${processorName}. Calls may be recorded and transcribed to handle your request; voice audio is not kept after the call. We use ${processorName} to process this data on our behalf as our data processor. For privacy requests about calls handled through this service, contact us at [Your email] or email ${processorPrivacyEmail}.`,
  },
  {
    id: "signage",
    title: "In-salon / reception signage",
    description:
      "Print and display near your phone, reception desk, or waiting area so callers see this before dialling.",
    body: `[Business name] — phone calls

Calls to our number may be answered by an AI assistant. Calls may be recorded and transcribed to help us handle your request. Voice audio is not stored after the call.

For privacy questions, speak to our team or email [Your email].`,
  },
  {
    id: "social",
    title: "Google Business / social bio",
    description:
      "Short wording for a Google Business Profile, Instagram bio link, or booking confirmation email footer.",
    body: `Calls to [Business name] may be answered by an AI assistant and may be recorded and transcribed. See our privacy notice or contact [Your email] for details.`,
  },
];
