"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Navigation,
  Scissors,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  type PublicDirectoryNicheOption,
  searchPublicSalonsDirectory,
} from "@/app/booking-directory-search";
import { getPublicBookingPageUrl } from "@/lib/booking-site-origin";
import type { OrganizationNiche } from "@/lib/organization-niche";

export type BookingNetworkLandingProps = {
  /** e.g. https://app.clistesystems.ie — for Workspace / partner CTAs */
  appOrigin: string | null;
  /** Niches that have at least one active venue (drives the Service list). */
  directoryNicheOptions: PublicDirectoryNicheOption[];
};

const hoverReveal =
  "bg-[linear-gradient(to_top,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0)_100%)]";

export function BookingNetworkLanding({
  appOrigin,
  directoryNicheOptions,
}: BookingNetworkLandingProps) {
  const findVenuesRef = useRef<HTMLDivElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [service, setService] = useState("");
  const [serviceNiche, setServiceNiche] = useState<OrganizationNiche | null>(
    null,
  );
  const [location, setLocation] = useState("");
  const [salons, setSalons] = useState<
    { slug: string; name: string; address: string | null; distanceKm: number | null }[]
  >([]);
  const [viewerGeo, setViewerGeo] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, startTransition] = useTransition();
  const year = new Date().getFullYear();

  const partnerHref = appOrigin ? `${appOrigin}/authenticate` : "/authenticate";

  /** Close menus on outside pointer-down (not document `click`, which can race the row toggle). */
  useEffect(() => {
    const closeIfOutside = (e: PointerEvent) => {
      const root = findVenuesRef.current;
      if (!root) return;
      const t = e.target;
      if (t instanceof Node && root.contains(t)) return;
      setOpenId(null);
    };
    document.addEventListener("pointerdown", closeIfOutside);
    return () => document.removeEventListener("pointerdown", closeIfOutside);
  }, []);

  /** `toggleDropdown(event, id)` from your HTML: stopPropagation + toggle this menu. */
  const toggleDropdown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  const toggleDropdownKb = useCallback((e: React.KeyboardEvent, id: string) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const t = e.target as HTMLElement;
    if (
      t !== e.currentTarget &&
      t.closest?.("input, textarea, select, button, a")
    ) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  const selectServiceOption = useCallback((opt: PublicDirectoryNicheOption) => {
    setService(opt.label);
    setServiceNiche(opt.niche);
    setOpenId(null);
  }, []);

  const clearServiceOption = useCallback(() => {
    setService("");
    setServiceNiche(null);
    setOpenId(null);
  }, []);

  const selectLocation = useCallback((value: string) => {
    setLocation(value);
    setViewerGeo(null);
    setOpenId(null);
  }, []);

  const runDirectorySearch = useCallback(() => {
    setSearchError(null);
    setHasSearched(true);
    setSalons([]);
    startTransition(async () => {
      const res = await searchPublicSalonsDirectory({
        service,
        serviceNiche,
        location,
        viewerLat: viewerGeo?.lat ?? null,
        viewerLng: viewerGeo?.lng ?? null,
      });
      if (!res.ok) {
        setSalons([]);
        setSearchError(res.message);
        return;
      }
      setSalons(res.salons);
    });
  }, [service, serviceNiche, location, viewerGeo]);

  return (
    <div className="selection:bg-emerald-400 selection:text-black flex min-h-screen flex-col bg-white text-black antialiased [background-image:radial-gradient(#e4e4e7_1px,transparent_1px)] [background-size:32px_32px]">
      <nav className="relative z-[70] w-full border-b border-zinc-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1400px] items-center justify-between px-6">
          <Link href="/" className="group flex cursor-pointer items-center">
            <Image
              src="/cliste-logo.png"
              alt="Cliste"
              width={40}
              height={40}
              priority
              className="h-9 w-9 shrink-0 object-contain"
            />
          </Link>

          <div className="flex items-center gap-6">
            <Link
              href="/authenticate"
              className="hidden text-base font-normal tracking-wide text-black uppercase transition-colors hover:text-emerald-500 md:block"
            >
              Login
            </Link>
            <Link
              href={partnerHref}
              className="flex items-center gap-2 bg-emerald-400 px-6 py-3 text-base font-normal tracking-wide text-black uppercase transition-colors hover:bg-emerald-300"
            >
              For businesses
              <ArrowUpRight strokeWidth={1.5} className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-50 pt-16 pb-12 md:pt-24">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="mb-16">
            <p className="mb-8 flex items-center gap-4 text-sm font-normal tracking-widest text-zinc-400 uppercase">
              <span className="h-px w-12 bg-zinc-300" />
              Irish AI voice & online booking
            </p>
            <h1 className="text-6xl leading-[0.85] font-normal tracking-tighter text-black uppercase md:text-8xl lg:text-9xl">
              BOOK <br className="hidden md:block" />
              <span className="mt-2 flex items-center gap-4 md:mt-4 md:ml-[15%] md:gap-8">
                <span className="hidden h-[1px] w-24 bg-black md:block lg:w-48" />
                <span className="bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text font-thin text-transparent lowercase italic">
                  with Cliste.
                </span>
              </span>
            </h1>
          </div>

          <div
            ref={findVenuesRef}
            id="find-venues"
            className="relative z-[60] isolate flex flex-col border border-zinc-200 bg-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.03)] md:flex-row"
          >
            {/* Service — `dropdown-container` + onclick toggleDropdown (no pointer-events-none on whole cell: it ate clicks). */}
            <div
              className="dropdown-container group relative flex-1 cursor-pointer border-b border-zinc-200 transition-colors hover:bg-zinc-50 md:border-b-0 md:border-r"
              onClick={(e) => toggleDropdown(e, "service")}
              onKeyDown={(e) => toggleDropdownKb(e, "service")}
              tabIndex={0}
            >
              <div className="h-full w-full p-6 lg:p-8">
                <label className="mb-3 block text-xs font-normal tracking-widest text-zinc-400 uppercase transition-colors group-hover:text-emerald-500">
                  01 / Service
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    id="input-service"
                    readOnly
                    tabIndex={-1}
                    value={service}
                    placeholder="Service type"
                    className="pointer-events-none w-full cursor-pointer truncate bg-transparent text-2xl font-thin tracking-tight text-black outline-none placeholder:text-zinc-300 md:text-3xl"
                  />
                </div>
              </div>
              {openId === "service" ? (
                <div
                  id="dropdown-service"
                  className="dropdown-menu absolute top-[calc(100%+1px)] left-0 z-[100] min-w-[280px] w-full border border-zinc-200 bg-white py-2 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="group/item flex w-full cursor-pointer items-center justify-between px-6 py-4 text-left text-base font-normal text-zinc-600 transition-colors hover:bg-zinc-100"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      clearServiceOption();
                    }}
                  >
                    All types
                    <ArrowRight
                      strokeWidth={1.5}
                      className="h-4 w-4 -translate-x-2 text-zinc-300 opacity-0 transition-all group-hover/item:translate-x-0 group-hover/item:text-emerald-500 group-hover/item:opacity-100"
                    />
                  </button>
                  {directoryNicheOptions.length === 0 ? (
                    <p className="px-6 py-4 text-sm text-zinc-500">
                      No published venues yet.
                    </p>
                  ) : (
                    directoryNicheOptions.map((opt) => (
                      <button
                        key={opt.niche}
                        type="button"
                        className="group/item flex w-full cursor-pointer items-center justify-between px-6 py-4 text-left text-base font-normal text-black transition-colors hover:bg-zinc-100"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          selectServiceOption(opt);
                        }}
                      >
                        {opt.label}
                        <ArrowRight
                          strokeWidth={1.5}
                          className="h-4 w-4 -translate-x-2 text-zinc-300 opacity-0 transition-all group-hover/item:translate-x-0 group-hover/item:text-emerald-500 group-hover/item:opacity-100"
                        />
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            {/* Location */}
            <div
              className="dropdown-container group relative flex-1 cursor-pointer border-b border-zinc-200 transition-colors hover:bg-zinc-50 md:border-b-0 md:border-r"
              onClick={(e) => toggleDropdown(e, "location")}
              onKeyDown={(e) => toggleDropdownKb(e, "location")}
              tabIndex={0}
            >
              <div className="flex h-full w-full items-center justify-between p-6 lg:p-8">
                <div className="w-full">
                  <label className="mb-3 block text-xs font-normal tracking-widest text-zinc-400 uppercase transition-colors group-hover:text-emerald-500">
                    02 / Where
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      id="input-location"
                      readOnly
                      tabIndex={-1}
                      value={location}
                      placeholder="Town or Eircode"
                      className="pointer-events-none w-full cursor-pointer truncate bg-transparent text-2xl font-thin tracking-tight text-black outline-none placeholder:text-zinc-300 md:text-3xl"
                    />
                  </div>
                </div>
                <MapPin
                  strokeWidth={1.5}
                  className="pointer-events-none h-7 w-7 shrink-0 text-zinc-300 transition-colors group-hover:text-emerald-500"
                />
              </div>
              {openId === "location" ? (
                <div
                  id="dropdown-location"
                  className="dropdown-menu absolute top-[calc(100%+1px)] left-0 z-[100] min-w-[280px] w-full border border-zinc-200 bg-white py-2 shadow-2xl md:-left-px"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-3 px-6 py-4 text-left text-base font-normal text-emerald-600 transition-colors hover:bg-zinc-100"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setOpenId(null);
                      if (!navigator.geolocation) {
                        setLocation("Current Location");
                        setViewerGeo(null);
                        return;
                      }
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setLocation("Near you");
                          setViewerGeo({
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                          });
                        },
                        () => {
                          setLocation("Current Location");
                          setViewerGeo(null);
                        },
                        {
                          enableHighAccuracy: false,
                          maximumAge: 60_000,
                          timeout: 12_000,
                        },
                      );
                    }}
                  >
                    <Navigation strokeWidth={1.5} className="h-4 w-4" />
                    Use current location
                  </button>
                  <div
                    className="border-t border-zinc-100 px-6 py-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="mb-2 text-xs font-normal tracking-widest text-zinc-400 uppercase">
                      Town or Eircode
                    </p>
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        const v = String(fd.get("customLoc") ?? "").trim();
                        if (v) selectLocation(v);
                      }}
                    >
                      <input
                        name="customLoc"
                        placeholder="Eircode"
                        autoComplete="postal-code"
                        className="min-w-0 flex-1 border border-zinc-200 px-3 py-2 text-sm text-black outline-none placeholder:text-zinc-400 focus:border-emerald-500"
                      />
                      <button
                        type="submit"
                        className="shrink-0 bg-zinc-900 px-3 py-2 text-xs font-normal tracking-wide text-white uppercase transition-colors hover:bg-emerald-600"
                      >
                        Apply
                      </button>
                    </form>
                  </div>
                  <div className="mt-2 px-6 py-2 text-xs font-normal tracking-widest text-zinc-400 uppercase">
                    Ireland
                  </div>
                  {["Dublin", "Cork", "Galway"].map((city) => (
                    <button
                      key={city}
                      type="button"
                      className="w-full cursor-pointer px-6 py-3 text-left text-base font-normal text-black transition-colors hover:bg-zinc-100"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        selectLocation(city);
                      }}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="group flex flex-col items-start justify-between bg-black p-6 text-white transition-colors duration-300 hover:bg-emerald-400 hover:text-black disabled:opacity-60 md:w-48 lg:w-64 lg:p-8"
              disabled={isSearching}
              onClick={(e) => {
                e.stopPropagation();
                runDirectorySearch();
              }}
            >
              <span className="text-xs font-normal tracking-widest text-zinc-400 uppercase transition-colors group-hover:text-black/60">
                {isSearching ? "Searching…" : "Search"}
              </span>
              <div className="flex w-full justify-end transition-transform group-hover:translate-x-2">
                <ArrowRight strokeWidth={1.5} className="h-12 w-12 lg:h-14 lg:w-14" />
              </div>
            </button>
          </div>

          {hasSearched ? (
            <div
              className="mt-12 border border-zinc-200 bg-white p-6 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.03)] md:p-10"
              role="region"
              aria-label="Search results"
            >
              <h2 className="mb-6 text-xl font-normal tracking-tight text-black md:text-2xl">
                Venues
              </h2>
              {searchError ? (
                <p className="text-sm text-red-600">{searchError}</p>
              ) : isSearching ? (
                <p className="text-sm text-zinc-500">Loading venues…</p>
              ) : salons.length === 0 ? (
                <p className="text-sm text-zinc-600">
                  No venues match this search (service, area, and distance). Try
                  a different area or service, or use a booking link the business
                  sent you.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {salons.map((s) => (
                    <li key={s.slug}>
                      <Link
                        href={getPublicBookingPageUrl(`/${s.slug}`)}
                        className="flex flex-col gap-1 py-5 transition-colors hover:bg-zinc-50 md:flex-row md:items-center md:justify-between md:px-4"
                      >
                        <div>
                          <p className="text-lg font-medium text-black">
                            {s.name}
                          </p>
                          {s.address ? (
                            <p className="text-sm text-zinc-500">{s.address}</p>
                          ) : null}
                          {s.distanceKm !== null ? (
                            <p className="text-sm font-normal text-emerald-700">
                              {s.distanceKm === 0
                                ? "Same Eircode as your search"
                                : `About ${Math.round(s.distanceKm * 10) / 10} km away`}
                            </p>
                          ) : null}
                          <p className="mt-1 font-mono text-xs text-zinc-400">
                            {getPublicBookingPageUrl(`/${s.slug}`)}
                          </p>
                        </div>
                        <span className="mt-2 inline-flex shrink-0 items-center gap-2 text-sm font-normal tracking-wide text-emerald-700 uppercase md:mt-0">
                          Book
                          <ArrowUpRight strokeWidth={1.5} className="h-4 w-4" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </main>

      <section className="relative z-10 bg-white py-20 md:py-32">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="mb-12 flex flex-col items-start justify-between gap-6 border-b border-zinc-200 pb-8 md:flex-row md:items-end">
            <h2 className="text-4xl font-normal tracking-tighter text-black md:text-5xl lg:text-6xl">
              What <br className="hidden md:block" />
              <span className="font-thin text-zinc-400 italic">Cliste offers.</span>
            </h2>
            <a
              href="#find-venues"
              className="inline-flex items-center gap-2 border-b border-black pb-1 text-base font-normal tracking-widest text-black uppercase transition-colors hover:text-emerald-600"
            >
              Find a venue
              <ArrowUpRight strokeWidth={1.5} className="h-5 w-5" />
            </a>
          </div>

          <div className="grid auto-rows-[300px] grid-cols-1 gap-4 md:grid-cols-12 lg:auto-rows-[400px]">
            <div className="group relative min-h-[320px] cursor-pointer overflow-hidden bg-zinc-100 md:col-span-8 md:row-span-2 md:min-h-[520px] lg:min-h-[640px]">
              <img
                src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1600&q=80"
                alt=""
                className="absolute inset-0 h-full w-full object-cover grayscale opacity-90 transition-all duration-700 ease-in-out group-hover:scale-105 group-hover:grayscale-0"
              />
              <div
                className={`pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-500 group-hover:opacity-90 ${hoverReveal}`}
              />
              <div className="absolute top-6 right-6 bg-white px-4 py-2 text-xs font-normal tracking-widest text-zinc-700 uppercase">
                Native booking
              </div>
              <div className="absolute bottom-0 left-0 flex w-full translate-y-4 transform items-end justify-between p-8 transition-transform duration-500 group-hover:translate-y-0">
                <div>
                  <p className="mb-3 text-sm font-normal tracking-widest text-white/70 uppercase">
                    Your storefront
                  </p>
                  <h3 className="max-w-[20ch] text-3xl font-normal tracking-tighter text-white md:text-4xl lg:text-5xl">
                    Clients pick staff, services & times on your own link.
                  </h3>
                </div>
                <div className="flex h-16 w-16 items-center justify-center bg-emerald-400 text-black opacity-0 transition-opacity delay-100 duration-500 group-hover:opacity-100">
                  <ArrowUpRight strokeWidth={1.5} className="h-8 w-8" />
                </div>
              </div>
            </div>

            <div className="group relative min-h-[280px] cursor-pointer overflow-hidden bg-zinc-100 md:col-span-4 md:row-span-1 md:min-h-0">
              <img
                src="https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=800&q=80"
                alt=""
                className="absolute inset-0 h-full w-full object-cover grayscale opacity-90 transition-all duration-700 ease-in-out group-hover:scale-105 group-hover:grayscale-0"
              />
              <div
                className={`pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-500 group-hover:opacity-90 ${hoverReveal}`}
              />
              <div className="absolute bottom-0 left-0 flex w-full items-end justify-between p-6">
                <div>
                  <p className="mb-2 text-xs font-normal tracking-widest text-white/70 uppercase">
                    Irish AI voice
                  </p>
                  <h3 className="max-w-[14ch] text-2xl font-normal tracking-tight text-white md:text-3xl">
                    Natural agents for the ringing phone — so you stay with the
                    client in the chair.
                  </h3>
                </div>
                <ArrowUpRight
                  strokeWidth={1.5}
                  className="h-6 w-6 text-emerald-400 opacity-0 transition-opacity group-hover:opacity-100"
                />
              </div>
            </div>

            <div className="group relative flex cursor-pointer flex-col justify-between overflow-hidden bg-black p-8 md:col-span-4 md:row-span-1">
              <div>
                <div className="mb-6 flex h-14 w-14 items-center justify-center bg-white/10 transition-colors duration-500 group-hover:bg-emerald-500">
                  <Scissors
                    strokeWidth={1.5}
                    className="h-7 w-7 text-white transition-colors duration-500 group-hover:text-black"
                  />
                </div>
                <h3 className="mb-3 text-3xl font-normal tracking-tight text-white">
                  Team dashboard
                </h3>
                <p className="text-base font-thin leading-relaxed text-zinc-400">
                  One place for services, opening hours, staff, and appointments
                  — built for salons, barbershops, and trades that run on trust.
                </p>
              </div>
              <Link
                href={partnerHref}
                className="mt-8 flex items-center gap-3 text-sm font-normal tracking-wide text-white uppercase transition-all group-hover:gap-5 group-hover:text-emerald-400"
              >
                Business sign-in
                <ArrowRight strokeWidth={1.5} className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-col divide-y divide-zinc-200 md:flex-row md:divide-x md:divide-y-0">
          <div className="flex flex-1 flex-col justify-center p-10 transition-colors hover:bg-zinc-50 lg:p-16">
            <p className="mb-4 text-xs font-normal tracking-widest text-zinc-400 uppercase">
              Voice
            </p>
            <p className="text-5xl font-normal tracking-tighter text-black lg:text-7xl">
              Irish
            </p>
            <p className="mt-3 text-base font-thin text-zinc-500">
              Hyper-realistic Irish voice agents for the front desk phone — not a
              generic offshore robot.
            </p>
          </div>
          <div className="flex flex-1 flex-col justify-center p-10 transition-colors hover:bg-zinc-50 lg:p-16">
            <p className="mb-4 text-xs font-normal tracking-widest text-zinc-400 uppercase">
              Booking
            </p>
            <p className="text-5xl font-normal tracking-tighter text-black lg:text-7xl">
              Native
            </p>
            <p className="mt-3 text-base font-thin text-zinc-500">
              Public pages on your own link: services, staff, and live
              availability — Connect tier can still hand off to Fresha when you
              need it.
            </p>
          </div>
          <div className="flex flex-1 flex-col justify-center bg-zinc-50 p-10 lg:p-16">
            <p className="mb-4 text-xs font-normal tracking-widest text-zinc-400 uppercase">
              Control
            </p>
            <div className="flex flex-col gap-1.5">
              <p className="text-5xl font-normal tracking-tighter text-black lg:text-7xl">
                Yours
              </p>
              <p className="text-sm font-thin tracking-wide text-zinc-500">
                Dashboard for calendars, bookings, clients, and storefront — one
                Cliste account for the team.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 overflow-hidden bg-black pt-32 pb-16 text-white">
        <div className="relative z-20 mx-auto max-w-[1400px] px-6">
          <h2 className="mb-16 max-w-5xl text-5xl leading-[0.85] font-normal tracking-tighter uppercase md:text-7xl lg:text-9xl">
            Answer <br />
            <span className="font-thin text-zinc-500 lowercase italic">
              the phone. Book online.
            </span>
          </h2>

          <div className="flex flex-col items-start gap-6 border-b border-white/10 pb-24 sm:flex-row sm:items-center">
            <Link
              href={partnerHref}
              className="flex items-center gap-3 bg-emerald-400 px-8 py-5 text-base font-normal tracking-widest text-black uppercase transition-colors hover:bg-emerald-300"
            >
              Business sign-in
              <ArrowRight strokeWidth={1.5} className="h-6 w-6" />
            </Link>
            <a
              href="#find-venues"
              className="border border-white/20 px-8 py-5 text-base font-normal tracking-widest text-white uppercase transition-colors hover:border-emerald-500 hover:bg-white/5"
            >
              Find a venue
            </a>
          </div>

          <div className="flex flex-col items-start justify-between gap-6 pt-8 text-sm font-thin tracking-widest text-zinc-400 uppercase md:flex-row md:items-center">
            <p>© {year} Cliste Systems. All rights reserved.</p>
            <div className="flex gap-8">
              <span className="transition-colors hover:text-emerald-400">Privacy</span>
              <span className="transition-colors hover:text-emerald-400">Terms</span>
              <span className="transition-colors hover:text-emerald-400">System Status</span>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-[20%] -bottom-[50%] z-0 h-[800px] w-[800px] rounded-full border border-emerald-500/20" />
      </footer>
    </div>
  );
}
