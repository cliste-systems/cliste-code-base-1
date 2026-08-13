"use client";

import { useCallback, useMemo, useState, useTransition, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  CalendarCheck,
  Check,
  CheckCircle2,
  CircleHelp,
  Copy,
  Inbox,
  Mail,
  MessageSquare,
  Phone,
  PhoneCall,
  PhoneForwarded,
  Search,
  ShoppingBag,
  Siren,
} from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_ICON_CHIP_LG,
  DASHBOARD_ICON_CHIP_SM,
  DASHBOARD_ICON_GLYPH_LG,
  DASHBOARD_ICON_GLYPH_SM,
  DASHBOARD_SELECT_CLASS,
} from "@/components/dashboard/dashboard-surface";
import {
  DetailActionButton,
  DetailPanelBody,
  DetailPanelShell,
  DetailSection,
  ListDetailLayout,
} from "@/components/dashboard/list-detail";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ANONYMOUS_CALLER_E164,
  normalizeBlockedCallerE164,
} from "@/lib/blocked-callers";

import { blockCallerAndDismissTicket } from "../settings/blocked-numbers-actions";
import { markTicketReopen, markTicketResolved } from "./actions";
import { useDashboardVertical } from "../dashboard-vertical-context";
import {
  actionCategoryFilterOptions,
  categoryStatusVariant,
  type ActionCategory,
  type ActionCategoryFilter,
} from "./categories";
import {
  copyDetailsText,
  hasContactEmail,
  hasKnownCallerName,
  inboxCallerMetaLine,
  inboxListSummaryPreview,
  normalizeContactEmail,
  parseStructuredCaptureSummary,
  type ActionInboxItem,
  type ActionInboxMetrics,
  matchesActionSearch,
  matchesCategoryFilter,
  nextStepForCategory,
} from "./action-inbox-helpers";

const CATEGORY_ICONS: Record<ActionCategory, ComponentType<{ className?: string }>> = {
  booking_request: CalendarCheck,
  callback: PhoneForwarded,
  urgent: Siren,
  confirm: CheckCircle2,
  quote: MessageSquare,
  lead: ShoppingBag,
  complaint: AlertTriangle,
  unclear: CircleHelp,
  failed: PhoneCall,
  follow_up: Inbox,
};

type StatusTab = "open" | "resolved";

type ActionInboxViewProps = {
  items: ActionInboxItem[];
  metrics: ActionInboxMetrics;
  initialSelectedTicketId?: string | null;
  blockedCallerE164s: string[];
  className?: string;
};

