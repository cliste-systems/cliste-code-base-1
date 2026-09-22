"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Ban,
  CheckCircle2,
  Clock3,
  Eye,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  MousePointerClick,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-interactive";
import { cn } from "@/lib/utils";

type Folder = "inbox" | "archived" | "sent";
type GrammarTarget = "reply" | "compose";
type MessageViewMode = "formatted" | "plain";
type EmailIdentityKey = "hello" | "billing";
type DeliveryStatus =
  | "sent"
  | "delayed"
  | "delivered"
  | "opened"
  | "clicked"
  | "complained"
  | "suppressed"
  | "bounced"
  | "failed"
  | "unknown";

type DeliveryEvent = {
  id: string;
  type: string;
  occurredAt: string;
  detail: string | null;
};

type EmailIdentity = {
  key: EmailIdentityKey;
  label: string;
  email: string;
  name: string;
};

type EmailListItem = {
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
  deliveryStatus: DeliveryStatus | null;
  deliveryStatusAt: string | null;
};

type EmailMessage = EmailListItem & {
  messageId: string | null;
  replyToAddresses: string[];
  ccAddresses: string[];
  textBody: string;
  htmlBody: string | null;
  senderBlocked: boolean;
  attachments: Array<Record<string, unknown>>;
  replies: EmailListItem[];
  deliveryEvents: DeliveryEvent[];
};

const FOLDERS: Array<{ value: Folder; label: string; icon: typeof Inbox }> = [
  { value: "inbox", label: "Inbox", icon: Inbox },
  { value: "archived", label: "Archived", icon: Archive },
  { value: "sent", label: "Sent", icon: Send },
];

function whenLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("en-IE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("en-IE", {
    day: "2-digit",
    month: "short",
  });
}

function fullWhenLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function displaySender(item: EmailListItem): string {
  return item.fromName?.trim() || item.fromAddress;
}

function deliveryStatusLabel(status: DeliveryStatus | null): string {
  switch (status) {
    case "delivered":
      return "Delivered";
    case "opened":
      return "Opened";
    case "clicked":
      return "Clicked";
    case "delayed":
      return "Delayed";
    case "bounced":
      return "Bounced";
    case "failed":
      return "Failed";
    case "suppressed":
      return "Suppressed";
    case "complained":
      return "Complaint";
    case "sent":
      return "Sent";
    default:
      return "Sent";
  }
}

function DeliveryStatusBadge({
  status,
  compact = false,
}: {
  status: DeliveryStatus | null;
  compact?: boolean;
}) {
  const normalized = status ?? "sent";
  const failure = ["bounced", "failed", "suppressed", "complained"].includes(
    normalized,
  );
  const Icon =
    normalized === "opened"
      ? Eye
      : normalized === "clicked"
        ? MousePointerClick
        : normalized === "delayed"
          ? Clock3
          : failure
            ? TriangleAlert
            : CheckCircle2;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border font-medium",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
        failure
          ? "border-red-200 bg-red-50 text-red-700"
          : normalized === "opened" || normalized === "clicked"
            ? "border-slate-300 bg-slate-100 text-slate-800"
            : "border-slate-200 bg-white text-slate-600",
      )}
      title={
        normalized === "opened"
          ? "Open tracking can be affected by image blocking and mail privacy features."
          : undefined
      }
    >
      <Icon className={compact ? "size-2.5" : "size-3"} aria-hidden />
      {deliveryStatusLabel(status)}
    </span>
  );
}

function deliveryStages(message: EmailMessage): Array<{
  label: "Sent" | "Delivered" | "Opened";
  complete: boolean;
}> {
  const eventTypes = new Set(message.deliveryEvents.map((event) => event.type));
  const opened =
    message.deliveryStatus === "opened" ||
    message.deliveryStatus === "clicked" ||
    eventTypes.has("email.opened") ||
    eventTypes.has("email.clicked");
  const delivered =
    opened ||
    message.deliveryStatus === "delivered" ||
    eventTypes.has("email.delivered");

  return [
    { label: "Sent", complete: true },
    { label: "Delivered", complete: delivered },
    { label: "Opened", complete: opened },
  ];
}

function deliveryFailed(status: DeliveryStatus | null): boolean {
  return ["failed", "bounced", "suppressed", "complained"].includes(
    status ?? "",
  );
}

