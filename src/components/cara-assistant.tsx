"use client";

import {
  ArrowUp,
  ChevronDown,
  MessageSquarePlus,
  RefreshCw,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { stripChatMarkdownDisplay } from "@/lib/cara-chat-display";
import {
  playCaraMessageReceivedSound,
  playCaraMessageSentSound,
} from "@/lib/cara-chat-sounds";
import { CARA_WELCOME_MESSAGE, type CaraChatMessage } from "@/lib/cara-chat-stub";
import { cn } from "@/lib/utils";

type ConversationListItem = {
  id: string;
  title: string | null;
  updated_at: string;
};

type CaraPendingAction = {
  id: string;
  kind: "cancel_appointment";
  label: string;
};

type DeleteChatsDialogState =
  | { kind: "closed" }
  | { kind: "one"; conversationId: string; label: string }
  | { kind: "all" };

function formatConvLabel(c: ConversationListItem): string {
  if (c.title?.trim()) return c.title.trim();
  const d = new Date(c.updated_at);
  if (Number.isNaN(d.getTime())) return "Cara chat";
  return `Cara chat · ${d.toLocaleString("en-IE", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
}

/** So fast replies still show “thinking” after your line lands. */
const CARA_MIN_TYPING_MS = 480;

const CARA_THINKING_FALLBACK = [
  "Cara is thinking…",
  "Working on your question…",
  "Almost there…",
] as const;

/** Short rotating copy while typing — matched to the user’s last message (no extra API). */
function getThinkingLines(userMessage: string): readonly string[] {
  const q = userMessage.trim().toLowerCase();
  if (!q) return CARA_THINKING_FALLBACK;

  if (
    /\b(cancel|unbook|resched|rebook|booking|bookings|appointment|appointments|diary|calendar|slot|availability|free time)\b/.test(
      q,
    ) ||
    /\b(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(
      q,
    )
  ) {
    return [
      "Cara is thinking…",
      "Scanning the diary and bookings…",
      "Almost there…",
    ] as const;
  }

  if (
    /\b(revenue|sales|money|€|eur|income|earnings|profit|margin|takings)\b/.test(
      q,
    ) ||
    /\b(how (busy|quiet)|metrics|stats|numbers|performance)\b/.test(q) ||
    /\b(last week|this week|yesterday)\b/.test(q)
  ) {
    return [
      "Cara is thinking…",
      "Crunching salon numbers…",
      "Almost there…",
    ] as const;
  }

  if (/\b(call|calls|phone|voice|transcript|voicemail)\b/.test(q)) {
    return [
      "Cara is thinking…",
      "Reviewing recent call activity…",
      "Almost there…",
    ] as const;
  }

  if (/\b(client|clients|customer|customers|guest|regulars?)\b/.test(q)) {
    return [
      "Cara is thinking…",
      "Pulling client context…",
      "Almost there…",
    ] as const;
  }

  if (
    /\b(service|services|menu|price|pricing|treat|treatment|colour|color|cut|blow|mani|pedi)\b/.test(
      q,
    )
  ) {
    return [
      "Cara is thinking…",
      "Checking services and pricing…",
      "Almost there…",
    ] as const;
  }

  if (
    /\b(hour|hours|open|close|address|location|settings|business|staff|team)\b/.test(
      q,
    )
  ) {
    return [
      "Cara is thinking…",
      "Matching your salon setup…",
      "Almost there…",
    ] as const;
  }

  if (/\b(storefront|book online|booking link|website)\b/.test(q)) {
    return [
      "Cara is thinking…",
      "Looking at your storefront…",
      "Almost there…",
    ] as const;
  }

  if (/\b(help|how do i|how to|what('?s| is)|explain|tips?)\b/.test(q)) {
    return [
      "Cara is thinking…",
      "Finding the clearest explanation…",
      "Almost there…",
    ] as const;
  }

  return CARA_THINKING_FALLBACK;
}

async function ensureMinElapsedSince(startedAt: number, minMs: number) {
  const elapsed = Date.now() - startedAt;
  if (elapsed < minMs) {
    await new Promise((r) => setTimeout(r, minMs - elapsed));
  }
}

export function CaraAssistant() {
  const [open, setOpen] = useState(false);
  /** Collapse the past-chats list (delete / switch threads) to save vertical space. */
  const [pastConversationsOpen, setPastConversationsOpen] = useState(true);
  const [messages, setMessages] = useState<CaraChatMessage[]>([
    CARA_WELCOME_MESSAGE,
  ]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    [],
  );
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [loadErrorDetail, setLoadErrorDetail] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  /** Message that triggered the current typing state — drives thinking-line copy. */
  const [thinkingUserText, setThinkingUserText] = useState("");
  const [thinkingLineIdx, setThinkingLineIdx] = useState(0);
  const [pendingAction, setPendingAction] = useState<CaraPendingAction | null>(
    null,
  );
  const [actionBusy, setActionBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteChatsDialog, setDeleteChatsDialog] =
    useState<DeleteChatsDialogState>({ kind: "closed" });
  /** Shown for delete / chat actions without putting the whole panel in load error. */
  const [chatActionError, setChatActionError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const abortRef = useRef<AbortController | null>(null);

  /** Snap after layout — smooth scroll fights height changes when replies land. */
  const scrollToBottom = useCallback(() => {
    const run = () => {
      const el = listRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const thinkingLines = useMemo(
    () => getThinkingLines(thinkingUserText),
    [thinkingUserText],
  );

  useEffect(() => {
    if (!isTyping) {
      setThinkingLineIdx(0);
      return;
    }
    setThinkingLineIdx(0);
    const len = thinkingLines.length;
    const id = window.setInterval(() => {
      setThinkingLineIdx((i) => (i + 1) % len);
    }, 2600);
    return () => window.clearInterval(id);
  }, [isTyping, thinkingLines]);

  const refreshConversations = useCallback(async () => {
    const res = await fetch("/api/dashboard/cara/conversations");
    if (!res.ok) return;
    const data = (await res.json()) as {
      conversations?: ConversationListItem[];
    };
    setConversations(data.conversations ?? []);
  }, []);

  const hydrateFromServer = useCallback(async () => {
    setLoadState("loading");
    setLoadErrorDetail(null);
    setChatActionError(null);
    try {
      const [mRes, cRes] = await Promise.all([
        fetch("/api/dashboard/cara/messages"),
        fetch("/api/dashboard/cara/conversations"),
      ]);

      if (!mRes.ok) {
        const j = (await mRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        setLoadErrorDetail(
          j?.error ??
            (mRes.status === 503
              ? "Chat history is not available on this database yet."
              : `Could not load chats (${mRes.status}).`),
        );
        setMessages([CARA_WELCOME_MESSAGE]);
        setConversationId(null);
        setPendingAction(null);
        setConversations([]);
        setLoadState("error");
        return;
      }

      const mData = (await mRes.json()) as {
        conversationId: string;
        messages: CaraChatMessage[];
      };
      const cData = cRes.ok
        ? ((await cRes.json()) as {
            conversations?: ConversationListItem[];
          })
        : { conversations: [] };

      setMessages(
        mData.messages?.length ? mData.messages : [CARA_WELCOME_MESSAGE],
      );
      setConversationId(mData.conversationId);
      setPendingAction(null);
      setConversations(cData.conversations ?? []);
      setLoadState("idle");
    } catch {
      setLoadErrorDetail((prev) =>
        prev ??
        "Could not reach the server. Check your connection and try again.",
      );
      setMessages([CARA_WELCOME_MESSAGE]);
      setConversationId(null);
      setPendingAction(null);
      setConversations([]);
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void hydrateFromServer();
  }, [open, hydrateFromServer]);

  const switchConversation = useCallback(
    async (id: string) => {
      if (!id || isTyping) return;
      setLoadState("loading");
      setLoadErrorDetail(null);
      setChatActionError(null);
      try {
        const res = await fetch(
          `/api/dashboard/cara/messages?conversationId=${encodeURIComponent(id)}`,
        );
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          setLoadErrorDetail(
            j?.error ?? `Could not open this chat (${res.status}).`,
          );
          setLoadState("error");
          return;
        }
        const mData = (await res.json()) as {
          conversationId: string;
          messages: CaraChatMessage[];
        };
        setMessages(
          mData.messages?.length ? mData.messages : [CARA_WELCOME_MESSAGE],
        );
        setConversationId(mData.conversationId);
        setPendingAction(null);
        setLoadState("idle");
        await refreshConversations();
      } catch {
        setLoadErrorDetail("Could not switch chats. Try again.");
        setLoadState("error");
      }
    },
    [isTyping, refreshConversations],
  );

  const startNewChat = useCallback(async () => {
    setLoadState("loading");
    setLoadErrorDetail(null);
    setChatActionError(null);
    try {
      const res = await fetch("/api/dashboard/cara/conversations", {
        method: "POST",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setLoadErrorDetail(j?.error ?? "Could not start a new chat.");
        setLoadState("error");
        return;
      }
      const data = (await res.json()) as {
        conversationId: string;
        messages: CaraChatMessage[];
      };
      setMessages(data.messages);
      setConversationId(data.conversationId);
      setPendingAction(null);
      setLoadState("idle");
      await refreshConversations();
    } catch {
      setLoadErrorDetail("Could not start a new chat. Try again.");
      setLoadState("error");
    }
  }, [refreshConversations]);

  const applyDeleteResponse = useCallback(
    (data: {
      conversations?: ConversationListItem[];
      conversationId?: string;
      messages?: CaraChatMessage[];
    }) => {
      setChatActionError(null);
      setConversations(data.conversations ?? []);
      if (data.conversationId && data.messages?.length) {
        setConversationId(data.conversationId);
        setMessages(data.messages);
        setPendingAction(null);
      }
    },
    [],
  );

  const requestDeleteOneConversation = useCallback((id: string) => {
    if (isTyping || deleteBusy) return;
    const c = conversations.find((x) => x.id === id);
    const label = c ? formatConvLabel(c) : "this chat";
    setDeleteChatsDialog({ kind: "one", conversationId: id, label });
  }, [conversations, deleteBusy, isTyping]);

  const requestDeleteAllConversations = useCallback(() => {
    if (isTyping || deleteBusy) return;
    setDeleteChatsDialog({ kind: "all" });
  }, [deleteBusy, isTyping]);

  const performDeleteChats = useCallback(
    async (d: Exclude<DeleteChatsDialogState, { kind: "closed" }>) => {
      if (isTyping) return;
      setDeleteBusy(true);
      setChatActionError(null);
      try {
        if (d.kind === "all") {
          const res = await fetch("/api/dashboard/cara/conversations?all=1", {
            method: "DELETE",
          });
          const data = (await res.json().catch(() => null)) as {
            conversations?: ConversationListItem[];
            conversationId?: string;
            messages?: CaraChatMessage[];
            error?: string;
          } | null;
          if (!res.ok) {
            setChatActionError(
              data?.error ?? `Could not delete chats (${res.status}).`,
            );
            return;
          }
          applyDeleteResponse(data ?? {});
          return;
        }

        const params = new URLSearchParams({
          conversationId: d.conversationId,
        });
        if (conversationId) {
          params.set("currentConversationId", conversationId);
        }
        const res = await fetch(
          `/api/dashboard/cara/conversations?${params.toString()}`,
          { method: "DELETE" },
        );
        const data = (await res.json().catch(() => null)) as {
          conversations?: ConversationListItem[];
          conversationId?: string;
          messages?: CaraChatMessage[];
          error?: string;
        } | null;
        if (!res.ok) {
          setChatActionError(
            data?.error ?? `Could not delete that chat (${res.status}).`,
          );
          return;
        }
        applyDeleteResponse(data ?? {});
      } catch {
        setChatActionError(
          d.kind === "all"
            ? "Could not delete chats. Try again."
            : "Could not delete that chat. Try again.",
        );
      } finally {
        setDeleteBusy(false);
      }
    },
    [applyDeleteResponse, conversationId, isTyping],
  );

  const send = useCallback(() => {
    const t = draft.trim();
    if (!t || isTyping || !conversationId || loadState === "loading") return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const optimisticUserId = crypto.randomUUID();
    const startedAt = Date.now();

    setDraft("");
    setPendingAction(null);
    setMessages((prev) => [
      ...prev,
      { id: optimisticUserId, role: "user", text: t },
    ]);
    setThinkingUserText(t);
    setIsTyping(true);
    void playCaraMessageSentSound();

    void (async () => {
      try {
        const res = await fetch("/api/dashboard/cara/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ content: t, conversationId }),
        });

        const data = (await res.json().catch(() => null)) as {
          messages?: CaraChatMessage[];
          error?: string;
          pendingAction?: CaraPendingAction | null;
        } | null;

        await ensureMinElapsedSince(startedAt, CARA_MIN_TYPING_MS);

        if (!res.ok) {
          const err =
            typeof data?.error === "string"
              ? data.error
              : "Something went wrong saving that message.";
          setIsTyping(false);
          setMessages((p) => [
            ...p,
            {
              id: crypto.randomUUID(),
              role: "cara",
              text: err,
            },
          ]);
          void playCaraMessageReceivedSound();
          return;
        }

        setIsTyping(false);
        if (data?.messages?.length) {
          setMessages(data.messages);
          void playCaraMessageReceivedSound();
        }
        const pa = data?.pendingAction;
        setPendingAction(
          pa &&
            typeof pa.id === "string" &&
            pa.kind === "cancel_appointment" &&
            typeof pa.label === "string"
            ? { id: pa.id, kind: pa.kind, label: pa.label }
            : null,
        );
        void refreshConversations();
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          setIsTyping(false);
          setMessages((p) => p.filter((m) => m.id !== optimisticUserId));
          return;
        }
        await ensureMinElapsedSince(startedAt, CARA_MIN_TYPING_MS);
        setIsTyping(false);
        setMessages((p) => [
          ...p,
          {
            id: crypto.randomUUID(),
            role: "cara",
            text: "I couldn’t finish that request—your data is still safe. Try again in a moment.",
          },
        ]);
        void playCaraMessageReceivedSound();
      } finally {
        setIsTyping(false);
      }
    })();
  }, [conversationId, draft, isTyping, loadState, refreshConversations]);

  const actOnPending = useCallback(
    async (confirm: boolean) => {
      if (!pendingAction || actionBusy) return;
      setActionBusy(true);
      try {
        const res = await fetch("/api/dashboard/cara/pending", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pendingActionId: pendingAction.id,
            confirm,
          }),
        });
        const data = (await res.json().catch(() => null)) as {
          messages?: CaraChatMessage[];
          error?: string;
        } | null;
        if (!res.ok) {
          const err =
            typeof data?.error === "string"
              ? data.error
              : "Could not complete that action.";
          setMessages((p) => [
            ...p,
            { id: crypto.randomUUID(), role: "cara", text: err },
          ]);
          void playCaraMessageReceivedSound();
          return;
        }
        if (data?.messages?.length) {
          setMessages(data.messages);
          void playCaraMessageReceivedSound();
        }
        setPendingAction(null);
        await refreshConversations();
      } catch {
        setMessages((p) => [
          ...p,
          {
            id: crypto.randomUUID(),
            role: "cara",
            text: "Something went wrong confirming that. Try again or use Bookings.",
          },
        ]);
        void playCaraMessageReceivedSound();
      } finally {
        setActionBusy(false);
      }
    },
    [pendingAction, actionBusy, refreshConversations],
  );

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-8 right-8 z-50 inline-flex items-center gap-2 rounded-full border border-transparent",
          "bg-gray-900 px-5 py-6 text-base font-medium text-white shadow-lg",
          "hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 focus-visible:outline-none",
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Sparkles className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
        Ask Cara
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          showCloseButton
          className="max-w-md gap-0 border-l border-gray-200/90 bg-[#FAFAFA] p-0 shadow-2xl sm:max-w-md"
        >
          <SheetHeader className="shrink-0 space-y-4 border-b border-gray-200/80 bg-white px-5 pb-5 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="text-xl font-semibold tracking-tight text-gray-900">
                    Ask Cara
                  </SheetTitle>
                  <Badge variant="secondary" className="font-normal">
                    Beta
                  </Badge>
                </div>
                <SheetDescription className="text-[13px] leading-relaxed text-gray-500">
                  Your salon co-pilot—replies use your live Cliste data and stay
                  on business topics (not general chat). Chats sync across visits
                  once the database is set up. Cancels need a tap to confirm.
                </SheetDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 gap-1.5 border-gray-200 bg-white text-xs font-medium text-gray-800 shadow-sm hover:bg-gray-50"
                onClick={() => void startNewChat()}
                disabled={
                  loadState === "loading" || isTyping || deleteBusy
                }
              >
                <MessageSquarePlus className="size-3.5" aria-hidden />
                New chat
              </Button>
            </div>

            {chatActionError ? (
              <p
                className="rounded-lg border border-red-200/90 bg-red-50/90 px-3 py-2 text-[12px] leading-snug text-red-900"
                role="alert"
              >
                {chatActionError}
              </p>
            ) : null}

            {conversations.length > 0 ? (
              <div className="rounded-xl border border-gray-200/90 bg-gray-50/80 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1.5 pr-2 text-left transition-colors hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-gray-900/10 focus-visible:outline-none"
                    aria-expanded={pastConversationsOpen}
                    aria-controls="cara-past-conversations-list"
                    id="cara-past-conversations-toggle"
                    onClick={() =>
                      setPastConversationsOpen((prev) => !prev)
                    }
                  >
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-gray-500 transition-transform duration-200",
                        pastConversationsOpen ? "rotate-0" : "-rotate-90",
                      )}
                      aria-hidden
                    />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Past conversations
                    </span>
                    {!pastConversationsOpen ? (
                      <span className="ml-auto shrink-0 rounded-md bg-gray-200/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-gray-600">
                        {conversations.length}
                      </span>
                    ) : null}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-[11px] font-medium text-gray-500 hover:text-destructive"
                    disabled={
                      loadState === "loading" || isTyping || deleteBusy
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      requestDeleteAllConversations();
                    }}
                  >
                    Delete all
                  </Button>
                </div>
                {pastConversationsOpen ? (
                  <ul
                    id="cara-past-conversations-list"
                    role="listbox"
                    aria-labelledby="cara-past-conversations-toggle"
                    className="max-h-48 space-y-1 overflow-y-auto pr-0.5"
                  >
                    {conversations.map((c) => {
                      const active = conversationId === c.id;
                      return (
                        <li key={c.id} className="flex items-stretch gap-1">
                          <button
                            type="button"
                            role="option"
                            aria-selected={active}
                            className={cn(
                              "min-w-0 flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                              "focus-visible:ring-2 focus-visible:ring-gray-900/10 focus-visible:outline-none",
                              active
                                ? "border-gray-900/90 bg-white text-gray-900 shadow-sm"
                                : "border-gray-200/80 bg-white/70 text-gray-800 hover:bg-white",
                            )}
                            disabled={
                              loadState === "loading" ||
                              isTyping ||
                              deleteBusy
                            }
                            onClick={() => void switchConversation(c.id)}
                          >
                            <span className="line-clamp-2 leading-snug">
                              {formatConvLabel(c)}
                            </span>
                          </button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-lg"
                            className="shrink-0 border-gray-200/90 bg-white text-gray-500 hover:border-destructive/40 hover:bg-red-50 hover:text-destructive"
                            aria-label={`Delete ${formatConvLabel(c)}`}
                            disabled={
                              loadState === "loading" ||
                              isTyping ||
                              deleteBusy
                            }
                            onClick={(e) => {
                              e.preventDefault();
                              requestDeleteOneConversation(c.id);
                            }}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {loadState === "error" && loadErrorDetail ? (
              <Alert className="border-amber-200/90 bg-amber-50/90 text-amber-950 [&>svg]:text-amber-700">
                <TriangleAlert className="size-4 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1 space-y-2">
                  <AlertTitle>Couldn’t load saved chats</AlertTitle>
                  <AlertDescription className="text-amber-900/90">
                    {loadErrorDetail}
                  </AlertDescription>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-amber-300/80 bg-white text-amber-950 hover:bg-amber-100/80"
                    onClick={() => void hydrateFromServer()}
                  >
                    <RefreshCw className="size-3.5" aria-hidden />
                    Retry
                  </Button>
                </div>
              </Alert>
            ) : null}
          </SheetHeader>

          <div
            ref={listRef}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-white/60 to-[#FAFAFA] px-4 py-5 [overflow-anchor:none]"
          >
            {loadState === "loading" ? (
              <div className="space-y-3 px-0.5">
                <div className="h-[4.5rem] animate-pulse rounded-2xl bg-gray-200/70" />
                <div className="ml-10 h-12 animate-pulse rounded-2xl bg-gray-200/50" />
                <div className="h-14 animate-pulse rounded-2xl bg-gray-200/60" />
              </div>
            ) : (
              <>
                {messages.map((m) =>
                  m.role === "cara" ? (
                    <div
                      key={m.id}
                      className="mr-6 max-w-[min(100%,22rem)] rounded-2xl rounded-tl-md border border-gray-200/90 bg-white px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                    >
                      {stripChatMarkdownDisplay(m.text)}
                    </div>
                  ) : (
                    <div
                      key={m.id}
                      className="ml-auto max-w-[min(100%,19rem)] rounded-2xl rounded-tr-md bg-gray-900 px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap text-white shadow-sm"
                    >
                      {stripChatMarkdownDisplay(m.text)}
                    </div>
                  ),
                )}
              </>
            )}
            {isTyping ? (
              <div
                role="status"
                className="mr-6 max-w-[min(100%,22rem)] rounded-2xl rounded-tl-md border border-gray-200/90 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                aria-live="polite"
                aria-busy="true"
                aria-label="Cara is thinking"
              >
                <span className="sr-only">Cara is generating a reply.</span>
                <div className="flex items-start gap-3" aria-hidden>
                  <div className="flex shrink-0 gap-1 pt-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="size-2 rounded-full bg-gray-400/95 motion-safe:animate-bounce"
                        style={{
                          animationDelay: `${i * 150}ms`,
                          animationDuration: "0.7s",
                        }}
                      />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[13px] font-medium leading-snug text-gray-800">
                      {thinkingLines[thinkingLineIdx]}
                    </p>
                    <p className="text-[11px] leading-relaxed text-gray-500">
                      Usually just a moment.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            {pendingAction && !isTyping ? (
              <div
                className="mx-0.5 rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 shadow-sm"
                role="region"
                aria-label="Confirm action"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900/80">
                  {pendingAction.kind === "cancel_appointment"
                    ? "Cancel booking"
                    : "Confirm action"}
                </p>
                <p className="mt-1 text-[13px] leading-snug text-amber-950">
                  {pendingAction.label}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={actionBusy}
                    className="h-9 bg-amber-950 text-white hover:bg-amber-900"
                    onClick={() => void actOnPending(true)}
                  >
                    Confirm cancel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actionBusy}
                    className="h-9 border-amber-300 bg-white text-amber-950 hover:bg-amber-100/80"
                    onClick={() => void actOnPending(false)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <SheetFooter className="shrink-0 border-t border-gray-200/90 bg-white px-4 py-4">
            <form
              className="flex w-full items-end gap-2 rounded-2xl border border-gray-200/90 bg-gray-50/50 p-1.5 pl-3 shadow-inner"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <Input
                id={inputId}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask Cara anything…"
                disabled={isTyping || !conversationId || loadState === "loading"}
                className="h-10 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm text-gray-900 shadow-none placeholder:text-gray-400 focus-visible:ring-0"
                autoComplete="off"
              />
              <Button
                type="submit"
                size="icon"
                disabled={
                  !draft.trim() ||
                  isTyping ||
                  !conversationId ||
                  loadState === "loading"
                }
                className="size-10 shrink-0 rounded-xl bg-gray-900 text-white shadow-sm hover:bg-gray-800 disabled:opacity-45"
                aria-label="Send message"
              >
                <ArrowUp className="size-5" strokeWidth={2} />
              </Button>
            </form>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog
        open={deleteChatsDialog.kind !== "closed"}
        onOpenChange={(next) => {
          if (!next) setDeleteChatsDialog({ kind: "closed" });
        }}
      >
        {deleteChatsDialog.kind !== "closed" ? (
          <DialogContent
            showCloseButton
            overlayClassName="z-[200] bg-black/45 backdrop-blur-[2px]"
            className="z-[201] max-w-[min(100%,22rem)] gap-0 overflow-hidden border-2 border-gray-300/95 bg-white p-0 text-gray-900 shadow-xl ring-1 ring-gray-900/10 sm:max-w-md"
          >
            <DialogHeader className="space-y-3 border-b border-gray-200/90 bg-white px-5 pb-7 pt-5 pr-12">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gray-200/80 bg-gray-50">
                  <Sparkles
                    className="size-[18px] text-gray-800"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </div>
                <div className="min-w-0 space-y-3 pt-0.5">
                  <DialogTitle className="font-heading text-base font-semibold tracking-tight text-gray-900">
                    {deleteChatsDialog.kind === "all"
                      ? "Delete all chats?"
                      : "Delete this chat?"}
                  </DialogTitle>
                  <DialogDescription className="pb-1 text-[13px] leading-relaxed text-gray-600">
                    {deleteChatsDialog.kind === "all" ? (
                      <>
                        This removes every saved Cara conversation for your
                        account. You will start with a fresh chat. This cannot be
                        undone.
                      </>
                    ) : (
                      <>
                        This permanently removes{" "}
                        <span className="font-medium text-gray-900">
                          “{deleteChatsDialog.label}”
                        </span>
                        . This cannot be undone.
                      </>
                    )}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <DialogFooter className="gap-2.5 rounded-none border-t border-gray-200/90 bg-[#FAFAFA] px-5 py-4 pt-5 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                disabled={deleteBusy}
                onClick={() => setDeleteChatsDialog({ kind: "closed" })}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-9"
                disabled={deleteBusy}
                onClick={() => {
                  const d = deleteChatsDialog;
                  setDeleteChatsDialog({ kind: "closed" });
                  if (d.kind === "one" || d.kind === "all") {
                    void performDeleteChats(d);
                  }
                }}
              >
                {deleteBusy
                  ? "Deleting…"
                  : deleteChatsDialog.kind === "all"
                    ? "Delete all"
                    : "Delete chat"}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
