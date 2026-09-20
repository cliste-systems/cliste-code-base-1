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
import { Loader2, Mic, Phone, PhoneOff, Search } from "lucide-react";

import { AdminBadge, adminTableMutedClass } from "@/components/admin/admin-badge";
import { AdminListCard } from "@/components/admin/admin-list-card";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import type { AdminDemoCallLine } from "@/lib/admin-demo-call-lines";
import { formatIrishE164Display } from "@/lib/admin-demo-call-lines";
import {
  clientProvisionSourceLabel,
  type ClientProvisionFilter,
} from "@/lib/client-provision-source";
import {
  ORGANIZATION_NICHE_ADMIN_LABELS,
  parseOrganizationNiche,
} from "@/lib/organization-niche";
import { cn } from "@/lib/utils";
import {
  DemoCallEngineeringLogPanel,
  DemoCallRoomTelemetry,
  useDemoCallEngineeringLog,
} from "./demo-call-engineering-log";
import {
  adminTableBodyClass,
  adminTableClass,
  adminTableEmptyClass,
  adminTableHeadClass,
  adminTableRowClass,
  adminTableTdClass,
  adminTableThClass,
} from "@/components/admin/admin-table";

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

const FILTER_TABS: { value: ClientProvisionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "managed", label: "Managed" },
  { value: "self_serve", label: "Self-serve" },
];

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

function DemoCallFilterTabs({
  activeValue,
  onChange,
}: {
  activeValue: ClientProvisionFilter;
  onChange: (value: ClientProvisionFilter) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
      role="tablist"
      aria-label="Store type"
    >
      {FILTER_TABS.map(({ value, label }) => {
        const active = activeValue === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
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
        className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50"
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
  const [provisionFilter, setProvisionFilter] =
    useState<ClientProvisionFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
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

  const filteredLines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return lines.filter((line) => {
      if (provisionFilter !== "all" && line.provisionSource !== provisionFilter) {
        return false;
      }
      if (!q) return true;
      return (
        line.orgName.toLowerCase().includes(q) ||
        line.orgSlug.toLowerCase().includes(q) ||
        line.e164.includes(q) ||
        formatIrishE164Display(line.e164).toLowerCase().includes(q) ||
        ORGANIZATION_NICHE_ADMIN_LABELS[
          parseOrganizationNiche(line.niche)
        ]
          .toLowerCase()
          .includes(q)
      );
    });
  }, [lines, provisionFilter, searchQuery]);

  const selectedLine =
    lines.find((line) => line.e164 === selectedE164) ??
    filteredLines[0] ??
    null;

  useEffect(() => {
    if (
      selectedE164 &&
      filteredLines.some((line) => line.e164 === selectedE164)
    ) {
      return;
    }
    setSelectedE164(filteredLines[0]?.e164 ?? null);
  }, [filteredLines, selectedE164]);

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

  const countLabel = `${filteredLines.length} line${filteredLines.length === 1 ? "" : "s"}${
    provisionFilter !== "all"
      ? ` · ${clientProvisionSourceLabel(provisionFilter)}`
      : ""
  }${searchQuery.trim() ? " · filtered" : ""}`;

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
                className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50"
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
        <AdminListCard
          countLabel={countLabel}
        toolbar={
          <>
            <DemoCallFilterTabs
              activeValue={provisionFilter}
              onChange={setProvisionFilter}
            />
            <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-gray-400"
                aria-hidden
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search company, slug, number…"
                disabled={pickerDisabled}
                className="w-full rounded-md border border-gray-200 bg-white py-1.5 pr-3 pl-8 text-sm text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-200/80 disabled:opacity-60"
              />
            </div>
            <button
              type="button"
              disabled={!selectedLine || pickerDisabled}
              onClick={startCall}
              className="inline-flex items-center gap-2 rounded-md border border-gray-900 bg-gray-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {phase === "connecting" ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Phone className="size-3.5" aria-hidden />
              )}
              Start demo call
            </button>
          </>
        }
      >
        <table className={adminTableClass}>
          <thead className={adminTableHeadClass}>
            <tr>
              <th className={adminTableThClass}>Company</th>
              <th className={adminTableThClass}>Type</th>
              <th className={adminTableThClass}>Niche</th>
              <th className={adminTableThClass}>Number</th>
              <th className={adminTableThClass}>Lane</th>
            </tr>
          </thead>
          <tbody className={adminTableBodyClass}>
            {filteredLines.length === 0 ? (
              <tr>
                <td colSpan={5} className={adminTableEmptyClass}>
                  No assigned lines match your search. Assign a number in{" "}
                  <Link href="/admin/phone-pool" className="font-medium underline">
                    Phone pool
                  </Link>{" "}
                  first.
                </td>
              </tr>
            ) : (
              filteredLines.map((line) => {
                const selected = line.e164 === selectedLine?.e164;
                return (
                  <tr
                    key={line.e164}
                    className={cn(
                      adminTableRowClass,
                      selected && "bg-slate-50",
                      pickerDisabled
                        ? "opacity-60"
                        : "cursor-pointer hover:bg-gray-50/80",
                    )}
                    onClick={() => {
                      if (!pickerDisabled) setSelectedE164(line.e164);
                    }}
                    aria-selected={selected}
                  >
                    <td className={adminTableTdClass}>
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            "mt-1 inline-flex size-3.5 shrink-0 rounded-full border",
                            selected
                              ? "border-gray-900 bg-gray-900"
                              : "border-gray-300 bg-white",
                          )}
                          aria-hidden
                        />
                        <div>
                          <span className="font-medium text-gray-900">
                            {line.orgName}
                          </span>
                          {line.orgSlug ? (
                            <span className="mt-0.5 block font-mono text-xs text-gray-400">
                              {line.orgSlug}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className={adminTableTdClass}>
                      <AdminBadge variant="plain">
                        {clientProvisionSourceLabel(line.provisionSource)}
                      </AdminBadge>
                    </td>
                    <td className={adminTableTdClass}>
                      <span className={adminTableMutedClass}>
                        {
                          ORGANIZATION_NICHE_ADMIN_LABELS[
                            parseOrganizationNiche(line.niche)
                          ]
                        }
                      </span>
                    </td>
                    <td className={adminTableTdClass}>
                      <span className="font-mono text-xs text-gray-700">
                        {formatIrishE164Display(line.e164)}
                      </span>
                    </td>
                    <td className={adminTableTdClass}>
                      <span className={adminTableMutedClass}>{line.workerPath}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </AdminListCard>
      ) : null}
    </div>
  );
}
