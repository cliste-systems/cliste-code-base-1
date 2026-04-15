"use client";

import { MapPin } from "lucide-react";

import { PublicBookingDialog } from "@/components/public-booking-dialog";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export type SalonStorefrontService = {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  category: string | null;
  description: string | null;
};

export type SalonStorefrontUiProps = {
  salonName: string;
  address: string | null;
  bio: string | null;
  logoUrl: string | null;
  instagramHref: string | null;
  facebookHref: string | null;
  showBookNow: boolean;
  freshaUrl: string | null;
  isNativeSalon: boolean;
  organizationId: string;
  salonSlug: string;
  services: SalonStorefrontService[];
  variant?: "public" | "preview";
  density?: "default" | "compact";
  emptyServicesHint?: string | null;
};

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function FacebookGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function formatEur(price: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price);
}

function groupServices(
  services: SalonStorefrontService[],
): [string, SalonStorefrontService[]][] {
  const order: string[] = [];
  const map = new Map<string, SalonStorefrontService[]>();

  for (const s of services) {
    const label = s.category?.trim() || "Services";
    if (!map.has(label)) {
      map.set(label, []);
      order.push(label);
    }
    map.get(label)!.push(s);
  }

  return order.map((label) => [label, map.get(label)!] as [string, SalonStorefrontService[]]);
}

function categorySectionId(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return `menu-${slug || "services"}`;
}

