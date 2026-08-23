import type { Metadata } from "next";
import { ScrollText } from "lucide-react";

import { AdminPageShell } from "@/components/admin/admin-page-shell";
import {
  NEVER_PROMISE_INSTRUCTION,
  PHOTO_HANDLING_INSTRUCTION,
} from "@/lib/call-handling-boundary";
import { PRODUCT_NAME } from "@/lib/company-details";
import { loadPlatformCaraRules } from "@/lib/platform-cara-rules";
import {
  RETAIL_AGE_RESTRICTED_INSTRUCTION,
  RETAIL_ALLERGEN_INSTRUCTION,
  RETAIL_LIVE_STOCK_PRICE_INSTRUCTION,
} from "@/lib/retail-prompt-boundaries";
import { createAdminClient } from "@/utils/supabase/admin";

import { PlatformRulesForm } from "./platform-rules-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} Admin — Platform rules`,
};

async function editorLabel(updatedBy: string | null | undefined): Promise<string | null> {
  if (!updatedBy) return null;
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(updatedBy);
  return data.user?.email ?? updatedBy;
}

export default async function PlatformRulesAdminPage() {
  const admin = createAdminClient();
  const rules = await loadPlatformCaraRules(admin);
  const editor = await editorLabel(rules.updatedBy);
  const updatedAt = rules.updatedAt
    ? new Date(rules.updatedAt).toLocaleString("en-IE", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <AdminPageShell
      icon={ScrollText}
      title="Cara platform rules"
      description="Master behaviour for every niche. Applies to all customers — store owners cannot edit these."
      maxWidth="3xl"
    >
      {updatedAt ? (
        <p className="text-sm text-slate-600">
          Last saved {updatedAt}
          {editor ? ` by ${editor}` : ""}.
        </p>
      ) : null}

      <PlatformRulesForm initialRules={rules} />

      <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-6">
        <h2 className="text-sm font-semibold text-[#0b1220]">
          Locked guardrails (code)
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          These stay in the codebase for compliance and safety. Tenant business
          rules cannot override them.
        </p>
        <ul className="mt-4 space-y-2 text-xs leading-relaxed text-slate-700">
          <li>One question per turn on live calls.</li>
          <li>Never guess — take a message when unsure.</li>
          <li>
            Never collect card numbers, PINs, PPS numbers, IBANs, or passwords.
          </li>
          <li>{PHOTO_HANDLING_INSTRUCTION}</li>
          <li>{NEVER_PROMISE_INSTRUCTION}</li>
          <li>
            Compliance lint blocks tenant rules that say &quot;don&apos;t mention
            AI&quot; or &quot;skip disclosure&quot;.
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-6">
        <h2 className="text-sm font-semibold text-[#0b1220]">
          Retail vertical pack (code)
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Niche-specific boundaries for managed retail stores — defined in code,
          not on this page.
        </p>
        <ul className="mt-4 space-y-2 text-xs leading-relaxed text-slate-700">
          <li>{RETAIL_LIVE_STOCK_PRICE_INSTRUCTION}</li>
          <li>{RETAIL_AGE_RESTRICTED_INSTRUCTION}</li>
          <li>{RETAIL_ALLERGEN_INSTRUCTION}</li>
        </ul>
      </section>
    </AdminPageShell>
  );
}
