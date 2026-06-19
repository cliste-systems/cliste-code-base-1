import Link from "next/link";

/**
 * Retired public salon links (legacy `/[salonSlug]` storefront URLs) resolve here
 * instead of 404-ing. Cliste does not host public booking pages in v1.
 */
export function BookingDisabledNotice() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-gray-50 px-6 text-center text-gray-900">
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          This page isn&apos;t available
        </h1>
        <p className="text-sm leading-relaxed text-gray-600">
          This link is no longer active. If you&apos;re trying to reach a
          business, please call them directly.
        </p>
        <p className="text-sm leading-relaxed text-gray-600">
          Looking for Cliste?{" "}
          <Link
            href="/authenticate"
            className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
          >
            Sign in here
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
