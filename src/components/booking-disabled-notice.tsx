/**
 * v1: Cliste no longer hosts a public storefront or native online booking.
 * Public booking/storefront routes render this neutral, non-booking surface so
 * old links resolve safely instead of 404-ing or implying booking still works.
 * The underlying storefront/booking code and DB tables are kept intact.
 */
export function BookingDisabledNotice() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-gray-50 px-6 text-center text-gray-900">
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Online booking isn&apos;t available here
        </h1>
        <p className="text-sm leading-relaxed text-gray-600">
          This page is no longer in service. If you&apos;re trying to reach the
          business, please call them directly.
        </p>
      </div>
    </main>
  );
}
