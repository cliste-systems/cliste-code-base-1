import { cn } from "@/lib/utils";

type ThreadMessage = {
  id: string;
  author_kind: string;
  body: string;
  created_at: string;
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function rowMeta(
  authorKind: string,
  perspective: "salon" | "admin"
): { isYou: boolean; label: string } {
  if (perspective === "salon") {
    return authorKind === "salon"
      ? { isYou: true, label: "You" }
      : { isYou: false, label: "Cliste" };
  }
  return authorKind === "admin"
    ? { isYou: true, label: "You" }
    : { isYou: false, label: "Salon" };
}

type SupportThreadMessagesProps = {
  openedAt: string;
  initialBody: string;
  messages: ThreadMessage[];
  perspective: "salon" | "admin";
};

export function SupportThreadMessages({
  openedAt,
  initialBody,
  messages,
  perspective,
}: SupportThreadMessagesProps) {
  const thread: {
    key: string;
    author_kind: string;
    body: string;
    created_at: string;
  }[] = [
    {
      key: "initial",
      author_kind: "salon",
      body: initialBody,
      created_at: openedAt,
    },
    ...messages.map((m) => ({
      key: m.id,
      author_kind: m.author_kind,
      body: m.body,
      created_at: m.created_at,
    })),
  ];

  return (
    <div
      className="flex flex-col gap-3 px-1 py-1 sm:px-2 sm:py-2"
      role="log"
      aria-label="Conversation"
    >
      {thread.map((m) => {
        const { isYou, label } = rowMeta(m.author_kind, perspective);
        return (
          <div
            key={m.key}
            className={cn("flex w-full", isYou ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "flex max-w-[85%] flex-col gap-1",
                isYou ? "items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words",
                  isYou
                    ? "bg-primary/10 text-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                {m.body}
              </div>
              <span
                className={cn(
                  "text-muted-foreground max-w-full px-1 text-[0.65rem] leading-tight break-words",
                  isYou ? "text-right" : "text-left"
                )}
              >
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground/80"> · </span>
                <time dateTime={m.created_at} className="tabular-nums">
                  {formatTimestamp(m.created_at)}
                </time>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
