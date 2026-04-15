"use client";

import { useCallback, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { ClientDisplay } from "@/lib/client-types";
import { formatE164ForDisplay } from "@/lib/call-history-types";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ListFilter,
  MoreVertical,
  Phone,
  Plus,
  Search,
  Users,
} from "lucide-react";

import { deleteClient } from "./actions";

type FilterMode = "all" | "no_shows" | "regulars";

function normalizePhone(s: string): string {
  return s.replace(/\s/g, "");
}

function telHref(raw: string): string | null {
  const t = raw.trim();
  if (!t || t === "—") return null;
  let digits = t.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (!digits.startsWith("+")) digits = `+${digits}`;
  return `tel:${digits}`;
}

function ClientPhoneLink({ raw, className }: { raw: string; className?: string }) {
  const display = formatE164ForDisplay(raw.trim() || raw);
  const href = telHref(raw);
  if (!href) {
    return (
      <span className={cn("text-gray-500 tabular-nums", className)}>
        {display === "" || display === "—" ? "—" : display}
      </span>
    );
  }
  return (
    <a
      href={href}
      className={cn(
        "text-gray-900 tabular-nums underline-offset-4 hover:text-gray-700 hover:underline",
        className
      )}
    >
      {display}
    </a>
  );
}

function matchesSearch(client: ClientDisplay, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = client.name.toLowerCase();
  const phone = normalizePhone(client.phone).toLowerCase();
  const qDigits = q.replace(/\s/g, "");
  return name.includes(q) || phone.includes(qDigits);
}

function matchesFilter(client: ClientDisplay, mode: FilterMode): boolean {
  if (mode === "no_shows") return client.noShows > 0;
  if (mode === "regulars") return client.totalBookings >= 4;
  return true;
}

type ClientsViewProps = {
  clients: ClientDisplay[];
  /** When profile query fails, booking-based clients still show. */
  profileLoadError?: string | null;
};