function scrollToCategory(id: string) {
  const el = typeof document !== "undefined" ? document.getElementById(id) : null;
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function SalonStorefrontUI({
  salonName,
  address,
  bio,
  logoUrl,
  instagramHref,
  facebookHref,
  showBookNow,
  freshaUrl,
  isNativeSalon,
  organizationId,
  salonSlug,
  services,
  variant = "public",
  density = "default",
  emptyServicesHint = null,
}: SalonStorefrontUiProps) {
  const isPreview = variant === "preview";
  const compact = density === "compact";
  const visible = services.filter((s) => s.name.trim());
  const groups = groupServices(visible);
  const showCategoryNav = groups.length > 1;

  const shell = cn(
    "relative flex w-full flex-col overflow-hidden bg-white text-stone-900",
    "dark:bg-zinc-950 dark:text-zinc-50",
    compact ? "rounded-[1.35rem]" : "rounded-none sm:rounded-2xl",
    !compact && "ring-1 ring-stone-200/90 dark:ring-zinc-800",
  );

  const headingMain = compact
    ? "text-lg font-semibold tracking-tight text-stone-900 dark:text-zinc-50"
    : "text-2xl font-semibold tracking-tight text-stone-900 sm:text-[1.75rem] dark:text-zinc-50";

  const serviceTitle = compact ? "text-[13px] font-semibold" : "text-[17px] font-semibold leading-snug";

  return (
    <div
      className={cn(
        "text-[15px] leading-normal antialiased",
        compact && "text-[13px] leading-snug",
      )}
    >
      <div className={shell}>
        {/* Hero — calm header, no decorative gradients */}
        <header
          className={cn(
            "border-b border-stone-200/90 bg-stone-50/50 px-4 pb-6 pt-7 dark:border-zinc-800 dark:bg-zinc-900/40",
            compact && "px-3 pb-4 pt-5",
          )}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className={cn(
                "mb-4 flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-stone-200/90 dark:bg-zinc-900 dark:ring-zinc-700",
                compact ? "size-14" : "size-[5.25rem]",
              )}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="" className="size-full object-cover" />
              ) : (
                <span
                  className={cn(
                    "font-semibold text-stone-400 dark:text-zinc-500",
                    compact ? "text-xs" : "text-sm",
                  )}
                >
                  {(salonName.trim() || "Salon").slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <h1 className={headingMain}>{salonName.trim() || "Salon"}</h1>
            {address?.trim() ? (
              <p
                className={cn(
                  "mt-2 flex max-w-md items-start justify-center gap-1.5 text-center text-stone-600 dark:text-zinc-400",
                  compact ? "text-[11px]" : "text-sm",
                )}
              >
                <MapPin
                  className={cn(
                    "mt-0.5 shrink-0 text-stone-400 dark:text-zinc-500",
                    compact ? "size-3" : "size-3.5",
                  )}
                  aria-hidden
                />
                {address.trim()}
              </p>
            ) : null}
          </div>
        </header>

        <div className={cn("px-4 pb-10 pt-6", compact && "space-y-6 px-3 pb-6 pt-4")}>
          {showBookNow && freshaUrl ? (
            <a
              href={freshaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ size: "lg" }),
                "flex h-12 w-full items-center justify-center rounded-lg text-base font-semibold shadow-sm",
              )}
            >
              Book now
            </a>
          ) : null}

          {/* Services first — primary scan path (inspired by marketplace venue pages) */}
          <section
            className="scroll-mt-4"
            aria-labelledby="services-heading"
            id="services"
          >
            <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <h2
                id="services-heading"
                className={cn(
                  "font-semibold text-stone-900 dark:text-zinc-50",
                  compact ? "text-base" : "text-xl",
                )}
              >
                Services
              </h2>
              {visible.length > 0 ? (
                <p className="text-sm text-stone-500 dark:text-zinc-400">
                  {visible.length}{" "}
                  {visible.length === 1 ? "treatment" : "treatments"}
                </p>
              ) : null}
            </div>

            {showCategoryNav && !compact ? (
              <div className="-mx-1 mb-6 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {groups.map(([label]) => {
                  const id = categorySectionId(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => scrollToCategory(id)}
                      className="shrink-0 rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-sm font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {visible.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-stone-200 bg-stone-50/50 px-4 py-8 text-center text-sm text-stone-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
                {emptyServicesHint?.trim() ||
                  "Check back soon for our service menu."}
              </p>
            ) : (
              <div className={cn("mt-4 space-y-10", compact && "mt-3 space-y-6")}>
                {groups.map(([categoryLabel, items]) => {
                  const sectionId = categorySectionId(categoryLabel);
                  return (
                    <div
                      key={categoryLabel}
                      id={sectionId}
                      className="scroll-mt-6"
                    >
                      {showCategoryNav || groups.length > 1 ? (
                        <h3
                          className={cn(
                            "mb-0 border-b border-stone-200 pb-2 font-medium text-stone-800 dark:border-zinc-800 dark:text-zinc-200",
                            compact ? "text-xs" : "text-sm",
                          )}
                        >
                          {categoryLabel}
                        </h3>
                      ) : null}
                      <ul
                        className={cn(
                          showCategoryNav || groups.length > 1 ? "mt-0" : "mt-0",
                          "divide-y divide-stone-100 dark:divide-zinc-800",
                        )}
                      >
                        {items.map((s) => {
                          const desc = s.description?.trim();
                          return (
                            <li key={s.id} className="flex gap-4 py-5 first:pt-2">
                              <div className="min-w-0 flex-1">
                                <h3
                                  className={cn(
                                    serviceTitle,
                                    "text-stone-900 dark:text-zinc-50",
                                  )}
                                >
                                  {s.name.trim()}
                                </h3>
                                <p className="mt-1 text-sm text-stone-500 dark:text-zinc-400">
                                  <span className="tabular-nums">
                                    {s.durationMinutes} min
                                  </span>
                                  {desc ? (
                                    <>
                                      <span className="mx-1.5 text-stone-300 dark:text-zinc-600">
                                        ·
                                      </span>
                                      <span className="text-pretty">{desc}</span>
                                    </>
                                  ) : null}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-2">
                                <span
                                  className={cn(
                                    "tabular-nums text-stone-900 dark:text-zinc-50",
                                    compact ? "text-sm font-semibold" : "text-lg font-semibold",
                                  )}
                                >
                                  {formatEur(s.price)}
                                </span>
                                {!showBookNow && isNativeSalon ? (
                                  isPreview ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled
                                      className="h-9 min-h-9 opacity-70"
                                    >
                                      Book
                                    </Button>
                                  ) : (
                                    <PublicBookingDialog
                                      organizationId={organizationId}
                                      salonSlug={salonSlug}
                                      service={{
                                        id: s.id,
                                        name: s.name.trim(),
                                        price: s.price,
                                        duration: s.durationMinutes,
                                      }}
                                    />
                                  )
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {bio?.trim() ? (
            <section
              className="mt-10 border-t border-stone-100 pt-10 dark:border-zinc-800"
              aria-labelledby="about-heading"
            >
              <h2
                id="about-heading"
                className={cn(
                  "font-semibold text-stone-900 dark:text-zinc-50",
                  compact ? "text-base" : "text-lg",
                )}
              >
                About
              </h2>
              <p
                className={cn(
                  "mt-3 max-w-prose text-pretty text-stone-600 dark:text-zinc-300",
                  compact ? "text-xs leading-relaxed" : "text-sm leading-relaxed",
                )}
              >
                {bio.trim()}
              </p>
            </section>
          ) : null}

          {(instagramHref || facebookHref) && (
            <div className="mt-10 flex justify-center gap-3 border-t border-stone-100 pt-8 dark:border-zinc-800">
              {instagramHref ? (
                <a
                  href={instagramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex size-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700 shadow-sm transition hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
                    compact && "size-9",
                  )}
                  aria-label="Instagram"
                >
                  <InstagramGlyph className="size-[1.05rem]" />
                </a>
              ) : null}
              {facebookHref ? (
                <a
                  href={facebookHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex size-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700 shadow-sm transition hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
                    compact && "size-9",
                  )}
                  aria-label="Facebook"
                >
                  <FacebookGlyph className="size-[1.05rem]" />
                </a>
              ) : null}
            </div>
          )}

          <footer className="mt-12 border-t border-stone-100 pt-8 dark:border-zinc-800">
            <p className="text-center text-[0.65rem] tracking-wide text-stone-400 dark:text-zinc-500">
              Powered by{" "}
              <span className="font-medium text-stone-500 dark:text-zinc-400">
                Cliste Systems
              </span>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