function buildEmailFrameDocument(
  html: string,
  stripOpenTrackingPixel = false,
): string {
  let safeHtml = html.replace(
    /<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi,
    "",
  );
  if (stripOpenTrackingPixel) {
    safeHtml = safeHtml.replace(
      /<img\b[^>]*hellocara-email-open\?token=[^>]*>/gi,
      "",
    );
  }
  const head = [
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<base target="_blank">',
    "<style>",
    "html{background:#fff;color-scheme:light;}",
    "html,body{margin:0!important;min-height:100%;}",
    "body{max-width:100%;overflow-wrap:anywhere;}",
    "img{max-width:100%;height:auto;}",
    "</style>",
  ].join("");

  if (/<head(?:\s|>)/i.test(safeHtml)) {
    return safeHtml.replace(/<head([^>]*)>/i, `<head$1>${head}`);
  }
  if (/<html(?:\s|>)/i.test(safeHtml)) {
    return safeHtml.replace(/<html([^>]*)>/i, `<html$1><head>${head}</head>`);
  }
  return `<!doctype html><html><head>${head}</head><body>${safeHtml}</body></html>`;
}

function EmailHtmlFrame({
  html,
  stripOpenTrackingPixel = false,
}: {
  html: string;
  stripOpenTrackingPixel?: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [height, setHeight] = useState(560);
  const srcDoc = useMemo(
    () => buildEmailFrameDocument(html, stripOpenTrackingPixel),
    [html, stripOpenTrackingPixel],
  );

  useEffect(() => {
    setHeight(560);
    return () => observerRef.current?.disconnect();
  }, [html]);

  const syncHeight = useCallback(() => {
    const documentNode = frameRef.current?.contentDocument;
    if (!documentNode) return;
    const bodyHeight = documentNode.body?.scrollHeight ?? 0;
    const rootHeight = documentNode.documentElement?.scrollHeight ?? 0;
    const measured = Math.max(bodyHeight, rootHeight, 360);
    setHeight(Math.min(measured + 8, 8000));
  }, []);

  const handleLoad = useCallback(() => {
    observerRef.current?.disconnect();
    syncHeight();

    const documentNode = frameRef.current?.contentDocument;
    if (!documentNode || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(syncHeight);
    observer.observe(documentNode.documentElement);
    if (documentNode.body) observer.observe(documentNode.body);
    observerRef.current = observer;

    window.setTimeout(syncHeight, 250);
    window.setTimeout(syncHeight, 1000);
  }, [syncHeight]);

  return (
    <iframe
      ref={frameRef}
      title="Email message"
      srcDoc={srcDoc}
      onLoad={handleLoad}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      className="block w-full border-0 bg-white"
      style={{ height }}
    />
  );
}

async function apiJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

export function AdminEmailInboxView({
  identities,
}: {
  identities: EmailIdentity[];
}) {
  const [folder, setFolder] = useState<Folder>("inbox");
  const [identityKey, setIdentityKey] = useState<EmailIdentityKey>(
    identities[0]?.key ?? "hello",
  );
  const [messages, setMessages] = useState<EmailListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<EmailMessage | null>(null);
  const messageCacheRef = useRef<Map<string, EmailMessage>>(new Map());
  const messageRequestRef = useRef(0);
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [composing, setComposing] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [sending, setSending] = useState(false);
  const [checkingGrammar, setCheckingGrammar] =
    useState<GrammarTarget | null>(null);
  const [changingState, setChangingState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [messageView, setMessageView] = useState<MessageViewMode>("formatted");

  const activeIdentity =
    identities.find((identity) => identity.key === identityKey) ??
    identities[0] ?? {
      key: "hello" as const,
      label: "Hello",
      email: "hello@hellocara.ie",
      name: "HelloCara",
    };

  const loadFolder = useCallback(
    async (
      nextFolder: Folder,
      preserveSelection = false,
      silent = false,
    ) => {
      if (!silent) {
        setLoadingList(true);
        setError(null);
      }
      try {
        const data = await apiJson<{ messages: EmailListItem[] }>(
          `/api/admin/inbox?folder=${nextFolder}&identity=${identityKey}`,
        );
        setMessages(data.messages);
        if (
          !preserveSelection ||
          !selectedId ||
          !data.messages.some((message) => message.id === selectedId)
        ) {
          const nextId = data.messages[0]?.id ?? null;
          setSelectedId(nextId);
          if (!nextId) setSelected(null);
        }
      } catch (loadError) {
        if (!silent) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load inbox.",
          );
        }
      } finally {
        if (!silent) setLoadingList(false);
      }
    },
    [identityKey, selectedId],
  );

  const refreshDeliveryStatus = useCallback(async (id: string) => {
    try {
      const delivery = await apiJson<{
        ok: true;
        status: DeliveryStatus;
        statusAt: string | null;
      }>(`/api/admin/inbox/${encodeURIComponent(id)}/delivery`, {
        method: "POST",
      });

      setSelected((current) =>
        current?.id === id
          ? {
              ...current,
              deliveryStatus: delivery.status,
              deliveryStatusAt: delivery.statusAt,
            }
          : current,
      );
      setMessages((current) =>
        current.map((message) =>
          message.id === id
            ? {
                ...message,
                deliveryStatus: delivery.status,
                deliveryStatusAt: delivery.statusAt,
              }
            : message,
        ),
      );
    } catch {
      // Keep the last known state visible if the live status check fails.
    }
  }, []);

  const loadMessage = useCallback(async (id: string) => {
    const requestId = ++messageRequestRef.current;
    const cached = messageCacheRef.current.get(id);

    if (cached && cached.direction !== "outbound") {
      setSelected(cached);
      setMessageView(cached.htmlBody ? "formatted" : "plain");
      setLoadingMessage(false);
      return;
    }

    setLoadingMessage(true);
    setSelected(null);
    setError(null);

    try {
      const data = await apiJson<{ message: EmailMessage }>(
        `/api/admin/inbox/${encodeURIComponent(id)}`,
      );
      if (requestId !== messageRequestRef.current) return;

      const openedAt =
        data.message.direction === "inbound" && !data.message.readAt
          ? new Date().toISOString()
          : data.message.readAt;
      const openedMessage = { ...data.message, readAt: openedAt };

      if (openedMessage.direction !== "outbound") {
        messageCacheRef.current.set(id, openedMessage);
        if (messageCacheRef.current.size > 30) {
          const oldest = messageCacheRef.current.keys().next().value as
            | string
            | undefined;
          if (oldest) messageCacheRef.current.delete(oldest);
        }
      }

      setSelected(openedMessage);
      setMessageView(openedMessage.htmlBody ? "formatted" : "plain");
      setMessages((current) =>
        current.map((message) =>
          message.id === id
            ? {
                ...message,
                readAt: openedAt,
                preview: openedMessage.preview || message.preview,
              }
            : message,
        ),
      );

      if (data.message.direction === "outbound") {
        void refreshDeliveryStatus(id);
      }

      if (data.message.direction === "inbound" && !data.message.readAt) {
        void apiJson<{ ok: true }>(
          `/api/admin/inbox/${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ read: true }),
          },
        ).catch(() => {
          // Reading the message should never wait on the read-receipt write.
        });
      }
    } catch (loadError) {
      if (requestId !== messageRequestRef.current) return;
      setError(
        loadError instanceof Error ? loadError.message : "Could not open email.",
      );
    } finally {
      if (requestId === messageRequestRef.current) {
        setLoadingMessage(false);
      }
    }
  }, [refreshDeliveryStatus]);

  useEffect(() => {
    void loadFolder(folder);
  }, [folder, identityKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedId && !composing) void loadMessage(selectedId);
  }, [selectedId, composing, loadMessage]);

  useEffect(() => {
    if (folder !== "inbox" && folder !== "sent") return;

    const refreshFolder = () => {
      if (document.visibilityState !== "visible") return;

      void loadFolder(folder, true, true);

      if (folder === "sent" && selectedId && !composing) {
        // Refresh only the delivery/open state. Never remount the email body.
        void refreshDeliveryStatus(selectedId);
      }
    };

    const timer = window.setInterval(refreshFolder, 5_000);
    window.addEventListener("focus", refreshFolder);
    document.addEventListener("visibilitychange", refreshFolder);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshFolder);
      document.removeEventListener("visibilitychange", refreshFolder);
    };
  }, [
    folder,
    selectedId,
    composing,
    loadFolder,
    refreshDeliveryStatus,
  ]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return messages;
    return messages.filter((message) =>
      [
        message.fromAddress,
        message.fromName ?? "",
        message.subject,
        message.preview,
        message.toAddresses.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [messages, query]);

  const unreadCount = useMemo(
    () => messages.filter((message) => !message.readAt).length,
    [messages],
  );

  const checkGrammar = async (target: GrammarTarget) => {
    const draft = target === "reply" ? reply : composeBody;
    if (!draft.trim()) return;

    setCheckingGrammar(target);
    setError(null);
    setNotice(null);
    try {
      const data = await apiJson<{
        ok: true;
        suggested: string;
        changed: boolean;
      }>("/api/admin/inbox/grammar", {
        method: "POST",
        body: JSON.stringify({ text: draft }),
      });

      if (target === "reply") {
        setReply(data.suggested);
      } else {
        setComposeBody(data.suggested);
      }
      setNotice(
        data.changed
          ? "Grammar corrected. Review it before sending."
          : "No grammar issues found.",
      );
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "AI grammar check failed.",
      );
    } finally {
      setCheckingGrammar(null);
    }
  };

  const sendReply = async () => {
    if (!selected || selected.direction !== "inbound" || !reply.trim()) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      await apiJson<{ ok: true; id: string }>(
        `/api/admin/inbox/${encodeURIComponent(selected.id)}/reply`,
        {
          method: "POST",
          body: JSON.stringify({ text: reply }),
        },
      );
      setReply("");
      setNotice("Reply sent.");
      messageCacheRef.current.delete(selected.id);
      await loadMessage(selected.id);
      await loadFolder(folder, true, true);
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Could not send reply.",
      );
    } finally {
      setSending(false);
    }
  };

  const sendNewEmail = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      setError("Add a recipient, subject and message before sending.");
      return;
    }

    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiJson<{ ok: true; id: string }>(
        "/api/admin/inbox/send",
        {
          method: "POST",
          body: JSON.stringify({
            to: composeTo,
            subject: composeSubject,
            text: composeBody,
            identity: identityKey,
          }),
        },
      );

      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      setComposing(false);
      setFolder("sent");
      setSelectedId(data.id);
      setNotice("Email sent.");
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Could not send email.",
      );
    } finally {
      setSending(false);
    }
  };

  const updateSelectedState = async (change: {
    read?: boolean;
    archived?: boolean;
  }) => {
    if (!selected) return;
    setChangingState(true);
    setError(null);
    setNotice(null);
    try {
      await apiJson<{ ok: true }>(
        `/api/admin/inbox/${encodeURIComponent(selected.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(change),
        },
      );
      messageCacheRef.current.delete(selected.id);
      await loadFolder(folder);
    } catch (stateError) {
      setError(
        stateError instanceof Error
          ? stateError.message
          : "Could not update email.",
      );
    } finally {
      setChangingState(false);
    }
  };

  const updateSenderBlocked = async () => {
    if (!selected || selected.direction !== "inbound") return;

    const block = !selected.senderBlocked;
    if (
      block &&
      !window.confirm(
        `Block ${selected.fromAddress}? Future emails from this exact address will go straight to Archived.`,
      )
    ) {
      return;
    }

    setChangingState(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiJson<{
        ok: true;
        senderEmail: string | null;
      }>(`/api/admin/inbox/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ blocked: block }),
      });

      setNotice(
        block
          ? `${data.senderEmail || selected.fromAddress} blocked. Future mail from this address will go to Archived.`
          : `${data.senderEmail || selected.fromAddress} unblocked.`,
      );
      messageCacheRef.current.clear();

      if (block && folder === "inbox") {
        await loadFolder("inbox");
      } else {
        await loadMessage(selected.id);
        await loadFolder(folder, true, true);
      }
    } catch (stateError) {
      setError(
        stateError instanceof Error
          ? stateError.message
          : "Could not update blocked sender.",
      );
    } finally {
      setChangingState(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <aside className="flex w-[22rem] min-w-[19rem] shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="shrink-0 border-b border-slate-100 p-3">
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            {identities.map((identity) => (
              <button
                key={identity.key}
                type="button"
                onClick={() => {
                  setIdentityKey(identity.key);
                  setFolder("inbox");
                  setComposing(false);
                  setSelected(null);
                  setSelectedId(null);
                  setReply("");
                  setNotice(null);
                  setError(null);
                }}
                className={cn(
                  "min-w-0 cursor-pointer rounded-md px-2.5 py-2 text-left transition-colors",
                  identity.key === identityKey
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-900",
                )}
              >
                <span className="block text-xs font-semibold">
                  {identity.label}
                </span>
                <span className="mt-0.5 block truncate text-[10px]">
                  {identity.email}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setComposing(true);
              setSelectedId(null);
              setSelected(null);
              setReply("");
              setError(null);
              setNotice(null);
            }}
            className={cn(
              adminPrimaryButtonClass,
              "mb-3 w-full justify-center py-2",
            )}
          >
            <Plus className="size-3.5" aria-hidden />
            New email
          </button>

          <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
            {FOLDERS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setFolder(value);
                  setComposing(false);
                  setSelected(null);
                  setSelectedId(null);
                  setReply("");
                  setNotice(null);
                }}
                className={cn(
                  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  folder === value && !composing
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-900",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>

          <div className="relative mt-3">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search email…"
              className="w-full rounded-md border border-slate-200 bg-white py-2 pr-3 pl-8 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80"
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              {folder === "inbox" && unreadCount > 0
                ? `${unreadCount} unread · `
                : ""}
              {messages.length} message{messages.length === 1 ? "" : "s"}
              {folder === "inbox" ? " · Live" : ""}
            </span>
            <button
              type="button"
              disabled={loadingList}
              onClick={() => void loadFolder(folder, true)}
              className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={cn("size-3", loadingList && "animate-spin")}
                aria-hidden
              />
              Refresh
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingList && messages.length === 0 ? (
            <div className="flex items-center gap-2 p-5 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading mail…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              {query.trim()
                ? "No email matches that search."
                : folder === "sent"
                  ? "No sent email yet."
                  : folder === "archived"
                    ? "No archived email."
                    : "No received email yet."}
            </div>
          ) : (
            filtered.map((message) => {
              const active = selectedId === message.id && !composing;
              const unread = message.direction === "inbound" && !message.readAt;
              return (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => {
                    setComposing(false);
                    setSelectedId(message.id);
                    setReply("");
                    setNotice(null);
                  }}
                  className={cn(
                    "relative block w-full cursor-pointer border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50",
                    active && "bg-slate-100 hover:bg-slate-100",
                  )}
                >
                  {unread ? (
                    <span
                      className="absolute top-4 left-1.5 size-1.5 rounded-full bg-slate-900"
                      aria-label="Unread"
                    />
                  ) : null}
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-sm text-slate-900",
                        unread ? "font-semibold" : "font-medium",
                      )}
                    >
                      {folder === "sent"
                        ? message.toAddresses[0] || "Recipient"
                        : displaySender(message)}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                      {whenLabel(message.occurredAt)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-2">
                    <p
                      className={cn(
                        "min-w-0 flex-1 truncate text-xs text-slate-700",
                        unread && "font-medium text-slate-900",
                      )}
                    >
                      {message.subject || "(no subject)"}
                    </p>
                    {folder === "sent" ? (
                      <DeliveryStatusBadge
                        status={message.deliveryStatus}
                        compact
                      />
                    ) : null}
                  </div>
                  {message.preview ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-500">
                      {message.preview}
                    </p>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-white">
        {error ? (
          <div
            className="shrink-0 border-b border-red-100 bg-red-50 px-5 py-2.5 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        ) : null}
        {notice ? (
          <div
            className="shrink-0 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-sm text-slate-700"
            role="status"
          >
            {notice}
          </div>
        ) : null}

        {composing ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  New email
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  From {activeIdentity.name} &lt;{activeIdentity.email}&gt;
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComposing(false)}
                className={cn(adminSecondaryButtonClass, "px-2.5")}
              >
                <X className="size-3.5" aria-hidden />
                Close
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="mx-auto max-w-4xl space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-700">
                    To
                  </span>
                  <input
                    type="email"
                    value={composeTo}
                    onChange={(event) => setComposeTo(event.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-700">
                    Subject
                  </span>
                  <input
                    type="text"
                    value={composeSubject}
                    onChange={(event) => setComposeSubject(event.target.value)}
                    maxLength={500}
                    placeholder="Email subject"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-700">
                    Message
                  </span>
                  <textarea
                    value={composeBody}
                    onChange={(event) => setComposeBody(event.target.value)}
                    maxLength={20_000}
                    rows={14}
                    placeholder="Write your email…"
                    className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80"
                  />
                </label>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
              <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={
                    checkingGrammar !== null || sending || !composeBody.trim()
                  }
                  onClick={() => void checkGrammar("compose")}
                  className={adminSecondaryButtonClass}
                  title="Only correct spelling, grammar and punctuation"
                >
                  {checkingGrammar === "compose" ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-3.5" aria-hidden />
                  )}
                  {checkingGrammar === "compose"
                    ? "Checking…"
                    : "Check grammar"}
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400">
                    {composeBody.length.toLocaleString()}/20,000
                  </span>
                  <button
                    type="button"
                    disabled={
                      sending ||
                      !composeTo.trim() ||
                      !composeSubject.trim() ||
                      !composeBody.trim()
                    }
                    onClick={() => void sendNewEmail()}
                    className={adminPrimaryButtonClass}
                  >
                    {sending ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Send className="size-3.5" aria-hidden />
                    )}
                    {sending ? "Sending…" : "Send email"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : !selectedId ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center">
            <div>
              <Mail className="mx-auto size-7 text-slate-300" aria-hidden />
              <p className="mt-3 text-sm font-medium text-slate-700">
                Select an email or start a new one
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Inbox mail updates automatically while this tab is open.
              </p>
            </div>
          </div>
        ) : loadingMessage && !selected ? (
          <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Opening email…
          </div>
        ) : selected ? (
          <>
            <header className="shrink-0 border-b border-slate-100 px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-semibold text-slate-950">
                    {selected.subject || "(no subject)"}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>
                      <strong className="font-medium text-slate-700">
                        {selected.direction === "inbound" ? "From" : "To"}:
                      </strong>{" "}
                      {selected.direction === "inbound"
                        ? selected.fromName
                          ? `${selected.fromName} <${selected.fromAddress}>`
                          : selected.fromAddress
                        : selected.toAddresses.join(", ")}
                    </span>
                    <span>{fullWhenLabel(selected.occurredAt)}</span>
                  </div>
                  {selected.direction === "inbound" ? (
                    <p className="mt-1 text-[11px] text-slate-400">
                      To {selected.toAddresses.join(", ") || activeIdentity.email}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">
                      From {selected.fromName || activeIdentity.name} &lt;
                      {selected.fromAddress || activeIdentity.email}&gt;
                    </p>
                  )}
                </div>

                {selected.direction === "inbound" ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={changingState}
                      onClick={() =>
                        void updateSelectedState({ read: !selected.readAt })
                      }
                      className={adminSecondaryButtonClass}
                    >
                      {selected.readAt ? (
                        <Mail className="size-3.5" aria-hidden />
                      ) : (
                        <MailOpen className="size-3.5" aria-hidden />
                      )}
                      {selected.readAt ? "Mark unread" : "Mark read"}
                    </button>
                    <button
                      type="button"
                      disabled={changingState}
                      onClick={() => void updateSenderBlocked()}
                      className={cn(
                        adminSecondaryButtonClass,
                        selected.senderBlocked
                          ? "text-slate-700"
                          : "text-red-700 hover:border-red-200 hover:bg-red-50 hover:text-red-800",
                      )}
                    >
                      <Ban className="size-3.5" aria-hidden />
                      {selected.senderBlocked ? "Unblock sender" : "Block sender"}
                    </button>
                    <button
                      type="button"
                      disabled={
                        changingState ||
                        (selected.senderBlocked && Boolean(selected.archivedAt))
                      }
                      title={
                        selected.senderBlocked && selected.archivedAt
                          ? "Unblock this sender before restoring the email"
                          : undefined
                      }
                      onClick={() =>
                        void updateSelectedState({
                          archived: !selected.archivedAt,
                        })
                      }
                      className={adminSecondaryButtonClass}
                    >
                      {selected.archivedAt ? (
                        <ArchiveRestore className="size-3.5" aria-hidden />
                      ) : (
                        <Archive className="size-3.5" aria-hidden />
                      )}
                      {selected.archivedAt ? "Restore" : "Archive"}
                    </button>
                  </div>
                ) : null}
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/50">
              <article className="mx-auto max-w-4xl px-6 py-6">
                {selected.direction === "outbound" ? (
                  <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="grid grid-cols-3 divide-x divide-slate-100">
                      {deliveryStages(selected).map((stage) => (
                        <div
                          key={stage.label}
                          className="flex items-center justify-center gap-2 px-4 py-3.5"
                        >
                          <span
                            className={cn(
                              "inline-flex size-5 shrink-0 items-center justify-center rounded-full border",
                              stage.complete
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-300 bg-white text-transparent",
                            )}
                          >
                            <CheckCircle2 className="size-3.5" aria-hidden />
                          </span>
                          <span
                            className={cn(
                              "text-xs font-medium",
                              stage.complete
                                ? "text-slate-800"
                                : "text-slate-400",
                            )}
                          >
                            {stage.label}
                          </span>
                        </div>
                      ))}
                    </div>
                    {deliveryFailed(selected.deliveryStatus) ? (
                      <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-center text-[11px] font-medium text-red-700">
                        This email was not delivered successfully.
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="mb-3 flex min-h-9 items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Message
                  </p>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
                    <button
                      type="button"
                      disabled={!selected.htmlBody}
                      onClick={() => setMessageView("formatted")}
                      className={cn(
                        "cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                        selected.htmlBody && messageView === "formatted"
                          ? "bg-white text-slate-950 shadow-sm"
                          : "text-slate-500 hover:text-slate-900",
                      )}
                    >
                      Formatted
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessageView("plain")}
                      className={cn(
                        "cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                        messageView === "plain" || !selected.htmlBody
                          ? "bg-white text-slate-950 shadow-sm"
                          : "text-slate-500 hover:text-slate-900",
                      )}
                    >
                      Plain text
                    </button>
                  </div>
                </div>

                <div className="min-h-[360px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  {selected.htmlBody && messageView === "formatted" ? (
                    <div className="p-4">
                      <div className="overflow-hidden rounded-lg bg-white">
                        <EmailHtmlFrame
                          html={selected.htmlBody}
                          stripOpenTrackingPixel={
                            selected.direction === "outbound"
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap break-words p-6 text-[14px] leading-6 text-slate-800">
                      {selected.textBody}
                    </div>
                  )}
                </div>

                {selected.attachments.length > 0 ? (
                  <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-700">
                      {selected.attachments.length} attachment
                      {selected.attachments.length === 1 ? "" : "s"}
                    </p>
                    <div className="mt-2 space-y-1">
                      {selected.attachments.map((attachment, index) => (
                        <p
                          key={String(attachment.id ?? index)}
                          className="truncate text-xs text-slate-500"
                        >
                          {String(
                            attachment.filename ??
                              attachment.name ??
                              `Attachment ${index + 1}`,
                          )}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selected.replies.length > 0 ? (
                  <div className="mt-8 border-t border-slate-200 pt-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Replies from HelloCara
                    </p>
                    <div className="mt-3 space-y-3">
                      {selected.replies.map((sent) => (
                        <div
                          key={sent.id}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                            <span>
                              {sent.fromName || activeIdentity.name} &lt;
                              {sent.fromAddress || activeIdentity.email}&gt; →{" "}
                              {sent.toAddresses[0] || "recipient"}
                            </span>
                            <span className="shrink-0">
                              {fullWhenLabel(sent.occurredAt)}
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                            {sent.preview}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            </div>

            {selected.direction === "inbound" && !selected.archivedAt ? (
              <div className="shrink-0 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
                <div className="mx-auto max-w-4xl">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-slate-700">
                      Reply as {activeIdentity.name} &lt;{activeIdentity.email}&gt;
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {reply.length.toLocaleString()}/20,000
                    </span>
                  </div>
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    maxLength={20_000}
                    rows={4}
                    placeholder="Write a reply…"
                    className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={
                        checkingGrammar !== null || sending || !reply.trim()
                      }
                      onClick={() => void checkGrammar("reply")}
                      className={adminSecondaryButtonClass}
                      title="Only correct spelling, grammar and punctuation"
                    >
                      {checkingGrammar === "reply" ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Sparkles className="size-3.5" aria-hidden />
                      )}
                      {checkingGrammar === "reply"
                        ? "Checking…"
                        : "Check grammar"}
                    </button>
                    <button
                      type="button"
                      disabled={sending || !reply.trim()}
                      onClick={() => void sendReply()}
                      className={adminPrimaryButtonClass}
                    >
                      {sending ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Send className="size-3.5" aria-hidden />
                      )}
                      {sending ? "Sending…" : "Send reply"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
