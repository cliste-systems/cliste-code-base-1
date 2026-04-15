/**
 * Short UI tones for Cara send/receive. Web Audio only — no assets.
 * Skipped when `prefers-reduced-motion: reduce` (common proxy for less sensory UI).
 */

function prefersReducedSensory(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let sharedCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (
      window as unknown as { webkitAudioContext?: typeof AudioContext }
    ).webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    try {
      sharedCtx = new AC();
    } catch {
      return null;
    }
  }
  return sharedCtx;
}

function scheduleBeep(
  ctx: AudioContext,
  when: number,
  frequency: number,
  durationSec: number,
  peakGain: number,
): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, when);
  const eps = 0.0001;
  g.gain.setValueAtTime(eps, when);
  g.gain.exponentialRampToValueAtTime(peakGain, when + 0.012);
  g.gain.exponentialRampToValueAtTime(eps, when + durationSec);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + durationSec + 0.03);
}

/** Outgoing user message — quick higher tap. */
export async function playCaraMessageSentSound(): Promise<void> {
  if (prefersReducedSensory()) return;
  const ctx = getContext();
  if (!ctx) return;
  try {
    await ctx.resume();
  } catch {
    return;
  }
  const t = ctx.currentTime;
  scheduleBeep(ctx, t, 780, 0.07, 0.11);
}

/** Cara reply landed — soft two-note “in”. */
export async function playCaraMessageReceivedSound(): Promise<void> {
  if (prefersReducedSensory()) return;
  const ctx = getContext();
  if (!ctx) return;
  try {
    await ctx.resume();
  } catch {
    return;
  }
  const t = ctx.currentTime;
  scheduleBeep(ctx, t, 523.25, 0.1, 0.09);
  scheduleBeep(ctx, t + 0.09, 659.25, 0.12, 0.085);
}
