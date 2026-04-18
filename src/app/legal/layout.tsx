import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Legal — Cliste",
  description:
    "Privacy, terms, sub-processors and cookie information for the Cliste platform.",
};

const LINKS = [
  { href: "/legal/privacy", label: "Privacy notice" },
  { href: "/legal/terms", label: "Terms of service" },
  { href: "/legal/sub-processors", label: "Sub-processors" },
  { href: "/legal/cookies", label: "Cookies" },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-gray-500">Cliste</p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="underline-offset-2 hover:underline"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <article className="prose prose-gray max-w-none text-[0.95rem] leading-7">
        {children}
      </article>
      <footer className="border-t pt-6 text-xs text-gray-500">
        Cliste Systems, Dublin, Ireland · contact:{" "}
        <a href="mailto:hello@clistesystems.ie" className="underline">
          hello@clistesystems.ie
        </a>{" "}
        · privacy:{" "}
        <a href="mailto:privacy@clistesystems.ie" className="underline">
          privacy@clistesystems.ie
        </a>
      </footer>
    </main>
  );
}
