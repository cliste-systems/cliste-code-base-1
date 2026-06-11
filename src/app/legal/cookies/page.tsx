import type { Metadata } from "next";

import { CookiesDocument } from "@/content/legal/cookies-document";

export const metadata: Metadata = {
  title: "Cookies — Cliste",
  description: "How Cliste uses cookies and similar technologies.",
};

export default function CookiesPage() {
  return <CookiesDocument />;
}
