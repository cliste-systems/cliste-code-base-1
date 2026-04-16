"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  MapPin,
  Navigation,
  Scissors,
  Star,
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
          <div className="mb-16">
            <p className="mb-8 flex items-center gap-4 text-sm font-normal tracking-widest text-zinc-400 uppercase">
              <span className="h-px w-12 bg-zinc-300" />
              Global Booking Network
            </p>
            <h1 className="text-6xl leading-[0.85] font-normal tracking-tighter text-black uppercase md:text-8xl lg:text-9xl">
              Reserve <br className="hidden md:block" />
              <span className="mt-2 flex items-center gap-4 md:mt-4 md:ml-[15%] md:gap-8">
                <span className="hidden h-[1px] w-24 bg-black md:block lg:w-48" />
                <span className="bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text font-thin text-transparent lowercase italic">
                  anything.
                </span>
              </span>
            </h1>
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
                  01 / Service
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    id="input-service"
                    readOnly
                    tabIndex={-1}
                    value={service}
                    placeholder="What do you need?"
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
                    "Creative Workspace",
                    "Photography Studio",
                    "Personal Training",
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
                  <div className="mt-2 border-t border-zinc-100 pt-4 text-base font-normal text-emerald-600">
                    <span className="block px-6 py-4">View All Categories</span>
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
                    02 / Location
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      id="input-location"
                      readOnly
                      tabIndex={-1}
                      value={location}
                      placeholder="Where at?"
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
                    Popular
                  </div>
                  {["New York, NY", "London, UK", "Los Angeles, CA"].map((city) => (
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
              Curated <br className="hidden md:block" />
              <span className="font-thin text-zinc-400 italic">Experiences.</span>
            </h2>
            <a
              href="#"
              className="inline-flex items-center gap-2 border-b border-black pb-1 text-base font-normal tracking-widest text-black uppercase transition-colors hover:text-emerald-600"
            >
              Explore Directory
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
              <div className="absolute top-6 right-6 flex items-center gap-2 bg-white px-4 py-2">
                <Star
                  strokeWidth={1.5}
                  className="h-4 w-4 fill-emerald-500 text-emerald-500"
                />
                <span className="text-sm font-normal tracking-wide text-black">
                  4.9
                </span>
              </div>
              <div className="absolute bottom-0 left-0 flex w-full translate-y-4 transform items-end justify-between p-8 transition-transform duration-500 group-hover:translate-y-0">
                <div>
                  <p className="mb-3 text-sm font-normal tracking-widest text-white/70 uppercase">
                    Workspace & Studios
                  </p>
                  <h3 className="text-4xl font-normal tracking-tighter text-white md:text-5xl lg:text-6xl">
                    The Arch Studios
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
                    Personal Training
                  </p>
                  <h3 className="text-3xl font-normal tracking-tight text-white">
                    Iron & Flow
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
                  Grooming & Style
                </h3>
                <p className="text-base font-thin leading-relaxed text-zinc-400">
                  Top-rated barbers and stylists in your immediate area.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-3 text-sm font-normal tracking-wide text-white uppercase transition-all group-hover:gap-5 group-hover:text-emerald-400">
                View Category
                <ArrowRight strokeWidth={1.5} className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-col divide-y divide-zinc-200 md:flex-row md:divide-x md:divide-y-0">
          <div className="flex flex-1 flex-col justify-center p-10 transition-colors hover:bg-zinc-50 lg:p-16">
            <p className="mb-4 text-xs font-normal tracking-widest text-zinc-400 uppercase">
              Volume
            </p>
            <p className="text-5xl font-normal tracking-tighter text-black lg:text-7xl">
              10M+
            </p>
            <p className="mt-3 text-base font-thin text-zinc-500">
              Appointments successfully secured.
            </p>
          </div>
          <div className="flex flex-1 flex-col justify-center p-10 transition-colors hover:bg-zinc-50 lg:p-16">
            <p className="mb-4 text-xs font-normal tracking-widest text-zinc-400 uppercase">
              Network
            </p>
            <p className="text-5xl font-normal tracking-tighter text-black lg:text-7xl">
              45k
            </p>
            <p className="mt-3 text-base font-thin text-zinc-500">
              Verified professionals worldwide.
            </p>
          </div>
          <div className="flex flex-1 flex-col justify-center bg-zinc-50 p-10 lg:p-16">
            <p className="mb-4 text-xs font-normal tracking-widest text-zinc-400 uppercase">
              Trust Score
            </p>
            <div className="flex items-center gap-6">
              <p className="text-5xl font-normal tracking-tighter text-black lg:text-7xl">
                4.9
              </p>
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-1 text-emerald-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      strokeWidth={1.5}
                      className="h-5 w-5 fill-emerald-500"
                    />
                  ))}
                </div>
                <p className="text-sm font-thin tracking-wide text-zinc-500">
                  Based on reviews
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 overflow-hidden bg-black pt-32 pb-16 text-white">
        <div className="relative z-20 mx-auto max-w-[1400px] px-6">
          <h2 className="mb-16 max-w-5xl text-5xl leading-[0.85] font-normal tracking-tighter uppercase md:text-7xl lg:text-9xl">
            Operate <br />
            <span className="font-thin text-zinc-500 lowercase italic">
              efficiently.
            </span>
          </h2>

          <div className="flex flex-col items-start gap-6 border-b border-white/10 pb-24 sm:flex-row sm:items-center">
            <Link
              href={partnerHref}
              className="flex items-center gap-3 bg-emerald-400 px-8 py-5 text-base font-normal tracking-widest text-black uppercase transition-colors hover:bg-emerald-300"
            >
              Start Platform
              <ArrowRight strokeWidth={1.5} className="h-6 w-6" />
            </Link>
            <a
              href="#"
              className="border border-white/20 px-8 py-5 text-base font-normal tracking-widest text-white uppercase transition-colors hover:border-emerald-500 hover:bg-white/5"
            >
              View Documentation
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
