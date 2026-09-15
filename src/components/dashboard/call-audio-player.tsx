"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { fetchCallRecordingPlaybackUrl } from "@/app/(dashboard)/dashboard/call-history/actions";

type CallAudioPlayerProps = {
  callLogId: string;
  /** Hint only — playback is always resolved from the server for this call id. */
  hasRecording?: boolean;
};

export function CallAudioPlayer({
  callLogId,
  hasRecording: _hasRecording = false,
}: CallAudioPlayerProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadUrl = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await fetchCallRecordingPlaybackUrl(callLogId);
      if (!result.ok) {
        setUnavailable(true);
        setSignedUrl(null);
        setMessage(result.message);
        return;
      }
      setUnavailable(false);
      setSignedUrl(result.url);
    } catch {
      setUnavailable(true);
      setSignedUrl(null);
      setMessage("Could not load recording. Try again.");
    } finally {
      setLoading(false);
    }
  }, [callLogId]);

  useEffect(() => {
    setSignedUrl(null);
    setUnavailable(false);
    setMessage(null);
    void loadUrl();
  }, [callLogId, loadUrl]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-slate-500">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading recording…
      </div>
    );
  }

  if (unavailable || !signedUrl) {
    return (
      <div className="space-y-2">
        <p className="text-[13px] text-slate-500">
          {message ?? "Recording not available for this call."}
        </p>
        <button
          type="button"
          onClick={() => void loadUrl()}
          className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#b9c8c1] bg-white px-3 text-[13px] font-medium text-[#35443f] transition-colors hover:bg-[#f6faf7]"
        >
          Check for recording
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <audio
        controls
        preload="metadata"
        src={signedUrl}
        aria-label="Call recording"
        className="h-10 w-full"
        onError={() => {
          setSignedUrl(null);
          void loadUrl();
        }}
      />
      <p className="text-[12px] leading-relaxed text-slate-500">
        Stored for 30 days. Playback link expires after a few minutes — use Check
        for recording if playback stops.
      </p>
    </div>
  );
}