export function ClientsView({
  clients,
  profileLoadError = null,
}: ClientsViewProps) {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [historyClient, setHistoryClient] = useState<ClientDisplay | null>(
    null
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClientDisplay | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  const filtered = useMemo(
    () =>
      clients.filter(
        (c) => matchesSearch(c, search) && matchesFilter(c, filterMode)
      ),
    [clients, search, filterMode]
  );

  const openHistory = useCallback((client: ClientDisplay) => {
    setHistoryClient(client);
    setHistoryOpen(true);
  }, []);

  const handleHistoryOpenChange = useCallback((open: boolean) => {
    setHistoryOpen(open);
    if (!open) setHistoryClient(null);
  }, []);

  const handleDeleteOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setDeleteTarget(null);
      setDeleteError(null);
    }
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteClient(deleteTarget.id);
      if (!result.ok) {
        setDeleteError(result.message);
        return;
      }
      setDeleteTarget(null);
    });
  }, [deleteTarget]);

  const copyPhone = useCallback(async (phone: string) => {
    if (phone === "—" || !phone.trim()) return;
    try {
      await navigator.clipboard.writeText(phone);
    } catch {
      /* ignore */
    }
  }, []);

  const filterLabel =
    filterMode === "all"
      ? "All clients"
      : filterMode === "no_shows"
        ? "Has no-shows"
        : "4+ bookings";

  const viewProfileButton = (client: ClientDisplay) => (
    <button
      type="button"
      onClick={() => openHistory(client)}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
      aria-label={`View profile and history for ${client.name}`}
    >
      <ChevronRight className="size-4" aria-hidden />
    </button>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-8 lg:px-12 lg:py-12">
      <header className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium tracking-widest text-gray-500 uppercase">
          <Users className="size-4 shrink-0 text-gray-400" aria-hidden />
          CRM
        </div>
        <h1 className="mb-2 text-3xl font-medium tracking-tight text-gray-900">
          Clients
        </h1>
        <p className="max-w-2xl text-base text-gray-500">
          Manage your client roster. People who book are listed here, grouped by
          phone number (name comes from their latest booking).
        </p>
        {profileLoadError ? (
          <p className="mt-3 max-w-2xl text-sm text-amber-800" role="status">
            Saved client profiles could not be loaded ({profileLoadError}).
            Showing booking-based contacts only.
          </p>
        ) : null}
      </header>

      <div className="mb-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-auto border-gray-200 bg-white py-2 pl-9 pr-3 text-base placeholder:text-gray-400 focus-visible:border-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900"
            aria-label="Search clients"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-auto gap-2 border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-none hover:bg-gray-50"
              )}
            >
              <ListFilter className="size-4 text-gray-500" aria-hidden />
              {filterLabel}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48" align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Filter clients</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={filterMode}
                  onValueChange={(v) => setFilterMode(v as FilterMode)}
                >
                  <DropdownMenuRadioItem value="all">
                    All clients
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="no_shows">
                    Has no-shows
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="regulars">
                    4+ bookings
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={() => setAddClientOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-gray-900 px-4 py-2 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <Plus className="size-4" aria-hidden />
            Add Client
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {clients.length === 0 ? (
          <div className="mt-2 flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-24 text-center">
            <Users className="mb-4 size-12 text-gray-300" aria-hidden />
            <h3 className="mb-1 text-lg font-medium tracking-tight text-gray-900">
              No clients yet
            </h3>
            <p className="mt-1 max-w-sm text-base text-gray-500">
              When clients book an appointment, their profiles and history will
              appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/80">
                      <th className="px-6 py-4 text-xs font-medium tracking-widest text-gray-500 uppercase">
                        Client
                      </th>
                      <th className="px-6 py-4 text-xs font-medium tracking-widest text-gray-500 uppercase">
                        Phone
                      </th>
                      <th className="px-6 py-4 text-xs font-medium tracking-widest text-gray-500 uppercase">
                        Total bookings
                      </th>
                      <th className="px-6 py-4 text-xs font-medium tracking-widest text-gray-500 uppercase">
                        Last visit
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium tracking-widest text-gray-500 uppercase">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-12 text-center text-sm text-gray-500"
                        >
                          No clients match your search or filter.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((client) => (
                        <tr
                          key={client.id}
                          className="transition-colors hover:bg-gray-50/50"
                        >
                          <td className="max-w-[14rem] truncate px-6 py-4 text-sm font-semibold text-gray-900">
                            {client.name}
                          </td>
                          <td className="px-6 py-4 align-middle text-sm">
                            <ClientPhoneLink raw={client.phone} />
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium tabular-nums text-gray-700">
                              {client.totalBookings}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm tabular-nums text-gray-500">
                            {client.lastVisitLabel}
                          </td>
                          <td className="px-6 py-4 text-right align-middle">
                            <div className="flex items-center justify-end gap-0.5">
                              {viewProfileButton(client)}
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  className={cn(
                                    buttonVariants({
                                      variant: "ghost",
                                      size: "icon-sm",
                                    }),
                                    "size-8 text-gray-400 hover:text-gray-900"
                                  )}
                                  aria-label={`More actions for ${client.name}`}
                                >
                                  <MoreVertical className="size-4" aria-hidden />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => openHistory(client)}
                                  >
                                    View history
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => copyPhone(client.phone)}
                                    disabled={client.phone === "—"}
                                  >
                                    Copy phone number
                                  </DropdownMenuItem>
                                  {client.canDelete !== false ? (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => {
                                          setDeleteError(null);
                                          setDeleteTarget(client);
                                        }}
                                      >
                                        Remove client…
                                      </DropdownMenuItem>
                                    </>
                                  ) : null}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:hidden">
              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-500 shadow-sm">
                  No clients match your search or filter.
                </div>
              ) : (
                filtered.map((client) => (
                  <div
                    key={client.id}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                  >
                    <div className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 flex-1 text-base leading-snug font-semibold text-gray-900">
                          {client.name}
                        </p>
                        <span
                          className="inline-flex shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-700"
                          title="Total bookings"
                        >
                          {client.totalBookings}
                        </span>
                      </div>
                      <div className="space-y-2 border-t border-gray-100 pt-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Phone
                            className="size-4 shrink-0 text-gray-400"
                            aria-hidden
                          />
                          <ClientPhoneLink raw={client.phone} />
                        </div>
                        <p className="pl-6 text-sm tabular-nums text-gray-500">
                          Last visit: {client.lastVisitLabel}
                        </p>
                      </div>
                      <div className="flex items-center justify-end gap-1 border-t border-gray-100 pt-3">
                        {viewProfileButton(client)}
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className={cn(
                              buttonVariants({
                                variant: "ghost",
                                size: "icon-sm",
                              }),
                              "size-8 text-gray-400 hover:text-gray-900"
                            )}
                            aria-label={`More actions for ${client.name}`}
                          >
                            <MoreVertical className="size-4" aria-hidden />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openHistory(client)}
                            >
                              View history
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => copyPhone(client.phone)}
                              disabled={client.phone === "—"}
                            >
                              Copy phone number
                            </DropdownMenuItem>
                            {client.canDelete !== false ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => {
                                    setDeleteError(null);
                                    setDeleteTarget(client);
                                  }}
                                >
                                  Remove client…
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <Dialog open={addClientOpen} onOpenChange={setAddClientOpen}>
        <DialogContent
          className="border border-gray-200/80 bg-white sm:max-w-md"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle className="text-gray-900">Add client</DialogTitle>
            <DialogDescription className="text-gray-600">
              Walk-ins and manual client profiles will be available here soon.
              For now, clients appear when they book through your AI receptionist
              or booking link.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setAddClientOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={handleDeleteOpenChange}
      >
        <DialogContent
          showCloseButton
          className="border border-gray-200/80 bg-white sm:max-w-md"
        >
          {deleteTarget ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-gray-900">Remove client</DialogTitle>
                <DialogDescription className="text-gray-600">
                  This permanently deletes{" "}
                  <span className="font-medium text-gray-900">
                    {deleteTarget.name}
                  </span>
                  ’s login and CRM record. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              {deleteError ? (
                <p className="text-sm text-red-600" role="alert">
                  {deleteError}
                </p>
              ) : null}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  disabled={deletePending}
                  onClick={() => handleDeleteOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deletePending}
                  onClick={confirmDelete}
                >
                  {deletePending ? "Removing…" : "Remove client"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={handleHistoryOpenChange}>
        <DialogContent className="max-h-[min(88vh,640px)] max-w-[calc(100%-2rem)] overflow-hidden border border-gray-200/80 bg-white p-0 sm:max-w-md">
          {historyClient ? (
            <>
              <DialogHeader className="shrink-0 space-y-0 border-b border-gray-200 px-6 py-4 text-left">
                <DialogTitle className="text-gray-900">Client profile</DialogTitle>
                <DialogDescription className="sr-only">
                  Appointment history for {historyClient.name}.
                </DialogDescription>
              </DialogHeader>
              <div className="border-b border-gray-200 px-6 py-3">
                <p className="text-base font-semibold text-gray-900">
                  {historyClient.name}
                </p>
                <div className="mt-1 text-sm">
                  <ClientPhoneLink raw={historyClient.phone} />
                </div>
              </div>
              <div className="px-6 py-4">
                <p className="mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Past appointments
                </p>
                <div className="max-h-[50vh] overflow-y-auto">
                  {historyClient.history.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No past visits on file yet.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {historyClient.history.map((appt) => (
                        <li
                          key={appt.id}
                          className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5"
                        >
                          <p className="text-xs font-medium tabular-nums text-gray-500">
                            {appt.dateLabel}
                          </p>
                          <p className="text-sm font-medium text-gray-900">
                            {appt.service}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
