import type { Metadata } from "next";
import { Mail } from "lucide-react";

import { AdminPageShell } from "@/components/admin/admin-page-shell";
import {
  adminInboxFromEmail,
  adminInboxFromName,
} from "@/lib/resend-admin-inbox";
import { PRODUCT_NAME } from "@/lib/company-details";

import { AdminEmailInboxView } from "./admin-email-inbox-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} Admin — Inbox`,
};

export default function AdminInboxPage() {
  const fromEmail = adminInboxFromEmail();
  const fromName = adminInboxFromName();

  return (
    <AdminPageShell
      icon={Mail}
      title="Inbox"
      description={
        <>
          Receive and reply to HelloCara email. Replies send as{" "}
          <span className="font-medium text-slate-700">
            {fromName} &lt;{fromEmail}&gt;
          </span>
          .
        </>
      }
      fillViewport
    >
      <AdminEmailInboxView fromAddress={fromEmail} fromName={fromName} />
    </AdminPageShell>
  );
}
