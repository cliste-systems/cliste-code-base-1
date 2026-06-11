/**
 * Brand gradients shared with cliste-systems-website (lib/site-layout.ts).
 * Keep in sync when the marketing hero ramp changes.
 */

/** Main hero card — 128deg silver ramp (marketing site Hero.tsx). */
export const CLISTE_HERO_CARD_GRADIENT =
  "linear-gradient(128deg, #fcfcfd 0%, #f5f6f8 16%, #e8eaee 32%, #cfd3da 50%, #8a8f99 72%, #3f4451 88%, #1c1f26 100%)";

/** Hero palette stops — for radial / layered backgrounds. */
export const CLISTE_HERO_GRADIENT_STOPS = {
  white: "#fcfcfd",
  mist: "#f5f6f8",
  cloud: "#e8eaee",
  silver: "#cfd3da",
  steel: "#8a8f99",
  slate: "#3f4451",
  ink: "#1c1f26",
} as const;

/**
 * Full-viewport onboarding canvas — Lovable-style bottom corner washes
 * using the Cliste hero palette (light top, visible blooms at the base).
 */
export const CLISTE_ONBOARDING_CANVAS_GRADIENT = [
  `radial-gradient(ellipse 130% 95% at 50% -22%, ${CLISTE_HERO_GRADIENT_STOPS.white} 0%, transparent 58%)`,
  `radial-gradient(ellipse 120% 90% at 100% 105%, ${CLISTE_HERO_GRADIENT_STOPS.steel} 0%, ${CLISTE_HERO_GRADIENT_STOPS.silver} 32%, transparent 68%)`,
  `radial-gradient(ellipse 110% 85% at 0% 105%, ${CLISTE_HERO_GRADIENT_STOPS.silver} 0%, ${CLISTE_HERO_GRADIENT_STOPS.cloud} 38%, transparent 66%)`,
  `radial-gradient(ellipse 140% 70% at 50% 115%, ${CLISTE_HERO_GRADIENT_STOPS.slate} 0%, ${CLISTE_HERO_GRADIENT_STOPS.steel} 28%, transparent 62%)`,
  `linear-gradient(180deg, ${CLISTE_HERO_GRADIENT_STOPS.white} 0%, ${CLISTE_HERO_GRADIENT_STOPS.mist} 42%, ${CLISTE_HERO_GRADIENT_STOPS.cloud} 72%, ${CLISTE_HERO_GRADIENT_STOPS.silver} 100%)`,
].join(", ");
