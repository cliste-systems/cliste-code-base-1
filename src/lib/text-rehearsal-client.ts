"use client";

import { Room, RoomEvent } from "livekit-client";

import {
  encodeTextRehearsalPacket,
  parseTextRehearsalPacket,
  TEXT_REHEARSAL_TOPIC,
  type TextRehearsalInboundPacket,
  type TextRehearsalOutboundPacket,
} from "@/lib/text-rehearsal-protocol";

export type TextRehearsalTurnResult = {
  assistant: string;
  tools: { name: string; args: Record<string, unknown> }[];
  transcriptLines: string[];
  toolIssues?: string[];
  error?: string;
};

export type TextRehearsalSessionConnect = {
  livekitUrl: string;
  roomName: string;
  token: string;
};

async function connectTextRehearsalRoom(
  session: TextRehearsalSessionConnect,
): Promise<Room> {
  const room = new Room({ adaptiveStream: false, dynacast: false });
  await room.connect(session.livekitUrl, session.token, {
    autoSubscribe: false,
  });
  return room;
}

async function waitForWorkerReady(room: Room, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let pingTimer: number | null = null;
    let timeoutTimer: number | null = null;

    const cleanup = () => {
      if (pingTimer != null) window.clearInterval(pingTimer);
      if (timeoutTimer != null) window.clearTimeout(timeoutTimer);
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ParticipantConnected, onParticipantChange);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantChange);
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };

    const onData = (
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic && topic !== TEXT_REHEARSAL_TOPIC) return;
      const packet = parseTextRehearsalPacket(payload);
      if (!packet) return;
      if (packet.type === "session_ready" || packet.type === "pong") {
        finish();
      }
    };

    const onParticipantChange = () => {
      if (room.remoteParticipants.size > 0) {
        ping();
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.ParticipantConnected, onParticipantChange);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantChange);

    const ping = () => {
      const packet: TextRehearsalInboundPacket = { type: "ping", turnId: "bootstrap" };
      void room.localParticipant
        ?.publishData(encodeTextRehearsalPacket(packet), {
          reliable: true,
          topic: TEXT_REHEARSAL_TOPIC,
        })
        .catch(() => {
          /* worker may not be up yet */
        });
    };

    onParticipantChange();
    ping();
    pingTimer = window.setInterval(ping, 2500);
    timeoutTimer = window.setTimeout(
      () => finish(new Error("Voice worker did not connect in time.")),
      timeoutMs,
    );
  });
}

async function sendCallerTurn(
  room: Room,
  text: string,
  timeoutMs: number,
): Promise<TextRehearsalTurnResult> {
  const turnId = crypto.randomUUID();
  const transcriptLines: string[] = [`Caller: ${text}`];
  const tools: { name: string; args: Record<string, unknown> }[] = [];
  const toolIssues: string[] = [];
  let assistant = "";

  const handlePacket = (packet: TextRehearsalOutboundPacket) => {
    if (packet.type === "assistant_line" && packet.turnId === turnId) {
      assistant = packet.text;
      transcriptLines.push(packet.text);
      return;
    }
    if (packet.type === "lookup_filler" && packet.turnId === turnId) {
      transcriptLines.push(`[lookup filler] ${packet.text}`);
      return;
    }
    if (packet.type === "tool_call" && packet.turnId === turnId) {
      tools.push({ name: packet.name, args: packet.args });
      transcriptLines.push(`[Tool] ${packet.name} ${JSON.stringify(packet.args)}`);
      return;
    }
    if (packet.type === "tool_result" && packet.turnId === turnId) {
      transcriptLines.push(
        `[Tool result] ${packet.name} ${packet.ok ? "ok" : "failed"}: ${packet.message}`,
      );
      if (!packet.ok) {
        toolIssues.push(`${packet.name}: ${packet.message}`);
      }
    }
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutTimer: number | null = null;

    const cleanup = () => {
      if (timeoutTimer != null) window.clearTimeout(timeoutTimer);
      room.off(RoomEvent.DataReceived, onData);
    };

    const finish = (result: TextRehearsalTurnResult | Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (result instanceof Error) reject(result);
      else resolve(result);
    };

    const onData = (
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic && topic !== TEXT_REHEARSAL_TOPIC) return;
      const packet = parseTextRehearsalPacket(payload);
      if (!packet || packet.type === "ping" || packet.type === "caller_turn" || packet.type === "end_session") {
        return;
      }
      handlePacket(packet);
      if (packet.type === "turn_complete" && packet.turnId === turnId) {
        finish({
          assistant: packet.assistant || assistant,
          tools: packet.tools.length ? packet.tools : tools,
          transcriptLines,
          toolIssues,
        });
        return;
      }
      if (packet.type === "error" && packet.turnId === turnId) {
        finish({
          assistant,
          tools,
          transcriptLines,
          toolIssues,
          error: packet.message,
        });
      }
    };

    room.on(RoomEvent.DataReceived, onData);

    const packet: TextRehearsalInboundPacket = {
      type: "caller_turn",
      text,
      turnId,
    };

    void room.localParticipant
      .publishData(encodeTextRehearsalPacket(packet), {
        reliable: true,
        topic: TEXT_REHEARSAL_TOPIC,
      })
      .catch((error) => {
        finish(error instanceof Error ? error : new Error("Failed to send caller turn."));
      });

    timeoutTimer = window.setTimeout(
      () =>
        finish(
          new Error(
            assistant
              ? "Timed out before turn_complete."
              : "Timed out waiting for Cara reply.",
          ),
        ),
      timeoutMs,
    );
  });
}

async function endTextRehearsalRoom(room: Room): Promise<void> {
  try {
    const packet: TextRehearsalInboundPacket = { type: "end_session" };
    await room.localParticipant.publishData(encodeTextRehearsalPacket(packet), {
      reliable: true,
      topic: TEXT_REHEARSAL_TOPIC,
    });
  } catch {
    /* best effort */
  }
  room.disconnect();
}

export async function runIsolatedTextRehearsalTurn(input: {
  session: TextRehearsalSessionConnect;
  callerText: string;
  readyTimeoutMs?: number;
  turnTimeoutMs?: number;
}): Promise<TextRehearsalTurnResult> {
  const room = await connectTextRehearsalRoom(input.session);
  try {
    await waitForWorkerReady(room, input.readyTimeoutMs ?? 45_000);
    return await sendCallerTurn(room, input.callerText, input.turnTimeoutMs ?? 90_000);
  } finally {
    await endTextRehearsalRoom(room);
  }
}

export async function startTextRehearsalSession(
  calledNumber: string,
): Promise<TextRehearsalSessionConnect & { calledNumber: string; orgName?: string }> {
  const res = await fetch("/api/admin/demo-call/text-rehearsal/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ calledNumber }),
  });
  const data = (await res.json()) as TextRehearsalSessionConnect & {
    calledNumber?: string;
    orgName?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error ?? "Failed to start text rehearsal.");
  }
  return {
    livekitUrl: data.livekitUrl,
    roomName: data.roomName,
    token: data.token,
    calledNumber: data.calledNumber ?? calledNumber,
    orgName: data.orgName,
  };
}
