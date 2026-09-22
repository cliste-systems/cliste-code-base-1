import "server-only";

import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/utils/supabase/admin";

const RESEND_API_BASE = "https://api.resend.com";
const DEFAULT_FROM_EMAIL = "brendan@hellocara.ie";
const DEFAULT_FROM_NAME = "HelloCara";

export type AdminEmailFolder = "inbox" | "archived" | "sent";

export type AdminEmailListItem = {
  id: string;
  direction: "inbound" | "outbound";
  parentResendEmailId: string | null;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  subject: string;
  preview: string;
  occurredAt: string;
  readAt: string | null;
  archivedAt: string | null;
};

export type AdminEmailMessage = AdminEmailListItem & {
  messageId: string | null;
  replyToAddresses: string[];
  ccAddresses: string[];
  textBody: string;
  attachments: Array<Record<string, unknown>>;
  replies: AdminEmailListItem[];
};

type ResendReceivedListItem = {
  id: string;
  to?: string[] | string;
  from?: string;
  created_at?: string;
  subject?: string;
  bcc?: string[] | string;
  cc?: string[] | string;
  reply_to?: string[] | string;
  message_id?: string;
  attachments?: unknown[];
};

type ResendReceivedDetail = ResendReceivedListItem & {
  text?: string | null;
  html?: string | null;
  headers?: unknown;
};

type AdminEmailRow = {
  resend_email_id: string;
  direction: "inbound" | "outbound";
  parent_resend_email_id: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  from_address: string;
  from_name: string | null;
  to_addresses: string[] | null;
  cc_addresses: string[] | null;
  bcc_addresses: string[] | null;
  reply_to_addresses: string[] | null;
  subject: string;
  text_body: string | null;
  html_body: string | null;
  headers: unknown;
  attachments: unknown;
  received_at: string | null;
  sent_at: string | null;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
};

function resendApiKey(): string {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error("RESEND_API_KEY is not configured.");
  }
  return key;
}

export function adminInboxFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL;
}

export function adminInboxFromName(): string {
  const configured = process.env.RESEND_FROM_NAME?.trim();
  if (!configured) return DEFAULT_FROM_NAME;
  return /^hello\s*cara$/i.test(configured) ? "HelloCara" : configured;
}

async function resendFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${RESEND_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${resendApiKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as {
        message?: string;
        error?: { message?: string };
      };
      detail = body.message || body.error?.message || detail;
    } catch {
      // Keep status text.
    }
    throw new Error(`Resend error (${response.status}): ${detail}`);
  }

  return (await response.json()) as T;
}

