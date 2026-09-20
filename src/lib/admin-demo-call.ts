import "server-only";

import { randomUUID } from "crypto";

import {
  AccessToken,
  AgentDispatchClient,
  RoomServiceClient,
} from "livekit-server-sdk";

import {
  ADMIN_DEMO_CALL_LINE_PRESETS,
  ADMIN_SIM_CALLER_E164,
  normalizeAdminDemoCalledNumber,
  type AdminDemoCallLine,
} from "@/lib/admin-demo-call-lines";
import { livekitHttpHostFromEnv } from "@/lib/livekit-phone-numbers";
import { createAdminClient } from "@/utils/supabase/admin";

export {
  ADMIN_DEMO_CALL_LINE_PRESETS,
  ADMIN_SIM_CALLER_E164,
  KAVANAGHS_DEMO_LINE_E164,
  isAllowedAdminDemoCalledNumber,
  normalizeAdminDemoCalledNumber,
  type AdminDemoCallLine,
  type AdminDemoCallLinePreset,
} from "@/lib/admin-demo-call-lines";

function resolveLiveKitCredentials(): { apiKey: string; apiSecret: string } {
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!apiKey || !apiSecret) {
    throw new Error(
      "LiveKit is not configured (LIVEKIT_API_KEY / LIVEKIT_API_SECRET).",
    );
  }
  return { apiKey, apiSecret };
}

function resolveLiveKitWsUrl(): string {
  const url = process.env.LIVEKIT_URL?.trim();
  if (!url) {
    throw new Error("LIVEKIT_URL is not set.");
  }
  return url;
}

function resolveAgentName(): string {
  return process.env.LIVEKIT_AGENT_NAME?.trim() || "cliste-voice-node";
}

function buildDispatchMetadata(calledNumber: string): string {
  return JSON.stringify({
    phone_number: calledNumber,
    caller_number: ADMIN_SIM_CALLER_E164,
    source: "admin_simulator",
  });
}

export async function loadAdminDemoCallLines(): Promise<AdminDemoCallLine[]> {
  const admin = createAdminClient();
  const e164List = ADMIN_DEMO_CALL_LINE_PRESETS.map((line) => line.e164);

  const { data } = await admin
    .from("phone_numbers")
    .select("e164, organizations(name, slug)")
    .in("e164", e164List);

  const orgByE164 = new Map<
    string,
    { name: string | null; slug: string | null }
  >();
  for (const row of data ?? []) {
    const org = row.organizations as
      | { name: string; slug: string }
      | { name: string; slug: string }[]
      | null;
    const orgRow = Array.isArray(org) ? org[0] : org;
    orgByE164.set(row.e164, {
      name: orgRow?.name?.trim() || null,
      slug: orgRow?.slug?.trim() || null,
    });
  }

  return ADMIN_DEMO_CALL_LINE_PRESETS.map((preset) => {
    const org = orgByE164.get(preset.e164);
    return {
      ...preset,
      orgName: org?.name ?? null,
      orgSlug: org?.slug ?? null,
    };
  });
}

export type StartAdminDemoCallInput = {
  calledNumber: string;
  staffIdentity: string;
};

export type StartAdminDemoCallResult = {
  livekitUrl: string;
  roomName: string;
  token: string;
  calledNumber: string;
  callerNumber: string;
};

export async function startAdminDemoCall(
  input: StartAdminDemoCallInput,
): Promise<StartAdminDemoCallResult> {
  const calledNumber = normalizeAdminDemoCalledNumber(input.calledNumber);
  if (!calledNumber) {
    throw new Error("Invalid demo line.");
  }

  const { apiKey, apiSecret } = resolveLiveKitCredentials();
  const host = livekitHttpHostFromEnv();
  const livekitUrl = resolveLiveKitWsUrl();
  const agentName = resolveAgentName();
  const roomName = `admin-demo-${randomUUID()}`;
  const metadata = buildDispatchMetadata(calledNumber);

  const roomClient = new RoomServiceClient(host, apiKey, apiSecret);
  const dispatchClient = new AgentDispatchClient(host, apiKey, apiSecret);

  await roomClient.createRoom({
    name: roomName,
    metadata,
    emptyTimeout: 60,
    departureTimeout: 30,
    maxParticipants: 4,
  });

  await dispatchClient.createDispatch(roomName, agentName, { metadata });

  const identity = `admin-${input.staffIdentity.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40)}-${randomUUID().slice(0, 8)}`;

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name: "Admin simulator",
    ttl: "45m",
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return {
    livekitUrl,
    roomName,
    token: await token.toJwt(),
    calledNumber,
    callerNumber: ADMIN_SIM_CALLER_E164,
  };
}

export type AdminDemoCallLogSummary = {
  id: string;
  createdAt: string;
  outcome: string | null;
  durationSeconds: number | null;
};

export async function findCallLogByRoomName(
  roomName: string,
): Promise<AdminDemoCallLogSummary | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("call_logs")
    .select("id, created_at, outcome, duration_seconds")
    .eq("room_name", roomName)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    createdAt: data.created_at,
    outcome: data.outcome,
    durationSeconds: data.duration_seconds,
  };
}
