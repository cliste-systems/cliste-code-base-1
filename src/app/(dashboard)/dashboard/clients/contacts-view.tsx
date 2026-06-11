"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Inbox,
  Mail,
  MessageSquare,
  Phone,
  Search,
  User,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_ICON_CHIP_MD,
  DASHBOARD_ICON_GLYPH_SM,
  DASHBOARD_SELECT_CLASS,
} from "@/components/dashboard/dashboard-surface";
import {
  DetailActionButton,
  DetailInset,
  DetailPanelBody,
  DetailPanelFooter,
  DetailPanelShell,
  DetailSection,
  ListDetailLayout,
} from "@/components/dashboard/list-detail";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { categoryStatusVariant } from "../action-inbox/categories";
import { normalizeContactEmail } from "../action-inbox/action-inbox-helpers";
import {
  CONTACT_FILTER_OPTIONS,
  contactSummary,
  copyContactDetailsText,
  hasContactEmail,
  initialsFor,
  matchesContactFilter,
  matchesContactSearch,
  summaryPreview,
  type ContactFilter,
  type ContactFollowUp,
  type ContactListItem,
  type ContactsMetrics,
} from "./contacts-helpers";

type ContactsViewProps = {
  contacts: ContactListItem[];
  metrics: ContactsMetrics;
  className?: string;
};

