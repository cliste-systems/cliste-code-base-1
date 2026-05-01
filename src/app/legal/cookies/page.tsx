import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookies — Cliste",
  description:
    "Cookies and similar technologies used by the Cliste platform under the Irish ePrivacy Regulations.",
};

const LAST_UPDATED = "18 April 2026";

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
    purpose: "Authenticated session for the dashboard / admin console.",
    category: "strictly-necessary",
    duration: "Session + ~1 hour refresh window",
    party: "first",
  },
  {
    name: "cliste_dashboard_gate",
    purpose:
      "Confirms the dashboard’s extra unlock gate — prevents anyone with just a session cookie from opening dashboards on a shared device.",
    category: "security",
    duration: "Up to 12 hours",
    party: "first",
  },
  {
    name: "cliste_admin_gate",
    purpose:
      "Same as above but for the agency admin console (Cliste staff only).",
    category: "security",
    duration: "Up to 12 hours",
    party: "first",
  },
  {
    name: "cliste_support_dashboard",
    purpose:
      "When a Cliste support engineer is acting on behalf of a salon, marks the session as “support” so the dashboard shows a banner.",
    category: "security",
    duration: "Session",
    party: "first",
  },
  {
    name: "dashboard-nav-seen-*",
    purpose:
      "Remembers which sidebar items the operator has already viewed, so badge counters only highlight new items.",
    category: "functional",
    duration: "30 days",
    party: "first",
  },
  {
    name: "cliste_dev_tier (development only)",
    purpose:
      "Lets the engineering team toggle plan-tier UI in development. Never set in production.",
    category: "functional",
    duration: "Session",
    party: "first",
  },
  {
    name: "cf_chl_* / __cf_bm (Cloudflare)",
    purpose:
      "Cloudflare Turnstile bot challenge on the public booking form, plus Cloudflare bot management.",
    category: "security",
    duration: "Up to 30 minutes",
    party: "third",
  },
  {
    name: "Google Maps cookies",
    purpose:
      "Set by the embedded Google Maps storefront map. We do not control these directly; see Google’s policy.",
    category: "functional",
    duration: "Varies",
    party: "third",
  },
];

const CATEGORY_DESCRIPTION: Record<Cookie["category"], string> = {
  "strictly-necessary":
    "Required for the site to work. These cannot be turned off. They do not store personal information beyond the technical minimum.",
  security:
    "Used to keep the platform safe — e.g. detect bot traffic, protect dashboards from unauthorised access. Treated as strictly necessary under PECR Reg 5(5) exemption for security.",
  functional:
    "Remember your preferences and small UI state across visits. We’ll ask before using these where required.",
};

export default function CookiesPage() {
  return (
    <>
      <h1>Cookies</h1>
      <p className="text-sm text-gray-500">
        Last updated: <strong>{LAST_UPDATED}</strong>
      </p>

      <p>
        Under the Irish ePrivacy Regulations (S.I. 336/2011), we explain what
        cookies and similar technologies the Cliste platform uses, why, and how to
        manage them. We do not run ad-tech cookies or third-party analytics that
        track you across other sites.
      </p>

      <h2>Categories</h2>
      <ul>
        <li>
          <strong>Strictly necessary</strong> — {CATEGORY_DESCRIPTION["strictly-necessary"]}
        </li>
        <li>
          <strong>Security</strong> — {CATEGORY_DESCRIPTION.security}
        </li>
        <li>
          <strong>Functional</strong> — {CATEGORY_DESCRIPTION.functional}
        </li>
      </ul>

      <h2>Cookies we set</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Purpose</th>
            <th>Category</th>
            <th>Duration</th>
            <th>Party</th>
          </tr>
        </thead>
        <tbody>
          {COOKIES.map((c) => (
            <tr key={c.name}>
              <td>
                <code>{c.name}</code>
              </td>
              <td>{c.purpose}</td>
              <td>{c.category}</td>
              <td>{c.duration}</td>
              <td>{c.party === "first" ? "First-party" : "Third-party"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Managing cookies</h2>
      <p>
        You can clear cookies in your browser at any time. Doing so will sign you
        out of the dashboard. Disabling cookies entirely will prevent the dashboard
        from working but will not affect public booking pages.
      </p>

      <h2>Contact</h2>
      <p>
        Cookie questions: <strong>privacy@clistesystems.ie</strong>.
      </p>
    </>
  );
}
