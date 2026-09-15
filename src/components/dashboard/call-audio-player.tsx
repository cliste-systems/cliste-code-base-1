"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { fetchCallRecordingPlaybackUrl } from "@/app/(dashboard)/dashboard/call-history/actions";

type CallAudioPlayerProps = {
  callLogId: string;
  hasRecording?: boolean;
};

export function CallAudioPlayer({
  callLogId,
  hasRecording = false,
}: CallAudioPlayerProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(!hasRecording);

  const loadUrl = useCallback(async () => {
    if (unavailable) return;
    setLoading(true);
    try {
      const result = await fetchCallRecordingPlaybackUrl(callLogId);
      if (!result.ok) {
        setUnavailable(true);
        setSignedUrl(null);
        return;
      }
      setSignedUrl(result.url);
    } catch {
      setUnavailable(true);
      setSignedUrl(null);
    } finally {
      setLoading(false);
    }
  }, [callLogId, unavailable]);

  useEffect(() => {
    setSignedUrl(null);
    setUnavailable(!hasRecording);
  }, [callLogId, hasRecording]);

  if (!hasRecording || unavailable) {
    return (
      <p className="text-[13px] text-slate-500">
        Recording not available for this call.
      </p>
    );
  }

  if (!signedUrl) {
    return (
      <button
        type="button"
        onClick={() => void loadUrl()}
        disabled={loading}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#b9c8c1] bg-white px-3 text-[13px] font-medium text-[#35443f] transition-colors hover:bg-[#f6faf7] disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading recording…
          </>
        ) : (
          "Play recording"
        )}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <audio
        controls
        preload="none"
        src={signedUrl}
        aria-label="Call recording"
        className="w-full max-w-md"
        onError={() => {
          setSignedUrl(null);
          void loadUrl();
        }}
      />
      <p className="text-[12px] leading-relaxed text-slate-500">
        Stored for 30 days. Playback link expires after a few minutes — reload if
        needed.
      </p>
    </div>
  );
}