export function ContactsView({ contacts, metrics: _metrics, className }: ContactsViewProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ContactFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    return contacts.filter(
      (c) => matchesContactSearch(c, search) && matchesContactFilter(c, filter),
    );
  }, [contacts, search, filter]);

  const resolvedSelectedId = useMemo(() => {
    if (selectedId && filtered.some((c) => c.id === selectedId)) return selectedId;
    return filtered[0]?.id ?? null;
  }, [selectedId, filtered]);

  const selected = useMemo(
    () => filtered.find((c) => c.id === resolvedSelectedId) ?? null,
    [filtered, resolvedSelectedId],
  );

  const copyDetails = useCallback(async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(copyContactDetailsText(selected));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [selected]);

  const recentCalls = selected?.calls.slice(0, 5) ?? [];
  const tel =
    selected?.phoneRaw && selected.phoneRaw.replace(/[^\d+]/g, "")
      ? `tel:${selected.phoneRaw.replace(/[^\d+]/g, "")}`
      : null;
  const sms = tel;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3 overflow-hidden", className)}>
      <section
        className={cn(
          DASHBOARD_CARD_SURFACE,
          "flex min-h-0 flex-1 flex-col overflow-hidden",
        )}
      >
        <ListDetailLayout
          className="min-h-0 flex-1 gap-0 max-xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.2fr)_400px]"
          list={
            <div className="flex h-full min-h-0 flex-col overflow-hidden border-slate-100 bg-white max-xl:border-b xl:border-r">
              <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
                <p className="min-w-0 flex-1 text-[13px] font-medium text-[#0b1220]">
                  Directory
                </p>
                <div className="relative w-44 shrink-0">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <Input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search contacts"
                    aria-label="Search contacts"
                    className="h-9 w-full border-slate-300 bg-white py-1 pl-8 text-[13px] placeholder:text-slate-400"
                  />
                </div>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as ContactFilter)}
                  aria-label="Filter contacts"
                  className={cn(DASHBOARD_SELECT_CLASS, "h-9 w-[10.5rem] shrink-0")}
                >
                  {CONTACT_FILTER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2 sm:px-3">
                {contacts.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No contacts yet"
                    description="When Cara answers calls, contacts appear here. Saved clients from bookings show up too."
                    className="min-h-[12rem]"
                  />
                ) : filtered.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No matches"
                    description="Try a different search or filter."
                    className="min-h-[12rem]"
                  />
                ) : (
                  <ul className="divide-y divide-slate-100" role="listbox" aria-label="Contacts">
                    {filtered.map((row) => (
                      <ContactListRow
                        key={row.id}
                        row={row}
                        selected={row.id === resolvedSelectedId}
                        onSelect={() => setSelectedId(row.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          }
          detail={
            <ContactDetailPanel
              contact={selected}
              recentCalls={recentCalls}
              copied={copied}
              onCopyDetails={copyDetails}
              tel={tel}
              sms={sms}
            />
          }
        />
      </section>
    </div>
  );
}

function FollowUpPill({ action }: { action: ContactFollowUp }) {
  return (
    <StatusPill
      variant={categoryStatusVariant(action.category)}
      className="h-5 shrink-0 px-1.5 py-0 text-[10px] leading-none"
    >
      {action.categoryShort}
    </StatusPill>
  );
}

function ContactListRow({
  row,
  selected,
  onSelect,
}: {
  row: ContactListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const initials = initialsFor(row.displayName);
  const preview =
    row.lastSummaryPreview ?? summaryPreview(row.openActions[0]?.summary, 96);

  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onSelect}
        className={cn(
          "grid w-full cursor-pointer grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-x-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors",
          "hover:bg-slate-50/90",
          selected && "bg-slate-100/80",
        )}
      >
        <span
          className={cn(
            "mt-0.5 text-[11px] font-semibold",
            DASHBOARD_ICON_CHIP_MD,
          )}
        >
          {initials ? (
            <span aria-hidden>{initials}</span>
          ) : (
            <Phone className={DASHBOARD_ICON_GLYPH_SM} aria-hidden />
          )}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            {row.openFollowUps > 0 ? (
              <StatusPill variant="info" className="h-5 px-1.5 py-0 text-[10px] leading-none">
                {row.openFollowUps === 1
                  ? "1 follow-up"
                  : `${row.openFollowUps} follow-ups`}
              </StatusPill>
            ) : null}
            <span className="min-w-0 truncate text-[13px] font-semibold leading-snug text-[#0b1220]">
              {row.displayName}
            </span>
          </span>
          {preview ? (
            <span className="mt-1 line-clamp-1 text-[12px] leading-snug text-slate-600">
              {preview}
            </span>
          ) : null}
          <span className="mt-1 block truncate text-[11px] text-slate-500 tabular-nums">
            {row.phoneDisplay || "Unknown"}
            {row.callCount > 0 ? (
              <>
                <span className="text-slate-300"> · </span>
                {row.callCount} {row.callCount === 1 ? "call" : "calls"}
                <span className="text-slate-300"> · </span>
                Last {row.lastCallLabel}
              </>
            ) : (
              <>
                <span className="text-slate-300"> · </span>
                Saved client · no calls yet
              </>
            )}
          </span>
        </span>
        {row.lastOutcomeLabel && row.callCount > 0 ? (
          <StatusPill className="mt-0.5 hidden h-5 shrink-0 px-1.5 py-0 text-[10px] leading-none sm:inline-flex">
            {row.lastOutcomeLabel}
          </StatusPill>
        ) : null}
      </button>
    </li>
  );
}

function ContactBlock({ contact }: { contact: ContactListItem }) {
  const hasPhone = contact.phoneRaw.trim().length > 0;
  const tel = hasPhone ? `tel:${contact.phoneRaw.replace(/[^\d+]/g, "")}` : null;
  const email = normalizeContactEmail(contact.contactEmail);
  const mailto = email ? `mailto:${email}` : null;

  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold tracking-[0.06em] text-slate-500 uppercase">
        Contact
      </p>
      <dl className="mt-1.5 space-y-1.5 text-[13px]">
        <div className="flex gap-2">
          <dt className="w-12 shrink-0 text-slate-500">Phone</dt>
          <dd className="min-w-0 font-medium text-[#0b1220] tabular-nums">
            {hasPhone && tel ? (
              <a href={tel} className="underline-offset-2 hover:underline">
                {contact.phoneDisplay}
              </a>
            ) : (
              <span className="font-normal text-slate-500">Not on file</span>
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-12 shrink-0 text-slate-500">Email</dt>
          <dd className="min-w-0">
            {email ? (
              <a
                href={mailto!}
                className="truncate font-medium text-[#0b1220] underline-offset-2 hover:underline"
              >
                {email}
              </a>
            ) : (
              <span className="text-slate-500">
                Not on file
                <span className="sr-only"> — no email saved for this contact</span>
              </span>
            )}
          </dd>
        </div>
      </dl>
      {!hasContactEmail(contact) ? (
        <p className="mt-2 text-[12px] leading-snug text-slate-500">
          Email is optional — many callers only share a phone number.
        </p>
      ) : null}
    </div>
  );
}

function ContactDetailPanel({
  contact,
  recentCalls,
  copied,
  onCopyDetails,
  tel,
  sms,
}: {
  contact: ContactListItem | null;
  recentCalls: ContactListItem["calls"];
  copied: boolean;
  onCopyDetails: () => void;
  tel: string | null;
  sms: string | null;
}) {
  if (!contact) {
    return (
      <DetailPanelShell surface="embedded">
        <EmptyState
          icon={User}
          title="Select a contact"
          description="Choose someone from the directory to see how to reach them, their calls, and open follow-ups."
          className="min-h-0 flex-1"
        />
      </DetailPanelShell>
    );
  }

  const summary = contactSummary(contact);
  const email = normalizeContactEmail(contact.contactEmail);
  const mailto = email ? `mailto:${email}` : null;

  return (
    <DetailPanelShell surface="embedded">
      <div className="shrink-0 border-b border-slate-100 bg-white px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          {contact.openFollowUps > 0 ? (
            <StatusPill variant="info" dot>
              {contact.openFollowUps === 1
                ? "1 open follow-up"
                : `${contact.openFollowUps} open follow-ups`}
            </StatusPill>
          ) : (
            <StatusPill variant="success">No open follow-ups</StatusPill>
          )}
          {contact.callCount > 0 && contact.lastOutcomeLabel ? (
            <StatusPill>{contact.lastOutcomeLabel}</StatusPill>
          ) : null}
        </div>
        <h2 className="mt-2.5 text-[18px] font-semibold leading-snug tracking-tight text-[#0b1220]">
          {contact.displayName}
        </h2>
        <p className="mt-1 text-[12px] text-slate-500 tabular-nums">
          {contact.callCount > 0 ? (
            <>
              {contact.callCount} {contact.callCount === 1 ? "call" : "calls"}
              <span className="text-slate-300"> · </span>
              Last call {contact.lastCallLabel}
            </>
          ) : (
            <>Saved client · no calls recorded yet</>
          )}
        </p>
        <ContactBlock contact={contact} />
      </div>

      <DetailPanelBody>
        {contact.openActions.length > 0 ? (
          <DetailSection title="Open follow-ups">
            <ul className="space-y-2">
              {contact.openActions.map((action) => (
                <li key={action.id}>
                  <DetailInset>
                    <div className="flex flex-wrap items-center gap-2">
                      <FollowUpPill action={action} />
                      <StatusPill variant="info" dot className="h-5 px-1.5 py-0 text-[10px]">
                        Open
                      </StatusPill>
                    </div>
                    <p className="mt-2 text-[13px] font-medium leading-relaxed text-slate-800">
                      {action.categoryTitle}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-700">
                      {action.summary}
                    </p>
                    <p className="mt-1 text-[12px] text-slate-500">{action.createdAtLabel}</p>
                  </DetailInset>
                </li>
              ))}
            </ul>
            <Link
              href={DASHBOARD_ROUTES.actionInbox}
              className="mt-3 inline-flex text-[13px] font-medium text-[#0b1220] underline-offset-2 hover:underline"
            >
              Open in Action Inbox
            </Link>
          </DetailSection>
        ) : null}

        {summary ? (
          <DetailSection title="Latest from Cara">
            <p className="text-[14px] leading-relaxed text-slate-800">{summary}</p>
          </DetailSection>
        ) : null}

        {contact.clientNotes ? (
          <DetailSection title="Client notes">
            <p className="text-[14px] leading-relaxed text-slate-700">{contact.clientNotes}</p>
          </DetailSection>
        ) : null}

        <DetailSection title="Recent calls">
          {recentCalls.length === 0 ? (
            <p className="text-[13px] text-slate-500">No calls on file yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentCalls.map((call) => (
                <li key={call.id}>
                  <DetailInset>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12px] font-medium text-slate-600">
                        {call.dateTimeLabel}
                      </p>
                      <StatusPill>{call.outcomeLabel}</StatusPill>
                    </div>
                    <p className="mt-1 text-[12px] tabular-nums text-slate-500">
                      {call.durationLabel}
                    </p>
                    {call.summary ? (
                      <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-slate-700">
                        {call.summary}
                      </p>
                    ) : (
                      <p className="mt-1 text-[13px] text-slate-500">No summary available.</p>
                    )}
                    <Link
                      href={`${DASHBOARD_ROUTES.calls}?call=${call.id}`}
                      className="mt-2 inline-flex text-[12px] font-medium text-[#0b1220] underline-offset-2 hover:underline"
                    >
                      View call
                    </Link>
                  </DetailInset>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={DASHBOARD_ROUTES.calls}
            className="mt-3 inline-flex text-[13px] font-medium text-[#0b1220] underline-offset-2 hover:underline"
          >
            View all calls
          </Link>
        </DetailSection>
      </DetailPanelBody>

      <DetailPanelFooter>
        {contact.openActions.length > 0 ? (
          <DetailActionButton href={DASHBOARD_ROUTES.actionInbox}>
            <Inbox className="size-3.5" aria-hidden />
            Action inbox
          </DetailActionButton>
        ) : null}
        <DetailActionButton href={DASHBOARD_ROUTES.calls}>View calls</DetailActionButton>
        <DetailActionButton type="button" onClick={onCopyDetails}>
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? "Copied" : "Copy details"}
        </DetailActionButton>
        {tel ? (
          <DetailActionButton href={tel}>
            <Phone className="size-3.5" aria-hidden />
            Call
          </DetailActionButton>
        ) : null}
        {sms ? (
          <DetailActionButton href={sms}>
            <MessageSquare className="size-3.5" aria-hidden />
            Text
          </DetailActionButton>
        ) : null}
        {mailto ? (
          <DetailActionButton href={mailto}>
            <Mail className="size-3.5" aria-hidden />
            Email
          </DetailActionButton>
        ) : null}
      </DetailPanelFooter>
    </DetailPanelShell>
  );
}
