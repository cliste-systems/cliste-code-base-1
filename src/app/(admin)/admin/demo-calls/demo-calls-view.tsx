"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useConnectionState,
  useRoomContext,
} from "@livekit/components-react";
import { ConnectionState, RoomEvent } from "livekit-client";
import { Loader2, Mic, Phone, PhoneOff } from "lucide-react";

import { AdminBadge } from "@/components/admin/admin-badge";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import type { AdminDemoCallLine } from "@/lib/admin-demo-call-lines";
import { cn } from "@/lib/utils";

type DemoCallSession = {
  livekitUrl: string;
  roomName: string;
  token: string;
  calledNumber: string;
  callerNumber: string;
};

type CallLogSummary = {
  id: string;
  createdAt: string;
  outcome: string | null;
  durationSeconds: number | null;
};

type DemoCallsViewProps = {
  lines: AdminDemoCallLine[];
};

type CallPhase = "idle" | "connecting" | "in_call" | "ended" | "error";

function formatE164(e164: string): string {
  if (e164.startsWith("+353")) {
    const rest = e164.slice(4);
    return `+353 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`.trim();
  }
  return e164;
}

function ActiveCallPanel({
  session,
  onEnd,
}: {
  session: DemoCallSession;
  onEnd: () => void;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const [agentJoined, setAgentJoined] = useState(false);

  useEffect(() => {
    const syncParticipants = () => {
      const remote = room.remoteParticipants.size;
      setAgentJoined(remote > 0);
    };
    syncParticipants();
    room.on(RoomEvent.ParticipantConnected, syncParticipants);
    room.on(RoomEvent.ParticipantDisconnected, syncParticipants);
    return () => {
      room.off(RoomEvent.ParticipantConnected, syncParticipants);
      room.off(RoomEvent.ParticipantDisconnected, syncParticipants);
    };
  }, [room]);

  const statusLabel = useMemo(() => {
    if (connectionState === ConnectionState.Connecting) return "Connecting…";
    if (connectionState === ConnectionState.Reconnecting) return "Reconnecting…";
    if (connectionState === ConnectionState.Disconnected) return "Disconnected";
    if (!agentJoined) return "Waiting for Cara…";
    return "In call";
  }, [agentJoined, connectionState]);

  return (
    <div className="space-y-4">
      <RoomAudioRenderer />
      <StartAudio label="Enable audio" />

      <div className="flex flex-wrap items-center gap-3">
        <AdminBadge tone={agentJoined ? "success" : "neutral"}>{statusLabel}</AdminBadge>
        <span className="text-sm text-slate-600">
          Simulating {formatE164(session.calledNumber)}
        </span>
      </div>

      <p className="text-sm text-slate-600">
        Speak into your microphone — this uses the same voice worker as a real phone call,
        without Twilio/PSTN charges.
      </p>

      <button
        type="button"
        onClick={async () => {
          await room.disconnect();
          onEnd();
        }}
        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
      >
        <PhoneOff className="size-4" aria-hidden />
        End call
      </button>
    </div>
  );
}

export function DemoCallsView({ lines }: DemoCallsViewProps) {
  const [selectedE164, setSelectedE164] = useState<string | null>(
    lines[0]?.e164 ?? null,
  );
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<DemoCallSession | null>(null);
  const [callLog, setCallLog] = useState<CallLogSummary | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedLine = lines.find((line) => line.e164 === selectedE164) ?? null;

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollCallLog = useCallback(
    (roomName: string) => {
      clearPoll();
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts += 1;
        try {
          const res = await fetch(
            `/api/admin/demo-call/call-log?roomName=${encodeURIComponent(roomName)}`,
          );
          if (!res.ok) return;
          const data = (await res.json()) as { callLog: CallLogSummary | null };
          if (data.callLog) {
            setCallLog(data.callLog);
            clearPoll();
          }
        } catch {
          /* retry */
        }
        if (attempts >= 30) {
          clearPoll();
        }
      }, 2000);
    },
    [clearPoll],
  );

  useEffect(() => () => clearPoll(), [clearPoll]);

  const startCall = async () => {
    if (!selectedE164) return;
    setError(null);
    setCallLog(null);
    setPhase("connecting");

    try {
      const res = await fetch("/api/admin/demo-call/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calledNumber: selectedE164 }),
      });
      const data = (await res.json()) as DemoCallSession & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to start demo call.");
      }
      setSession(data);
      setPhase("in_call");
    } catch (err) {
      setSession(null);
      setPhase("error");
      setError(err instanceof Error ? err.message : "Failed to start demo call.");
    }
  };

  const endCall = useCallback(() => {
    const roomName = session?.roomName;
    setSession(null);
    setPhase("ended");
    if (roomName) {
      pollCallLog(roomName);
    }
  }, [pollCallLog, session?.roomName]);

  const reset = () => {
    clearPoll();
    setSession(null);
    setCallLog(null);
    setError(null);
    setPhase("idle");
  };

  return (
    <div className="space-y-6">
      {phase === "connecting" ? (
        <AdminSectionCard title="Starting session">
          <div className="flex items-center gap-2 p-4 text-sm text-slate-600">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Creating LiveKit room and dispatching voice worker…
          </div>
        </AdminSectionCard>
      ) : null}

      {phase === "idle" || phase === "error" ? (
        <>
          <AdminSectionCard
            title="Choose a demo line"
            description="Each line routes through the production voice worker with the same dialed-number metadata as a real PSTN call."
          >
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              {lines.map((line) => {
                const selected = line.e164 === selectedE164;
                return (
                  <button
                    key={line.e164}
                    type="button"
                    onClick={() => setSelectedE164(line.e164)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors",
                      selected
                        ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900/10"
                        : "border-gray-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <p className="font-medium text-[#0b1220]">{line.label}</p>
                    {line.orgName ? (
                      <p className="mt-0.5 text-xs text-slate-500">{line.orgName}</p>
                    ) : null}
                    <p className="mt-2 font-mono text-xs text-slate-700">
                      {formatE164(line.e164)}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">
                      {line.description}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-500">{line.workerPath}</p>
                  </button>
                );
              })}
            </div>
          </AdminSectionCard>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={!selectedLine || phase === "connecting"}
            onClick={startCall}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0b1220] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {phase === "connecting" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Phone className="size-4" aria-hidden />
            )}
            Start demo call
          </button>
        </>
      ) : null}

      {phase === "in_call" && session ? (
        <AdminSectionCard title="Live session" description={selectedLine?.label ?? session.calledNumber}>
          <div className="p-4">
            <LiveKitRoom
              serverUrl={session.livekitUrl}
              token={session.token}
              connect
              audio
              video={false}
              onDisconnected={endCall}
              onError={(err) => {
                setError(err.message);
                setPhase("error");
                setSession(null);
              }}
            >
              <ActiveCallPanel session={session} onEnd={endCall} />
            </LiveKitRoom>
          </div>
        </AdminSectionCard>
      ) : null}

      {phase === "ended" ? (
        <AdminSectionCard title="Call ended">
          <div className="space-y-3 p-4">
            <p className="text-sm text-slate-600">
              The voice worker is finishing post-call processing. This usually takes a few
              seconds.
            </p>
            {callLog ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <p>
                  Call logged{" "}
                  <span className="font-mono text-xs">{callLog.id.slice(0, 8)}…</span>
                  {callLog.outcome ? ` · ${callLog.outcome}` : ""}
                  {callLog.durationSeconds != null
                    ? ` · ${callLog.durationSeconds}s`
                    : ""}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Waiting for call log…
              </div>
            )}
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-[#0b1220] hover:bg-slate-50"
            >
              <Mic className="size-4" aria-hidden />
              Start another call
            </button>
          </div>
        </AdminSectionCard>
      ) : null}

      <p className="text-xs text-slate-500">
        PSTN/Twilio is skipped. LiveKit inference (STT/LLM/TTS) still bills like a real call.
        Simulated caller ID: <span className="font-mono">+353870000001</span>.
        Need help? See{" "}
        <Link href="/admin/phone-pool" className="text-slate-700 underline">
          Phone pool
        </Link>
        .
      </p>
    </div>
  );
}
