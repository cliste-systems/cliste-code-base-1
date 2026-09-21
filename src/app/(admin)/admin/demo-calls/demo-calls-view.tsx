"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  adminDestructiveButtonClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-interactive";
import { formatIrishE164Display } from "@/lib/admin-demo-call-lines";
import {
  DemoCallEngineeringLogPanel,
  DemoCallRoomTelemetry,
  useDemoCallEngineeringLog,
} from "./demo-call-engineering-log";
import {
  DemoCallLinePicker,
  resolveSelectedDemoLine,
} from "./demo-call-line-picker";

type DemoCallSession = {
  livekitUrl: string;
  roomName: string;
  token: string;
  calledNumber: string;
  callerNumber: string;
  orgName?: string;
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

async function ensureMicrophoneAccess(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support microphone access.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function friendlyDemoCallError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return "Microphone access was blocked. Allow mic for localhost in your browser, then try again.";
    }
    if (err.name === "NotFoundError") {
      return "No microphone was found on this device.";
    }
  }
  if (err instanceof Error) {
    if (err.message.includes("Client initiated disconnect")) {
      return "Call disconnected before it started. Check microphone permission and try again.";
    }
    return err.message;
  }
  return "Failed to start demo call.";
}

function ActiveCallPanel({
  session,
  sessionStartedAt,
  sessionEndedAt,
  log,
  onEnd,
}: {
  session: DemoCallSession;
  sessionStartedAt: number;
  sessionEndedAt: number | null;
  log: ReturnType<typeof useDemoCallEngineeringLog>;
  onEnd: () => void;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const [agentJoined, setAgentJoined] = useState(false);

  useEffect(() => {
    const syncParticipants = () => {
      setAgentJoined(room.remoteParticipants.size > 0);
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
        <span className="text-sm text-gray-600">
          {session.orgName ?? "Store"} · {formatIrishE164Display(session.calledNumber)}
        </span>
      </div>

      <button
        type="button"
        onClick={async () => {
          log.append("info", "browser", "End call requested");
          await room.disconnect();
          onEnd();
        }}
        className={adminDestructiveButtonClass}
      >
        <PhoneOff className="size-3.5" aria-hidden />
        End call
      </button>

      <DemoCallRoomTelemetry
        sessionStartedAt={sessionStartedAt}
        sessionEndedAt={sessionEndedAt}
        log={log}
      />
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
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [sessionEndedAt, setSessionEndedAt] = useState<number | null>(null);
  const [callLog, setCallLog] = useState<CallLogSummary | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const engineeringLog = useDemoCallEngineeringLog({
    roomName: session?.roomName ?? null,
    sessionStartedAt,
    enabled:
      phase === "connecting" ||
      phase === "in_call" ||
      phase === "ended",
  });

  const [connectingElapsedMs, setConnectingElapsedMs] = useState(0);

  const frozenSessionElapsedMs =
    sessionStartedAt != null && sessionEndedAt != null
      ? Math.max(0, sessionEndedAt - sessionStartedAt)
      : 0;

  useEffect(() => {
    if (phase !== "connecting" || !sessionStartedAt) {
      setConnectingElapsedMs(0);
      return;
    }
    const tick = () => setConnectingElapsedMs(Date.now() - sessionStartedAt);
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [phase, sessionStartedAt]);

  const selectedLine = resolveSelectedDemoLine(lines, selectedE164);

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
        if (attempts >= 30) clearPoll();
      }, 2000);
    },
    [clearPoll],
  );

  useEffect(() => () => clearPoll(), [clearPoll]);

  const startCall = async () => {
    if (!selectedLine) return;
    const startedAt = Date.now();
    setError(null);
    setCallLog(null);
    setSessionEndedAt(null);
    engineeringLog.reset();
    setSessionStartedAt(startedAt);
    setPhase("connecting");
    engineeringLog.append(
      "info",
      "session",
      `Starting demo call to ${selectedLine.orgName}`,
      0,
    );

    try {
      engineeringLog.append("info", "browser", "Requesting microphone access");
      await ensureMicrophoneAccess();
      engineeringLog.append("success", "browser", "Microphone access granted");
    } catch (err) {
      setSession(null);
      setSessionStartedAt(null);
      setPhase("error");
      setError(friendlyDemoCallError(err));
      engineeringLog.append("error", "browser", friendlyDemoCallError(err));
      return;
    }

    try {
      engineeringLog.append("info", "dashboard", "Creating LiveKit room + agent dispatch");
      const res = await fetch("/api/admin/demo-call/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calledNumber: selectedLine.e164 }),
      });
      const data = (await res.json()) as DemoCallSession & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to start demo call.");
      }
      engineeringLog.append(
        "success",
        "dashboard",
        `Room ${data.roomName.slice(0, 18)}… ready`,
      );
      setSession(data);
      setPhase("in_call");
    } catch (err) {
      setSession(null);
      setSessionStartedAt(null);
      setPhase("error");
      const message = friendlyDemoCallError(err);
      setError(message);
      engineeringLog.append("error", "dashboard", message);
    }
  };

  const endCall = useCallback(() => {
    const roomName = session?.roomName;
    const endedAt = Date.now();
    setSessionEndedAt(endedAt);
    engineeringLog.append(
      "info",
      "session",
      "Call ended · waiting for post-call webhook",
      sessionStartedAt != null ? endedAt - sessionStartedAt : undefined,
    );
    setPhase("ended");
    if (roomName) pollCallLog(roomName);
  }, [engineeringLog, pollCallLog, session?.roomName, sessionStartedAt]);

  const reset = () => {
    clearPoll();
    setSession(null);
    setSessionStartedAt(null);
    setSessionEndedAt(null);
    setCallLog(null);
    setError(null);
    engineeringLog.reset();
    setPhase("idle");
  };

  const pickerDisabled =
    phase === "connecting" || phase === "in_call" || phase === "ended";

  const showLinePicker = phase === "idle";

  return (
    <div className="flex flex-col gap-6">
      {phase === "connecting" ? (
        <>
          <AdminSectionCard
            title="Starting session"
            description={selectedLine?.orgName ?? "Demo call"}
          >
            <div className="flex items-center gap-2 p-5 text-sm text-gray-600">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Creating LiveKit room and dispatching voice worker…
            </div>
          </AdminSectionCard>
          <DemoCallEngineeringLogPanel
            entries={engineeringLog.entries}
            metrics={engineeringLog.metrics}
            connectionState={ConnectionState.Connecting}
            elapsedMs={connectingElapsedMs}
          />
        </>
      ) : null}

      {phase === "in_call" && session && sessionStartedAt ? (
        <AdminSectionCard
          title="Live session"
          description={`${session.orgName ?? selectedLine?.orgName ?? "Store"} · ${formatIrishE164Display(session.calledNumber)}`}
        >
          <div className="p-5">
            <LiveKitRoom
              key={session.roomName}
              serverUrl={session.livekitUrl}
              token={session.token}
              connect
              audio
              video={false}
              onDisconnected={endCall}
              onMediaDeviceFailure={() => {
                const message =
                  "Microphone access failed during the call. Check browser permissions and try again.";
                setError(message);
                engineeringLog.append("error", "media", message);
              }}
              onError={(err) => {
                if (err.message.includes("Client initiated disconnect")) return;
                const message = friendlyDemoCallError(err);
                setError(message);
                engineeringLog.append("error", "livekit", message);
              }}
            >
              <ActiveCallPanel
                session={session}
                sessionStartedAt={sessionStartedAt}
                sessionEndedAt={sessionEndedAt}
                log={engineeringLog}
                onEnd={endCall}
              />
            </LiveKitRoom>
          </div>
        </AdminSectionCard>
      ) : null}

      {phase === "ended" && session ? (
        <>
          <AdminSectionCard title="Call ended">
            <div className="space-y-3 p-5">
              <p className="text-sm text-gray-600">
                Post-call processing runs on the voice worker. Metrics below update until
                the call log lands.
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
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Waiting for call log…
                </div>
              )}
              <button
                type="button"
                onClick={reset}
                className={adminSecondaryButtonClass}
              >
                <Mic className="size-3.5" aria-hidden />
                Start another call
              </button>
            </div>
          </AdminSectionCard>
          <DemoCallEngineeringLogPanel
            entries={engineeringLog.entries}
            metrics={engineeringLog.metrics}
            connectionState={ConnectionState.Disconnected}
            elapsedMs={frozenSessionElapsedMs}
            sessionEndedAt={sessionEndedAt}
            callDurationSeconds={callLog?.durationSeconds ?? null}
          />
        </>
      ) : null}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {showLinePicker ? (
        <DemoCallLinePicker
          lines={lines}
          selectedE164={selectedE164}
          onSelectedE164Change={setSelectedE164}
          disabled={pickerDisabled}
          toolbarAction={
            <button
              type="button"
              disabled={!selectedLine || pickerDisabled}
              onClick={startCall}
              className={adminPrimaryButtonClass}
            >
              {phase === "connecting" ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Phone className="size-3.5" aria-hidden />
              )}
              Start demo call
            </button>
          }
        />
      ) : null}
    </div>
  );
}
