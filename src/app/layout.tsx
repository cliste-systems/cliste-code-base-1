import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PRODUCT_NAME } from "@/lib/company-details";
import { AuthHashGuard } from "@/components/auth-hash-guard";
import { CookieNoticeBanner } from "@/components/cookie-notice-banner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "AI voice receptionist control plane for Irish salons",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    title: PRODUCT_NAME,
    description: "AI phone agent for Irish businesses",
    siteName: PRODUCT_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: PRODUCT_NAME,
    description: "AI phone agent for Irish businesses",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthHashGuard />
        {children}
        <CookieNoticeBanner />
      </body>
    </html>
  );
}
