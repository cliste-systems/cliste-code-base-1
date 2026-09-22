"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";

import {
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-interactive";
import { cn } from "@/lib/utils";

type Folder = "inbox" | "archived" | "sent";

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
};

type EmailMessage = EmailListItem & {
  messageId: string | null;
  replyToAddresses: string[];
  ccAddresses: string[];
  textBody: string;
  attachments: Array<Record<string, unknown>>;
  replies: EmailListItem[];
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
  fromAddress,
}: {
  fromAddress: string;
}) {
  const [folder, setFolder] = useState<Folder>("inbox");
  const [messages, setMessages] = useState<EmailListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<EmailMessage | null>(null);
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [sending, setSending] = useState(false);
  const [changingState, setChangingState] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFolder = useCallback(
    async (nextFolder: Folder, preserveSelection = false) => {
      setLoadingList(true);
      setError(null);
      try {
        const data = await apiJson<{ messages: EmailListItem[] }>(
          `/api/admin/inbox?folder=${nextFolder}`,
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
        setError(
          loadError instanceof Error ? loadError.message : "Could not load inbox.",
        );
      } finally {
        setLoadingList(false);
      }
    },
    [selectedId],
  );

  const loadMessage = useCallback(async (id: string) => {
    setLoadingMessage(true);
    setError(null);
    try {
      const data = await apiJson<{ message: EmailMessage }>(
        `/api/admin/inbox/${encodeURIComponent(id)}`,
      );
      setSelected(data.message);
      setMessages((current) =>
        current.map((message) =>
          message.id === id
            ? {
                ...message,
                readAt: data.message.readAt ?? new Date().toISOString(),
                preview: data.message.preview || message.preview,
              }
            : message,
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not open email.",
      );
    } finally {
      setLoadingMessage(false);
    }
  }, []);

  useEffect(() => {
    void loadFolder(folder);
  }, [folder]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedId) void loadMessage(selectedId);
  }, [selectedId, loadMessage]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadFolder(folder, true);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [folder, loadFolder]);

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

  const sendReply = async () => {
    if (!selected || selected.direction !== "inbound" || !reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      await apiJson<{ ok: true; id: string }>(
        `/api/admin/inbox/${encodeURIComponent(selected.id)}/reply`,
        {
          method: "POST",
          body: JSON.stringify({ text: reply }),
        },
      );
      setReply("");
      await loadMessage(selected.id);
      await loadFolder(folder, true);
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Could not send reply.",
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
    try {
      await apiJson<{ ok: true }>(
        `/api/admin/inbox/${encodeURIComponent(selected.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(change),
        },
      );
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

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <aside className="flex w-[22rem] min-w-[19rem] shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="shrink-0 border-b border-slate-100 p-3">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
            {FOLDERS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setFolder(value);
                  setSelected(null);
                  setSelectedId(null);
                  setReply("");
                }}
                className={cn(
                  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  folder === value
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
                  ? "No replies sent from the admin inbox yet."
                  : folder === "archived"
                    ? "No archived email."
                    : "No received email yet."}
            </div>
          ) : (
            filtered.map((message) => {
              const active = selectedId === message.id;
              const unread = message.direction === "inbound" && !message.readAt;
              return (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(message.id);
                    setReply("");
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
                  <p
                    className={cn(
                      "mt-0.5 truncate text-xs text-slate-700",
                      unread && "font-medium text-slate-900",
                    )}
                  >
                    {message.subject || "(no subject)"}
                  </p>
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

        {!selectedId ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center">
            <div>
              <Mail className="mx-auto size-7 text-slate-300" aria-hidden />
              <p className="mt-3 text-sm font-medium text-slate-700">
                Select an email
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Incoming email is treated as untrusted content and never runs
                admin actions automatically.
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
                      To {selected.toAddresses.join(", ") || "brendan@hellocara.ie"}
                    </p>
                  ) : null}
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

            <div className="min-h-0 flex-1 overflow-y-auto">
              <article className="mx-auto max-w-4xl px-6 py-6">
                <div className="whitespace-pre-wrap break-words text-[14px] leading-6 text-slate-800">
                  {selected.textBody}
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
                              Brendan &lt;{fromAddress}&gt; →{" "}
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
                      Reply as Brendan &lt;{fromAddress}&gt;
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
                  <div className="mt-2 flex justify-end">
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
