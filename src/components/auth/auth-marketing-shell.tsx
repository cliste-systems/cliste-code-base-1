"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { ClisteLogoMark } from "@/components/cliste-logo-mark";
import { HeroPhotoEnter } from "@/components/onboarding/onboarding-canvas-background";
import {
  OnboardingEnter,
  OnboardingEnterProvider,
  useOnboardingAnimateIn,
} from "@/components/onboarding/onboarding-enter";
import { onboardingPageTransition } from "@/components/onboarding/onboarding-motion";
import {
  ONBOARDING_GLASS_CARD,
  ONBOARDING_HEADLINE,
  ONBOARDING_LOGO_SIZE,
  ONBOARDING_SHELL_LOGO_GAP,
  ONBOARDING_SHELL_SECTION_GAP,
  ONBOARDING_SUBHEADLINE,
} from "@/components/onboarding/onboarding-ui";
import { PUBLIC_ASSETS } from "@/lib/public-assets";
import { cn } from "@/lib/utils";

import { AUTH_CARD, AUTH_PAGE_BG } from "./auth-ui";

type PageBackground = {
  jpg: string;
  webp: string;
};

type Props = {
  title: string;
  subtitle: string;
  marketingHeadline?: ReactNode;
  marketingBody?: string;
  marketingBullets?: string[];
  pageBackground?: PageBackground;
  urlError?: string | null;
  children: ReactNode;
};

const PROFILE_CENTER_READABILITY =
  "radial-gradient(ellipse 72% 88% at 50% 44%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.18) 52%, transparent 76%)";

const PROFILE_TOP_BOTTOM_SOFTEN =
  "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 16%, transparent 84%, rgba(255,255,255,0.08) 100%)";

const PROFILE_MOBILE_WASH =
  "linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.5) 58%, rgba(255,255,255,0.32) 100%)";

function AuthPageBackground({ assets }: { assets: PageBackground }) {
  const ready = useOnboardingAnimateIn();
  const reduceMotion = useReducedMotion() ?? false;
  const animationKey = `${assets.jpg}-${ready ? "on" : "off"}`;
  const objectPosition = "50% 42%";

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ backgroundColor: "#f6f5f3" }}
      aria-hidden
    >
      {reduceMotion ? (
        <img
          src={assets.jpg}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition }}
          decoding="async"
          fetchPriority="high"
        />
      ) : (
        <HeroPhotoEnter
          src={assets.jpg}
          objectPosition={objectPosition}
          animateIn={ready}
          resetKey={animationKey}
        />
      )}
      <div
        className="absolute inset-0 md:hidden"
        style={{ background: PROFILE_MOBILE_WASH }}
      />
      <div
        className="absolute inset-0 hidden md:block"
        style={{ background: PROFILE_CENTER_READABILITY }}
      />
      <div
        className="absolute inset-0 hidden md:block"
        style={{ background: PROFILE_TOP_BOTTOM_SOFTEN }}
      />
    </div>
  );
}

function SignupGlassShell({
  title,
  subtitle,
  urlError,
  children,
  assets,
}: {
  title: string;
  subtitle: string;
  urlError?: string | null;
  children: ReactNode;
  assets: PageBackground;
}) {
  const ready = useOnboardingAnimateIn();
  const reduceMotion = useReducedMotion() ?? false;
  const animatePage = !reduceMotion;

  const panel = (
    <div
      className={cn(
        ONBOARDING_GLASS_CARD,
        "w-full rounded-[28px] px-6 py-8 sm:px-9 sm:py-10",
      )}
    >
      <OnboardingEnterProvider>
        <div
          className={cn(
            "mx-auto flex w-full max-w-md flex-col items-center",
            ONBOARDING_SHELL_SECTION_GAP,
          )}
        >
          <div
            className={cn(
              "flex w-full flex-col items-center",
              ONBOARDING_SHELL_LOGO_GAP,
            )}
          >
            <OnboardingEnter tone="profile" className="flex justify-center">
              <ClisteLogoMark size={ONBOARDING_LOGO_SIZE} priority />
            </OnboardingEnter>
            <OnboardingEnter tone="profile" className="w-full text-center">
              <h1 className={ONBOARDING_HEADLINE}>{title}</h1>
              <p className={cn(ONBOARDING_SUBHEADLINE, "mt-2")}>{subtitle}</p>
            </OnboardingEnter>
          </div>

          <div className="w-full">
            {urlError ? (
              <OnboardingEnter tone="profile">
                <p
                  className="mb-4 rounded-2xl border border-red-200/80 bg-red-50/70 px-4 py-3 text-center text-sm leading-relaxed text-red-700"
                  role="alert"
                >
                  {urlError}
                </p>
              </OnboardingEnter>
            ) : null}
            {children}
          </div>
        </div>
      </OnboardingEnterProvider>
    </div>
  );

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#f6f5f3] p-4 antialiased sm:p-6">
      <AuthPageBackground assets={assets} />
      {animatePage ? (
        <motion.main
          className="relative z-10 w-full max-w-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={onboardingPageTransition}
        >
          {panel}
        </motion.main>
      ) : (
        <main className="relative z-10 w-full max-w-lg">{panel}</main>
      )}
    </div>
  );
}

