
import {
  LegalPageHeader,
  LegalSection,
  LegalTable,
} from "@/components/legal/legal-document";


type Cookie = {
  name: string;
  purpose: string;
  category: "strictly-necessary" | "functional" | "security";
  duration: string;
  party: "first" | "third";
};

const COOKIES: Cookie[] = [
  {
    name: "sb-* (Supabase auth)",
    purpose: "Authenticated session for the dashboard and admin console.",
    category: "strictly-necessary",
    duration: "Session + refresh window",
    party: "first",
  },
  {
    name: "cliste_admin_gate",
    purpose: "Extra gate for the agency admin console (Cliste staff only).",
    category: "security",
    duration: "Up to 12 hours",
    party: "first",
  },
  {
    name: "cliste_support_dashboard",
    purpose:
      "Marks a support session when Cliste staff act on behalf of a customer (banner shown in dashboard).",
    category: "security",
    duration: "Session",
    party: "first",
  },
  {
    name: "dashboard_*_seen_at",
    purpose:
      "Remembers when you last opened Calls or Action Inbox so badge counts highlight new activity only.",
    category: "functional",
    duration: "Up to ~400 days",
    party: "first",
  },
  {
    name: "cf_chl_* / __cf_bm (Cloudflare)",
    purpose:
      "Cloudflare Turnstile on login (and similar forms) plus bot management at the edge.",
    category: "security",
    duration: "Up to 30 minutes",
    party: "third",
  },
];

const CATEGORY_DESCRIPTION: Record<Cookie["category"], string> = {
  "strictly-necessary":
    "Required for the site to work. They cannot be turned off in the dashboard.",
  security:
    "Keep the platform safe (bot challenge, admin gates). Treated as strictly necessary under PECR where applicable.",
  functional:
    "Remember small UI state such as nav badges. No cross-site advertising.",
};

export function CookiesDocument() {
  return (
    <>
      <LegalPageHeader
        title="Cookies"
        description="What cookies and similar technologies we use on the Cliste dashboard, login, and marketing site — and how to manage them."
      />

      <p className="text-[15px] leading-relaxed text-slate-700">
        Under the Irish ePrivacy Regulations (S.I. 336/2011), we explain what we
        use and why. We do not run ad-tech or third-party analytics that track
        you across other websites.
      </p>

      <LegalSection title="Categories">
        <ul className="space-y-2 text-[15px] leading-relaxed text-slate-700">
          <li>
            <strong className="text-slate-900">Strictly necessary</strong> —{" "}
            {CATEGORY_DESCRIPTION["strictly-necessary"]}
          </li>
          <li>
            <strong className="text-slate-900">Security</strong> —{" "}
            {CATEGORY_DESCRIPTION.security}
          </li>
          <li>
            <strong className="text-slate-900">Functional</strong> —{" "}
            {CATEGORY_DESCRIPTION.functional}
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookies we set">
        <LegalTable
          headers={["Name", "Purpose", "Category", "Duration", "Party"]}
          rows={COOKIES.map((c) => [
            <code key={c.name}>{c.name}</code>,
            c.purpose,
            c.category,
            c.duration,
            c.party === "first" ? "First-party" : "Third-party",
          ])}
        />
      </LegalSection>

      <LegalSection title="Managing cookies">
        <p>
          You can clear cookies in your browser at any time; doing so signs you
          out of the dashboard. Disabling all cookies prevents the dashboard from
          working. The public marketing home page does not require cookies beyond
          what your browser stores by default.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          <strong>privacy@clistesystems.ie</strong>
        </p>
      </LegalSection>
    </>
  );
}