export function ActionInboxView({
  items,
  metrics: _metrics,
  initialSelectedTicketId = null,
  blockedCallerE164s,
  className,
}: ActionInboxViewProps) {
  const router = useRouter();
  const { copy } = useDashboardVertical();
  const categoryFilterOptions = useMemo(
    () => actionCategoryFilterOptions(copy.actionInbox.categoryLabels),
    [copy.actionInbox.categoryLabels],
  );
  const [statusTab, setStatusTab] = useState<StatusTab>(() => {
    if (
      initialSelectedTicketId &&
      items.some(
        (i) => i.id === initialSelectedTicketId && i.status === "open",
      )
    ) {
      return "open";
    }
    return items.some((i) => i.status === "open") ? "open" : "resolved";
  });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ActionCategoryFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedTicketId,
  );
  const [copied, setCopied] = useState(false);

  const openCount = items.filter((i) => i.status === "open").length;
  const resolvedCount = items.filter((i) => i.status === "resolved").length;

  const tabItems = useMemo(
    () => items.filter((i) => i.status === statusTab),
    [items, statusTab],
  );

  const filtered = useMemo(() => {
    return tabItems.filter(
      (i) => matchesActionSearch(i, search) && matchesCategoryFilter(i, categoryFilter),
    );
  }, [tabItems, search, categoryFilter]);

  const resolvedSelectedId = useMemo(() => {
    if (selectedId && filtered.some((i) => i.id === selectedId)) return selectedId;
    return filtered[0]?.id ?? null;
  }, [selectedId, filtered]);

  const selected = useMemo(
    () => filtered.find((i) => i.id === resolvedSelectedId) ?? null,
    [filtered, resolvedSelectedId],
  );

  const copyDetails = useCallback(async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(copyDetailsText(selected));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [selected]);

  const isOpenQueue = statusTab === "open";

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3 overflow-hidden", className)}>
      <div
        className="inline-flex w-full max-w-md shrink-0 rounded-lg border border-[#d9e2dd] bg-[#fbfcfb] p-0.5"
        role="tablist"
        aria-label="Inbox status"
      >
        {(
          [
            { id: "open" as const, label: "Open", count: openCount },
            { id: "resolved" as const, label: "Resolved", count: resolvedCount },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={statusTab === tab.id}
            onClick={() => setStatusTab(tab.id)}
            className={cn(
              "min-w-0 flex-1 rounded-md px-4 py-2 text-[13px] font-medium transition-colors",
              statusTab === tab.id
                ? "bg-[#11181d] text-white shadow-sm"
                : "text-[#5b6b65] hover:bg-white hover:text-[#11181d]",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "ml-1.5 tabular-nums",
                statusTab === tab.id ? "text-white/80" : "text-slate-400",
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <section
        className={cn(
          DASHBOARD_CARD_SURFACE,
          "flex min-h-0 flex-1 flex-col overflow-hidden",
        )}
      >
        <ListDetailLayout
          className="min-h-0 flex-1 gap-0 max-xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(400px,460px)]"
          list={
            <div
              className={cn(
                "flex h-full min-h-0 flex-col overflow-hidden max-xl:border-b max-xl:border-[#dfe7e2] xl:border-r",
                "border-[#dfe7e2] bg-[#fbfcfb] xl:border-r-[#dfe7e2]",
              )}
            >
              <div className="flex shrink-0 flex-col gap-2 border-b border-inherit px-4 py-3 sm:px-5">
                <p className="min-w-0 flex-1 text-[13px] font-semibold text-[#11181d]">
                  {isOpenQueue ? "Work queue" : "Archive"}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative w-full shrink-0 sm:w-44">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400"
                      aria-hidden
                    />
                    <Input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search inbox"
                      aria-label="Search inbox"
                      className="h-9 w-full border-[#b9c8c1] bg-white py-1 pl-8 text-[13px] placeholder:text-slate-400"
                    />
                  </div>
                  <select
                    value={categoryFilter}
                    onChange={(e) =>
                      setCategoryFilter(e.target.value as ActionCategoryFilter)
                    }
                    aria-label="Filter by type"
                    className={cn(DASHBOARD_SELECT_CLASS, "h-9 w-full shrink-0 sm:w-[10.5rem]")}
                  >
                    {categoryFilterOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2 sm:px-3",
                  filtered.length === 0 && "flex items-center justify-center",
                )}
              >
                {filtered.length === 0 ? (
                  <EmptyState
                    icon={statusTab === "open" ? CheckCircle2 : Inbox}
                    title={statusTab === "open" ? "Inbox zero" : "Nothing resolved yet"}
                    description={
                      statusTab === "open"
                        ? "When Cara captures something that needs you, it will appear here."
                        : "Completed follow-ups will appear here."
                    }
                    className="w-full py-10"
                  />
                ) : (
                  <ul className="space-y-2" role="listbox" aria-label="Inbox items">
                    {filtered.map((row) => (
                      <ActionListRow
                        key={row.id}
                        row={row}
                        selected={row.id === resolvedSelectedId}
                        onSelect={() => setSelectedId(row.id)}
                        tinted={isOpenQueue}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          }
          detail={
            <ActionDetailPanel
              item={selected}
              copied={copied}
              onCopyDetails={copyDetails}
              blockedCallerE164s={blockedCallerE164s}
              onRefresh={() => router.refresh()}
            />
          }
        />
      </section>
    </div>
  );
}

function inboxPrimaryLabel(row: ActionInboxItem): string {
  if (hasKnownCallerName(row)) return row.callerName;
  return row.callerDisplay || "Unknown caller";
}

function CategoryPill({
  category,
  label,
  className,
}: {
  category: ActionCategory;
  label: string;
  className?: string;
}) {
  return (
    <StatusPill variant={categoryStatusVariant(category)} className={className}>
      {label}
    </StatusPill>
  );
}

function ActionListRow({
  row,
  selected,
  onSelect,
  tinted,
}: {
  row: ActionInboxItem;
  selected: boolean;
  onSelect: () => void;
  tinted: boolean;
}) {
  const Icon = CATEGORY_ICONS[row.category] ?? Inbox;
  const primary = inboxPrimaryLabel(row);
  const preview = inboxListSummaryPreview(row.summary);

  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className={cn(
          "grid w-full cursor-pointer grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-x-2.5 rounded-lg border bg-white/78 px-2.5 py-2.5 text-left shadow-[0_1px_0_rgba(17,24,29,0.04)] transition-colors sm:grid-cols-[1.75rem_minmax(0,1fr)_auto]",
          tinted
            ? "border-[#cfd9d4] hover:border-[#9da9a4] hover:bg-white"
            : "border-[#dfe7e2] hover:border-[#9da9a4] hover:bg-white",
          selected &&
            "border-[#353D42] bg-white shadow-[inset_3px_0_0_#353D42,0_1px_0_rgba(17,24,29,0.04)]",
        )}
      >
        <span className={cn("mt-0.5", DASHBOARD_ICON_CHIP_SM)} aria-hidden>
          <Icon className={DASHBOARD_ICON_GLYPH_SM} />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <CategoryPill
              category={row.category}
              label={row.categoryShort}
              className="h-5 shrink-0 px-1.5 py-0 text-[10px] font-semibold uppercase leading-none tracking-wide"
            />
            <span className="min-w-0 truncate text-[13px] font-semibold leading-snug text-[#0b1220]">
              {primary}
            </span>
          </span>
          <span className="mt-1 line-clamp-1 text-[12px] leading-snug text-slate-600">
            {preview}
          </span>
          <span className="mt-1 block truncate text-[11px] text-slate-500 tabular-nums">
            {inboxCallerMetaLine(row)}
          </span>
        </span>
        <span className="mt-0.5 hidden shrink-0 text-right text-[11px] leading-none tabular-nums text-slate-400 sm:block">
          {row.status === "open" ? "Open" : "Done"}
        </span>
      </button>
    </li>
  );
}

function ActionDetailPanel({
  item,
  copied,
  onCopyDetails,
  blockedCallerE164s,
  onRefresh,
}: {
  item: ActionInboxItem | null;
  copied: boolean;
  onCopyDetails: () => void;
  blockedCallerE164s: string[];
  onRefresh: () => void;
}) {
  if (!item) {
    return (
      <DetailPanelShell surface="embedded">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <EmptyState
            icon={Inbox}
            title="Select a follow-up"
            description="Pick an item from the queue to see details, the caller, and what to do next."
            className="w-full py-10"
          />
        </div>
      </DetailPanelShell>
    );
  }

  return (
    <ActionDetailPanelContent
      key={item.id}
      item={item}
      copied={copied}
      onCopyDetails={onCopyDetails}
      blockedCallerE164s={blockedCallerE164s}
      onRefresh={onRefresh}
    />
  );
}

function ActionDetailPanelContent({
  item,
  copied,
  onCopyDetails,
  blockedCallerE164s,
  onRefresh,
}: {
  item: ActionInboxItem;
  copied: boolean;
  onCopyDetails: () => void;
  blockedCallerE164s: string[];
  onRefresh: () => void;
}) {
  const Icon = CATEGORY_ICONS[item.category] ?? Inbox;
  const hasPhone = item.callerNumber.trim().length > 0;
  const tel = hasPhone ? `tel:${item.callerNumber.replace(/[^\d+]/g, "")}` : null;
  const sms = hasPhone ? `sms:${item.callerNumber.replace(/[^\d+]/g, "")}` : null;
  const email = normalizeContactEmail(item.contactEmail);
  const mailto = email ? `mailto:${email}` : null;
  const primary = inboxPrimaryLabel(item);
  const isOpen = item.status === "open";
  const summaryText = item.summary.trim();
  const structuredCapture = parseStructuredCaptureSummary(summaryText);
  const callerE164 = normalizeBlockedCallerE164(item.callerNumber);
  const canBlockAndDismiss =
    isOpen &&
    callerE164 != null &&
    item.callerNumber.trim() !== ANONYMOUS_CALLER_E164 &&
    !blockedCallerE164s.includes(callerE164);
  const [blockDismissOpen, setBlockDismissOpen] = useState(false);
  const [blockMsg, setBlockMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onBlockAndDismiss() {
    if (!callerE164) return;
    setBlockMsg(null);
    startTransition(async () => {
      const result = await blockCallerAndDismissTicket({
        ticketId: item.id,
        phone: callerE164,
      });
      setBlockDismissOpen(false);
      if (!result.ok) {
        setBlockMsg(result.message);
        return;
      }
      onRefresh();
    });
  }

  return (
    <DetailPanelShell surface="embedded">
      <div
        className={cn(
          "shrink-0 border-b px-5 py-5",
          isOpen ? "border-[#cfd9d4] bg-[#fbfcfb]" : "border-[#dfe7e2] bg-[#fbfcfb]",
        )}
      >
        <div className="flex items-start gap-3">
          <span className={DASHBOARD_ICON_CHIP_LG}>
            <Icon className={DASHBOARD_ICON_GLYPH_LG} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryPill
                category={item.category}
                label={item.categoryTitle}
                className="h-6 px-2 text-[11px] font-semibold uppercase tracking-wide"
              />
              <StatusPill variant={isOpen ? "brand" : "success"} dot>
                {isOpen ? "Open" : "Resolved"}
              </StatusPill>
            </div>
            <h2 className="mt-2.5 text-[18px] font-semibold leading-snug tracking-tight text-[#0b1220]">
              {primary}
            </h2>
            <p className="mt-1 text-[12px] text-slate-500 tabular-nums">
              {inboxCallerMetaLine(item)}
            </p>
          </div>
        </div>
      </div>

      <DetailPanelBody>
        <DetailSection title="What Cara captured">
          {structuredCapture ? (
            <div className="space-y-3">
              <p className="text-[14px] font-medium text-slate-800">
                {structuredCapture.header}
              </p>
              <dl className="space-y-2.5">
                {structuredCapture.fields.map((field) => (
                  <div key={field.label} className="flex flex-wrap items-start gap-x-2 gap-y-1">
                    <dt className="text-[13px] font-medium text-slate-600">
                      {field.label}
                    </dt>
                    <dd className="flex min-w-0 flex-wrap items-center gap-2 text-[14px] text-slate-800">
                      <span>{field.value}</span>
                      {field.unconfirmed ? (
                        <StatusPill variant="attention" dot>
                          Unconfirmed
                        </StatusPill>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="text-[14px] leading-relaxed text-slate-800">
              {summaryText || "No additional details were captured for this item."}
            </p>
          )}
        </DetailSection>

        <DetailSection title="Contact">
          <div className="rounded-lg border border-[#d9e2dd] bg-white px-4 py-3">
            <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-400">
                  Phone
                </dt>
                <dd className="mt-0.5 min-w-0 font-medium text-[#0b1220] tabular-nums">
                  {hasPhone && tel ? (
                    <a href={tel} className="underline-offset-2 hover:underline">
                      {item.callerDisplay}
                    </a>
                  ) : (
                    <span className="font-normal text-slate-500">Not on file</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-slate-400">
                  Email
                </dt>
                <dd className="mt-0.5 min-w-0">
                  {email ? (
                    <a
                      href={mailto!}
                      className="block truncate font-medium text-[#0b1220] underline-offset-2 hover:underline"
                    >
                      {email}
                    </a>
                  ) : (
                    <span className="text-slate-500">
                      Not on file
                      <span className="sr-only"> — caller did not leave an email</span>
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            {!hasContactEmail(item) ? (
              <p className="mt-2 text-[12px] leading-snug text-slate-500">
                Callers often share phone only. Use call or text below, or check Contacts if you have saved details.
              </p>
            ) : null}
          </div>
        </DetailSection>

        <DetailSection title="Next step">
          <p className="text-[14px] font-medium text-slate-800">
            {nextStepForCategory(item.category)}
          </p>
        </DetailSection>

        <DetailSection title="Actions">
          <div className="flex flex-wrap gap-2">
            {canBlockAndDismiss ? (
              <DetailActionButton
                type="button"
                onClick={() => setBlockDismissOpen(true)}
                disabled={pending}
              >
                <Ban className="size-3.5" aria-hidden />
                Block + dismiss
              </DetailActionButton>
            ) : null}
            {item.status === "open" ? (
              <form action={markTicketResolved}>
                <input type="hidden" name="ticketId" value={item.id} />
                <DetailActionButton type="submit">Mark resolved</DetailActionButton>
              </form>
            ) : (
              <form action={markTicketReopen}>
                <input type="hidden" name="ticketId" value={item.id} />
                <DetailActionButton type="submit">Reopen</DetailActionButton>
              </form>
            )}
            <DetailActionButton type="button" onClick={onCopyDetails}>
              {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              {copied ? "Copied" : "Copy details"}
            </DetailActionButton>
            {tel ? (
              <DetailActionButton href={tel}>
                <Phone className="size-3.5" aria-hidden />
                Call back
              </DetailActionButton>
            ) : null}
            {sms ? (
              <DetailActionButton href={sms}>
                <MessageSquare className="size-3.5" aria-hidden />
                Text contact
              </DetailActionButton>
            ) : null}
            {mailto ? (
              <DetailActionButton href={mailto}>
                <Mail className="size-3.5" aria-hidden />
                Email
              </DetailActionButton>
            ) : null}
            <DetailActionButton href={DASHBOARD_ROUTES.contacts}>
              Open contact
            </DetailActionButton>
          </div>
          {blockMsg ? (
            <p className="mt-2 text-[12px] text-red-600">{blockMsg}</p>
          ) : null}
        </DetailSection>
      </DetailPanelBody>

      <ConfirmDialog
        open={blockDismissOpen}
        onOpenChange={setBlockDismissOpen}
        title="Block caller and dismiss?"
        description="This number will be blocked from future calls and this follow-up will be marked resolved."
        confirmLabel="Block + dismiss"
        onConfirm={onBlockAndDismiss}
        pending={pending}
        destructive
      />
    </DetailPanelShell>
  );
}