function asAddressArray(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function parseMailbox(value: string | undefined): {
  name: string | null;
  email: string;
} {
  const raw = value?.trim() || "";
  const match = raw.match(/^\s*(?:"?([^"<]+?)"?\s*)?<([^<>\s]+@[^<>\s]+)>\s*$/);
  if (match) {
    return {
      name: match[1]?.trim() || null,
      email: match[2]!.trim().toLowerCase(),
    };
  }
  return { name: null, email: raw.toLowerCase() };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function previewText(value: string | null | undefined, max = 130): string {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trim()}…`;
}

function rowToListItem(row: AdminEmailRow): AdminEmailListItem {
  const body = row.text_body || (row.html_body ? stripHtml(row.html_body) : "");
  return {
    id: row.resend_email_id,
    direction: row.direction,
    parentResendEmailId: row.parent_resend_email_id,
    fromAddress: row.from_address,
    fromName: row.from_name,
    toAddresses: row.to_addresses ?? [],
    subject: row.subject,
    preview: previewText(body),
    occurredAt:
      row.received_at || row.sent_at || row.created_at || new Date().toISOString(),
    readAt: row.read_at,
    archivedAt: row.archived_at,
  };
}

async function listResendReceived(limit = 100): Promise<ResendReceivedListItem[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const response = await resendFetch<{
    data?: ResendReceivedListItem[];
  }>(`/emails/receiving?limit=${safeLimit}`);
  return Array.isArray(response.data) ? response.data : [];
}

async function getResendReceived(id: string): Promise<ResendReceivedDetail> {
  return resendFetch<ResendReceivedDetail>(
    `/emails/receiving/${encodeURIComponent(id)}`,
  );
}

async function syncInboundMetadata(): Promise<void> {
  const received = await listResendReceived(100);
  if (received.length === 0) return;

  const admin = createAdminClient();
  const ids = received.map((email) => email.id);
  const { data: existingRows, error: existingError } = await admin
    .from("admin_email_messages")
    .select("resend_email_id")
    .in("resend_email_id", ids);

  if (existingError) throw new Error(existingError.message);

  const existing = new Set(
    (existingRows ?? []).map((row) => String(row.resend_email_id)),
  );
  const newMessages = received.filter((email) => !existing.has(email.id));
  if (newMessages.length === 0) return;

  const rows = newMessages.map((email) => {
    const from = parseMailbox(email.from);
    return {
      resend_email_id: email.id,
      direction: "inbound",
      message_id: email.message_id ?? null,
      from_address: from.email,
      from_name: from.name,
      to_addresses: asAddressArray(email.to),
      cc_addresses: asAddressArray(email.cc),
      bcc_addresses: asAddressArray(email.bcc),
      reply_to_addresses: asAddressArray(email.reply_to),
      subject: email.subject?.trim() || "(no subject)",
      attachments: Array.isArray(email.attachments) ? email.attachments : [],
      received_at: email.created_at ?? new Date().toISOString(),
    };
  });

  const { error } = await admin.from("admin_email_messages").insert(rows);
  if (error) throw new Error(error.message);
}

export async function listAdminInbox(
  folder: AdminEmailFolder,
): Promise<AdminEmailListItem[]> {
  if (folder !== "sent") {
    await syncInboundMetadata();
  }

  const admin = createAdminClient();
  let query = admin
    .from("admin_email_messages")
    .select(
      "resend_email_id,direction,parent_resend_email_id,message_id,in_reply_to,from_address,from_name,to_addresses,cc_addresses,bcc_addresses,reply_to_addresses,subject,text_body,html_body,headers,attachments,received_at,sent_at,read_at,archived_at,created_at",
    )
    .limit(250);

  if (folder === "sent") {
    query = query.eq("direction", "outbound").order("sent_at", { ascending: false });
  } else if (folder === "archived") {
    query = query
      .eq("direction", "inbound")
      .not("archived_at", "is", null)
      .order("received_at", { ascending: false });
  } else {
    query = query
      .eq("direction", "inbound")
      .is("archived_at", null)
      .order("received_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as AdminEmailRow[]).map(rowToListItem);
}

export async function getAdminEmailMessage(
  resendEmailId: string,
): Promise<AdminEmailMessage> {
  const id = resendEmailId.trim();
  if (!id) throw new Error("Email ID is required.");

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("admin_email_messages")
    .select(
      "resend_email_id,direction,parent_resend_email_id,message_id,in_reply_to,from_address,from_name,to_addresses,cc_addresses,bcc_addresses,reply_to_addresses,subject,text_body,html_body,headers,attachments,received_at,sent_at,read_at,archived_at,created_at",
    )
    .eq("resend_email_id", id)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Email not found.");

  let row = existing as AdminEmailRow;

  if (row.direction === "inbound") {
    try {
      const detail = await getResendReceived(id);
      const from = parseMailbox(detail.from);
      const textBody =
        detail.text?.trim() ||
        (detail.html ? stripHtml(detail.html) : row.text_body || "");

      const update = {
        message_id: detail.message_id ?? row.message_id,
        from_address: from.email || row.from_address,
        from_name: from.name ?? row.from_name,
        to_addresses: asAddressArray(detail.to),
        cc_addresses: asAddressArray(detail.cc),
        bcc_addresses: asAddressArray(detail.bcc),
        reply_to_addresses: asAddressArray(detail.reply_to),
        subject: detail.subject?.trim() || row.subject,
        text_body: textBody,
        html_body: detail.html ?? row.html_body,
        headers:
          detail.headers && typeof detail.headers === "object"
            ? detail.headers
            : row.headers ?? {},
        attachments: Array.isArray(detail.attachments)
          ? detail.attachments
          : row.attachments ?? [],
        received_at: detail.created_at ?? row.received_at,
        read_at: row.read_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: updated, error: updateError } = await admin
        .from("admin_email_messages")
        .update(update)
        .eq("resend_email_id", id)
        .select(
          "resend_email_id,direction,parent_resend_email_id,message_id,in_reply_to,from_address,from_name,to_addresses,cc_addresses,bcc_addresses,reply_to_addresses,subject,text_body,html_body,headers,attachments,received_at,sent_at,read_at,archived_at,created_at",
        )
        .single();

      if (updateError) throw new Error(updateError.message);
      row = updated as AdminEmailRow;
    } catch (error) {
      // If Resend has aged the message out, retain the local snapshot.
      if (!row.text_body && !row.html_body) throw error;
      if (!row.read_at) {
        await admin
          .from("admin_email_messages")
          .update({ read_at: new Date().toISOString() })
          .eq("resend_email_id", id);
        row = { ...row, read_at: new Date().toISOString() };
      }
    }
  }

  const parentId =
    row.direction === "inbound" ? row.resend_email_id : row.parent_resend_email_id;
  let replies: AdminEmailListItem[] = [];
  if (parentId) {
    const { data: replyRows, error: repliesError } = await admin
      .from("admin_email_messages")
      .select(
        "resend_email_id,direction,parent_resend_email_id,message_id,in_reply_to,from_address,from_name,to_addresses,cc_addresses,bcc_addresses,reply_to_addresses,subject,text_body,html_body,headers,attachments,received_at,sent_at,read_at,archived_at,created_at",
      )
      .eq("direction", "outbound")
      .eq("parent_resend_email_id", parentId)
      .order("sent_at", { ascending: true });

    if (repliesError) throw new Error(repliesError.message);
    replies = ((replyRows ?? []) as AdminEmailRow[]).map(rowToListItem);
  }

  const item = rowToListItem(row);
  return {
    ...item,
    messageId: row.message_id,
    replyToAddresses: row.reply_to_addresses ?? [],
    ccAddresses: row.cc_addresses ?? [],
    textBody:
      row.text_body || (row.html_body ? stripHtml(row.html_body) : "(No text body)"),
    attachments: Array.isArray(row.attachments)
      ? (row.attachments as Array<Record<string, unknown>>)
      : [],
    replies,
  };
}

export async function setAdminEmailState(input: {
  resendEmailId: string;
  read?: boolean;
  archived?: boolean;
}): Promise<void> {
  const update: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof input.read === "boolean") {
    update.read_at = input.read ? new Date().toISOString() : null;
  }
  if (typeof input.archived === "boolean") {
    update.archived_at = input.archived ? new Date().toISOString() : null;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("admin_email_messages")
    .update(update)
    .eq("resend_email_id", input.resendEmailId.trim());

  if (error) throw new Error(error.message);
}

export async function sendNewAdminEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ id: string }> {
  const to = input.to.trim().toLowerCase();
  const subject = input.subject.trim();
  const text = input.text.trim();

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error("Enter a valid recipient email address.");
  }
  if (!subject) throw new Error("Subject is required.");
  if (subject.length > 500) throw new Error("Subject is too long.");
  if (!text) throw new Error("Email body cannot be empty.");
  if (text.length > 20_000) throw new Error("Email body is too long.");

  const fromEmail = adminInboxFromEmail();
  const fromName = adminInboxFromName();
  const response = await resendFetch<{ id: string }>("/emails", {
    method: "POST",
    headers: {
      "Idempotency-Key": `admin-compose-${randomUUID()}`,
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      text,
    }),
  });

  if (!response.id) throw new Error("Resend did not return an email ID.");

  const admin = createAdminClient();
  const { error } = await admin.from("admin_email_messages").insert({
    resend_email_id: response.id,
    direction: "outbound",
    parent_resend_email_id: null,
    from_address: fromEmail,
    from_name: fromName,
    to_addresses: [to],
    subject,
    text_body: text,
    sent_at: new Date().toISOString(),
    read_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
  return { id: response.id };
}

export async function replyToAdminEmail(input: {
  resendEmailId: string;
  text: string;
}): Promise<{ id: string }> {
  const text = input.text.trim();
  if (!text) throw new Error("Reply cannot be empty.");
  if (text.length > 20_000) throw new Error("Reply is too long.");

  const source = await getAdminEmailMessage(input.resendEmailId);
  if (source.direction !== "inbound") {
    throw new Error("Replies must start from a received email.");
  }

  const replyAddress =
    source.replyToAddresses.map((value) => parseMailbox(value).email).find(Boolean) ||
    source.fromAddress;
  if (!replyAddress || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyAddress)) {
    throw new Error("This email does not contain a valid reply address.");
  }

  const subject = /^re:/i.test(source.subject)
    ? source.subject
    : `Re: ${source.subject}`;
  const fromEmail = adminInboxFromEmail();
  const fromName = adminInboxFromName();
  const headers: Record<string, string> = {};

  if (source.messageId) {
    headers["In-Reply-To"] = source.messageId;
    headers.References = source.messageId;
  }

  const response = await resendFetch<{ id: string }>("/emails", {
    method: "POST",
    headers: {
      "Idempotency-Key": `admin-reply-${randomUUID()}`,
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [replyAddress],
      subject,
      text,
      ...(Object.keys(headers).length ? { headers } : {}),
    }),
  });

  if (!response.id) throw new Error("Resend did not return an email ID.");

  const admin = createAdminClient();
  const { error: insertError } = await admin.from("admin_email_messages").insert({
    resend_email_id: response.id,
    direction: "outbound",
    parent_resend_email_id: source.id,
    in_reply_to: source.messageId,
    from_address: fromEmail,
    from_name: fromName,
    to_addresses: [replyAddress],
    subject,
    text_body: text,
    sent_at: new Date().toISOString(),
    read_at: new Date().toISOString(),
  });

  if (insertError) throw new Error(insertError.message);

  await setAdminEmailState({
    resendEmailId: source.id,
    read: true,
  });

  return { id: response.id };
}
