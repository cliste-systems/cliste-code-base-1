"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";


import { MAX_GREETING_SCRIPT_LENGTH } from "@/lib/voice-greeting-security";
import { cn } from "@/lib/utils";

type Props = {
  line: string;
  className?: string;
};

let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;

function stopVoicePreview() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

export async function speakVoicePreview(
  line: string,
  parts?: { greetingIntro: string; greetingClosing: string },
): Promise<
  | { ok: true }
  | {
      ok: false;
      message: string;
      introIssue?: boolean;
      closingIssue?: boolean;
    }
> {
  stopVoicePreview();

  const text = line.trim();
  if (!text) {
    return { ok: false, message: "Nothing to preview yet." };
  }
  if (text.length > MAX_GREETING_SCRIPT_LENGTH) {
    return { ok: false, message: "Preview text is too long." };
  }

  try {
    const response = await fetch("/api/onboarding/voice-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        ...(parts
          ? {
              greetingIntro: parts.greetingIntro,
              greetingClosing: parts.greetingClosing,
            }
          : {}),
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; introIssue?: boolean; closingIssue?: boolean }
        | null;
      return {
        ok: false,
        message: payload?.error ?? "Voice preview failed.",
        introIssue: payload?.introIssue,
        closingIssue: payload?.closingIssue,
      };
    }

    const blob = await response.blob();
    activeObjectUrl = URL.createObjectURL(blob);
    activeAudio = new Audio(activeObjectUrl);
    await activeAudio.play();
    return { ok: true };
  } catch {
    return { ok: false, message: "Voice preview failed." };
  }
}

export function OnboardingVoicePreview({ line, className }: Props) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => stopVoicePreview();
  }, []);

  async function handlePlayToggle() {
    if (playing || loading) {
      stopVoicePreview();
      setPlaying(false);
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    const result = await speakVoicePreview(line);
    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    audioRef.current = activeAudio;
    setPlaying(true);

    const audio = activeAudio;
    if (!audio) return;

    audio.onended = () => setPlaying(false);
    audio.onerror = () => {
      setPlaying(false);
      setError("Voice preview failed.");
    };
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/75 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(15,23,42,0.06)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
            Full greeting preview
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#0b1220]">
            &ldquo;{line}&rdquo;
          </p>
        </div>
        <button
          type="button"
          onClick={handlePlayToggle}
          disabled={loading}
          className={cn(
            "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full",
            "border border-slate-200/80 bg-slate-50 text-[#0b1220] shadow-sm transition-colors",
            "hover:bg-white disabled:cursor-not-allowed disabled:opacity-50",
          )}
          aria-label={playing ? "Stop voice preview" : "Play voice preview"}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : playing ? (
            <Pause className="size-4" aria-hidden />
          ) : (
            <Play className="ml-0.5 size-4" aria-hidden />
          )}
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-[12px] text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