function LegacyAuthCard({
  title,
  subtitle,
  marketingHeadline,
  marketingBody,
  marketingBullets,
  urlError,
  children,
}: Omit<Props, "pageBackground">) {
  return (
    <main className={AUTH_CARD}>
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#030406] via-[#07090d] to-[#0a0c10] p-12 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-white/[0.06] via-transparent to-transparent" />
        <div className="relative z-10">
          <div className="mb-16 flex h-11 w-11 items-center justify-center rounded-lg bg-white shadow-sm">
            <Image
              src={PUBLIC_ASSETS.logo}
              alt="Cliste"
              width={30}
              height={30}
              className="h-7 w-7 object-contain"
              priority
            />
          </div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 backdrop-blur-md">
            Cliste Systems
          </div>
          <h2 className="mb-6 text-3xl leading-[1.12] font-light tracking-tight text-white lg:text-4xl">
            {marketingHeadline}
          </h2>
          <p className="max-w-sm text-sm leading-relaxed font-light text-zinc-300/85">
            {marketingBody}
          </p>
          {marketingBullets && marketingBullets.length > 0 ? (
            <ul className="mt-8 max-w-sm space-y-3 text-sm font-light text-zinc-300/85">
              {marketingBullets.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-2 inline-block size-1.5 shrink-0 rounded-full bg-zinc-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="relative z-10 mt-16 flex items-center gap-3 pt-6 text-xs text-zinc-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zinc-400 opacity-20" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-zinc-300" />
          </span>
          All systems operational
        </div>
      </section>

      <section className="relative flex flex-col justify-center bg-white p-8 sm:p-12">
        <div className="mb-10 flex flex-col lg:hidden">
          <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
            <Image
              src={PUBLIC_ASSETS.logo}
              alt="Cliste"
              width={30}
              height={30}
              className="h-7 w-7 object-contain"
              priority
            />
          </div>
          <h1 className="mb-1.5 text-2xl font-light tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="text-sm font-light text-slate-500">{subtitle}</p>
        </div>

        <div className="mb-10 hidden lg:block">
          <h1 className="mb-1.5 text-2xl font-light tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="text-sm font-light text-slate-500">{subtitle}</p>
        </div>

        {urlError ? (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm leading-relaxed text-red-700">
            {urlError}
          </p>
        ) : null}

        {children}
      </section>
    </main>
  );
}

export function AuthMarketingShell({
  title,
  subtitle,
  marketingHeadline,
  marketingBody,
  marketingBullets,
  pageBackground,
  urlError,
  children,
}: Props) {
  if (pageBackground) {
    return (
      <SignupGlassShell
        title={title}
        subtitle={subtitle}
        urlError={urlError}
        assets={pageBackground}
      >
        {children}
      </SignupGlassShell>
    );
  }

  return (
    <div className={AUTH_PAGE_BG}>
      <LegacyAuthCard
        title={title}
        subtitle={subtitle}
        marketingHeadline={marketingHeadline}
        marketingBody={marketingBody}
        marketingBullets={marketingBullets}
        urlError={urlError}
      >
        {children}
      </LegacyAuthCard>
    </div>
  );
}
