/** Embedded Checkout is taller than the Usage viewport — allow scroll here. */
export default function UsageCheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white">
      {children}
    </div>
  );
}
