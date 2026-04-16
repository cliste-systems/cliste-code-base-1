"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Car,
  MapPin,
  Navigation,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type BookingNetworkLandingProps = {
  /** e.g. https://app.clistesystems.ie — for Workspace / partner CTAs */
  appOrigin: string | null;
};

const hoverReveal =
  "bg-[linear-gradient(to_top,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0)_100%)]";

export function BookingNetworkLanding({ appOrigin }: BookingNetworkLandingProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [service, setService] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const year = new Date().getFullYear();

  const partnerHref = appOrigin ? `${appOrigin}/authenticate` : "/authenticate";

  /** Close all dropdowns when clicking outside (matches `document.addEventListener('click', …)` in your snippet). */
  useEffect(() => {
    const close = () => setOpenId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  /** `toggleDropdown(event, id)` from your HTML: stopPropagation + toggle this menu. */
  const toggleDropdown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  const toggleDropdownKb = useCallback((e: React.KeyboardEvent, id: string) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    setOpenId((prev) => (prev === id ? null : id));
  }, []);

  /** `selectOption(inputId, value, dropdownId)` — set field value and hide menu. */
  const selectOption = useCallback(
    (input: "service" | "location" | "date", value: string) => {
      if (input === "service") setService(value);
      if (input === "location") setLocation(value);
      if (input === "date") setDate(value);
      setOpenId(null);
    },
    [],
  );

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
          <div className="mb-16 max-w-4xl">
            <p className="mb-6 flex items-center gap-4 text-sm font-normal tracking-widest text-zinc-500 uppercase">
              <span className="h-px w-12 bg-zinc-300" />
              Online booking
            </p>
            <h1 className="text-4xl leading-[1.05] font-normal tracking-tight text-zinc-900 md:text-5xl lg:text-6xl">
              Calm scheduling for{" "}
              <span className="text-black">salons, barbershops</span>, and other
              local businesses clients rely on every day.
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-light leading-relaxed text-zinc-600 md:text-xl">
              If you already have a booking link from a business, open it to
              choose a time. This page is only a short introduction to Cliste —
              not a public directory of every venue.
            </p>
          </div>

          <div className="relative flex flex-col border border-zinc-200 bg-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.03)] md:flex-row">
            {/* Service — `dropdown-container` + onclick toggleDropdown (no pointer-events-none on whole cell: it ate clicks). */}
            <div
              className="dropdown-container group relative flex-1 cursor-pointer border-b border-zinc-200 transition-colors hover:bg-zinc-50 md:border-b-0 md:border-r"
              onClick={(e) => toggleDropdown(e, "service")}
              onKeyDown={(e) => toggleDropdownKb(e, "service")}
              tabIndex={0}
            >
              <div className="h-full w-full p-6 lg:p-8">
                <label className="mb-3 block text-xs font-normal tracking-widest text-zinc-400 uppercase transition-colors group-hover:text-emerald-500">
                  01 / Type of business
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    id="input-service"
                    readOnly
                    tabIndex={-1}
                    value={service}
                    placeholder="Examples below"
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
                  {[
                    "Hair salon & colour",
                    "Barbershop",
                    "Garage or dealership",
                  ].map((label) => (
                    <button
                      key={label}
                      type="button"
                      className="group/item flex w-full cursor-pointer items-center justify-between px-6 py-4 text-left text-base font-normal text-black transition-colors hover:bg-zinc-100"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        selectOption("service", label);
                      }}
                    >
                      {label}
                      <ArrowRight
                        strokeWidth={1.5}
                        className="h-4 w-4 -translate-x-2 text-zinc-300 opacity-0 transition-all group-hover/item:translate-x-0 group-hover/item:text-emerald-500 group-hover/item:opacity-100"
                      />
                    </button>
                  ))}
                  <div className="mt-2 border-t border-zinc-100 pt-4 text-base font-normal text-emerald-700">
                    <span className="block px-6 py-4">
                      Illustrative only — real menus live on each business&apos;s
                      page.
                    </span>
                  </div>
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
                    02 / Area (example)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      id="input-location"
                      readOnly
                      tabIndex={-1}
                      value={location}
                      placeholder="Near you"
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
                      selectOption("location", "Current Location");
                    }}
                  >
                    <Navigation strokeWidth={1.5} className="h-4 w-4" />
                    Use Current Location
                  </button>
                  <div className="mt-2 px-6 py-2 text-xs font-normal tracking-widest text-zinc-400 uppercase">
                    Examples
                  </div>
                  {["Dublin", "Cork", "Galway"].map((city) => (
                    <button
                      key={city}
                      type="button"
                      className="w-full cursor-pointer px-6 py-3 text-left text-base font-normal text-black transition-colors hover:bg-zinc-100"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        selectOption("location", city);
                      }}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Date */}
            <div
              className="dropdown-container group relative flex-1 cursor-pointer border-b border-zinc-200 transition-colors hover:bg-zinc-50 md:border-b-0 md:border-r"
              onClick={(e) => toggleDropdown(e, "date")}
              onKeyDown={(e) => toggleDropdownKb(e, "date")}
              tabIndex={0}
            >
              <div className="flex h-full w-full items-center justify-between p-6 lg:p-8">
                <div className="w-full">
                  <label className="mb-3 block text-xs font-normal tracking-widest text-zinc-400 uppercase transition-colors group-hover:text-emerald-500">
                    03 / Date
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      id="input-date"
                      readOnly
                      tabIndex={-1}
                      value={date}
                      placeholder="Anytime"
                      className="pointer-events-none w-full cursor-pointer truncate bg-transparent text-2xl font-thin tracking-tight text-black outline-none placeholder:text-zinc-300 md:text-3xl"
                    />
                  </div>
                </div>
                <Calendar
                  strokeWidth={1.5}
                  className="pointer-events-none h-7 w-7 shrink-0 text-zinc-300 transition-colors group-hover:text-emerald-500"
                />
              </div>
              {openId === "date" ? (
                <div
                  id="dropdown-date"
                  className="dropdown-menu absolute top-[calc(100%+1px)] left-0 z-[100] min-w-[280px] w-full border border-zinc-200 bg-white py-2 shadow-2xl md:-left-px"
                  onClick={(e) => e.stopPropagation()}
                >
                  {["Anytime", "Today", "Tomorrow", "This Weekend"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className="w-full cursor-pointer px-6 py-3 text-left text-base font-normal text-black transition-colors hover:bg-zinc-100"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        selectOption("date", d);
                      }}
                    >
                      {d}
                    </button>
                  ))}
                  <div className="mt-2 border-t border-zinc-100 p-4">
                    <div className="w-full cursor-not-allowed bg-zinc-100 py-2 text-center text-sm font-normal text-zinc-500">
                      Custom calendar picker…
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="group flex flex-col items-start justify-between bg-black p-6 text-white transition-colors duration-300 hover:bg-emerald-400 hover:text-black md:w-48 lg:w-64 lg:p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-xs font-normal tracking-widest text-zinc-400 uppercase transition-colors group-hover:text-black/60">
                Search
              </span>
              <div className="flex w-full justify-end transition-transform group-hover:translate-x-2">
                <ArrowRight strokeWidth={1.5} className="h-12 w-12 lg:h-14 lg:w-14" />
              </div>
            </button>
          </div>
        </div>
      </main>

      <section className="relative z-10 bg-white py-20 md:py-32">
        <div className="mx-auto max-w-[1400px] px-6">
          <div className="mb-12 flex flex-col items-start justify-between gap-6 border-b border-zinc-200 pb-8 md:flex-row md:items-end">
            <h2 className="text-4xl font-normal tracking-tighter text-black md:text-5xl lg:text-6xl">
              Who it&apos;s <br className="hidden md:block" />
              <span className="font-thin text-zinc-500">for.</span>
            </h2>
            <Link
              href={partnerHref}
              className="inline-flex items-center gap-2 border-b border-black pb-1 text-base font-normal tracking-widest text-black uppercase transition-colors hover:border-emerald-600 hover:text-emerald-700"
            >
              Business sign-in
              <ArrowUpRight strokeWidth={1.5} className="h-5 w-5" />
            </Link>
          </div>

          <div className="grid auto-rows-[300px] grid-cols-1 gap-4 md:grid-cols-12 lg:auto-rows-[400px]">
            <div className="group relative min-h-[320px] cursor-default overflow-hidden bg-zinc-100 md:col-span-8 md:row-span-2 md:min-h-[520px] lg:min-h-[640px]">
              <img
                src="https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1600&q=80"
                alt="Hair salon interior"
                className="absolute inset-0 h-full w-full object-cover grayscale opacity-90 transition-all duration-700 ease-in-out group-hover:scale-105 group-hover:grayscale-0"
              />
              <div
                className={`pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-500 group-hover:opacity-90 ${hoverReveal}`}
              />
              <div className="absolute top-6 right-6 bg-white/95 px-4 py-2 text-xs font-normal tracking-widest text-zinc-600 uppercase backdrop-blur-sm">
                Salons & hair
              </div>
              <div className="absolute bottom-0 left-0 flex w-full translate-y-4 transform items-end justify-between p-8 transition-transform duration-500 group-hover:translate-y-0">
                <div>
                  <p className="mb-3 text-sm font-normal tracking-widest text-white/75 uppercase">
                    Hair & beauty
                  </p>
                  <h3 className="text-3xl font-normal tracking-tighter text-white md:text-4xl lg:text-5xl">
                    Cuts, colour & care — clients pick a time that fits.
                  </h3>
                </div>
                <div className="flex h-16 w-16 items-center justify-center bg-emerald-400 text-black opacity-0 transition-opacity delay-100 duration-500 group-hover:opacity-100">
                  <ArrowUpRight strokeWidth={1.5} className="h-8 w-8" />
                </div>
              </div>
            </div>

            <div className="group relative min-h-[280px] cursor-default overflow-hidden bg-zinc-100 md:col-span-4 md:row-span-1 md:min-h-0">
              <img
                src="https://images.unsplash.com/photo-1621605815971-fbcc98df01d0?auto=format&fit=crop&w=800&q=80"
                alt="Barbershop interior"
                className="absolute inset-0 h-full w-full object-cover grayscale opacity-90 transition-all duration-700 ease-in-out group-hover:scale-105 group-hover:grayscale-0"
              />
              <div
                className={`pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-500 group-hover:opacity-90 ${hoverReveal}`}
              />
              <div className="absolute bottom-0 left-0 flex w-full items-end justify-between p-6">
                <div>
                  <p className="mb-2 text-xs font-normal tracking-widest text-white/75 uppercase">
                    Barbershops
                  </p>
                  <h3 className="text-2xl font-normal tracking-tight text-white md:text-3xl">
                    Tidier queue, fewer missed calls.
                  </h3>
                </div>
                <ArrowUpRight
                  strokeWidth={1.5}
                  className="h-6 w-6 text-emerald-400 opacity-0 transition-opacity group-hover:opacity-100"
                />
              </div>
            </div>

            <div className="group relative flex cursor-default flex-col justify-between overflow-hidden bg-black p-8 md:col-span-4 md:row-span-1">
              <div>
                <div className="mb-6 flex h-14 w-14 items-center justify-center bg-white/10 transition-colors duration-500 group-hover:bg-emerald-500">
                  <Car
                    strokeWidth={1.5}
                    className="h-7 w-7 text-white transition-colors duration-500 group-hover:text-black"
                  />
                </div>
                <h3 className="mb-3 text-3xl font-normal tracking-tight text-white">
                  Garages & dealers
                </h3>
                <p className="text-base font-thin leading-relaxed text-zinc-400">
                  Service slots, diagnostics, or handovers — same idea: the
                  customer books; you stay in control.
                </p>
              </div>
              <p className="mt-8 text-sm font-light leading-relaxed tracking-wide text-zinc-500">
                Salons and trades share the same idea: a private booking link for
                people who already chose you — not a public list of every
                competitor.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-col divide-y divide-zinc-200 md:flex-row md:divide-x md:divide-y-0">
          <div className="flex flex-1 flex-col justify-center p-10 transition-colors hover:bg-zinc-50 lg:p-16">
            <p className="mb-3 text-xs font-normal tracking-widest text-zinc-400 uppercase">
              Your link
            </p>
            <p className="text-xl font-normal tracking-tight text-black md:text-2xl">
              Each business gets its own address — you share it like any other
              link. No noisy marketplace layer on top.
            </p>
          </div>
          <div className="flex flex-1 flex-col justify-center p-10 transition-colors hover:bg-zinc-50 lg:p-16">
            <p className="mb-3 text-xs font-normal tracking-widest text-zinc-400 uppercase">
              Your day
            </p>
            <p className="text-xl font-normal tracking-tight text-black md:text-2xl">
              Services, staff, and hours stay yours to edit. Clients only see what
              you choose to offer online.
            </p>
          </div>
          <div className="flex flex-1 flex-col justify-center bg-zinc-50 p-10 lg:p-16">
            <p className="mb-3 text-xs font-normal tracking-widest text-zinc-400 uppercase">
              Your front desk
            </p>
            <p className="text-xl font-normal tracking-tight text-black md:text-2xl">
              Phone and walk-ins still matter — online booking is an extra lane,
              not a replacement for how you already work.
            </p>
          </div>
        </div>
      </section>

      <footer className="relative z-10 overflow-hidden bg-black pt-32 pb-16 text-white">
        <div className="relative z-20 mx-auto max-w-[1400px] px-6">
          <h2 className="mb-16 max-w-5xl text-4xl leading-[1.05] font-normal tracking-tight text-white md:text-5xl lg:text-6xl">
            Ready when you are — <br className="hidden sm:block" />
            <span className="font-thin text-zinc-500">
              whether you cut hair, turn wrenches, or run the front desk.
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
            <Link
              href={appOrigin ? `${appOrigin}/` : "/"}
              className="border border-white/20 px-8 py-5 text-base font-normal tracking-widest text-white uppercase transition-colors hover:border-emerald-500 hover:bg-white/5"
            >
              Cliste home
            </Link>
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
