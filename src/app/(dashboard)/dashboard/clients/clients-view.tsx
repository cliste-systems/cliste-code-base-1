"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ClientDisplay } from "@/lib/client-types";
import { formatE164ForDisplay } from "@/lib/call-history-types";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ChevronRight,
  ListFilter,
  Loader2,
  MoreVertical,
  Phone,
  Plus,
  Search,
  Users,
} from "lucide-react";

import { createClient, deleteClient, updateClient } from "./actions";

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

function ClientPhoneLink({
  raw,
  className,
}: {
  raw: string;
  className?: string;
}) {
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
        className,
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
    null,
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClientDisplay | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  const filtered = useMemo(
    () =>
      clients.filter(
        (c) => matchesSearch(c, search) && matchesFilter(c, filterMode),
      ),
    [clients, search, filterMode],
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
    const idToDelete = deleteTarget.clientId ?? deleteTarget.id;
    startDeleteTransition(async () => {
      const result = await deleteClient(idToDelete);
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
          Add walk-ins, edit notes and allergies, and track no-shows. Anyone
          who books through your AI receptionist or booking link is added
          automatically.
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
                "h-auto gap-2 border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-none hover:bg-gray-50",
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
                <table className="w-full min-w-[680px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/80">
                      <th className="px-6 py-4 text-xs font-medium tracking-widest text-gray-500 uppercase">
                        Client
                      </th>
                      <th className="px-6 py-4 text-xs font-medium tracking-widest text-gray-500 uppercase">
                        Phone
                      </th>
                      <th className="px-6 py-4 text-xs font-medium tracking-widest text-gray-500 uppercase">
                        Bookings
                      </th>
                      <th className="px-6 py-4 text-xs font-medium tracking-widest text-gray-500 uppercase">
                        No-shows
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
                          colSpan={6}
                          className="px-6 py-12 text-center text-sm text-gray-500"
                        >
                          No clients match your search or filter.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((client) => (
                        <tr
                          key={client.id}
                          className="cursor-pointer transition-colors hover:bg-gray-50/50"
                          onClick={() => openHistory(client)}
                        >
                          <td className="max-w-[14rem] truncate px-6 py-4 text-sm font-semibold text-gray-900">
                            {client.name}
                            {client.allergies ? (
                              <span
                                className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                                title={`Allergies: ${client.allergies}`}
                              >
                                <AlertCircle
                                  className="size-2.5"
                                  aria-hidden
                                />
                                Allergy
                              </span>
                            ) : null}
                          </td>
                          <td
                            className="px-6 py-4 align-middle text-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ClientPhoneLink raw={client.phone} />
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium tabular-nums text-gray-700">
                              {client.totalBookings}
                            </span>
                          </td>
                          <td className="px-6 py-4 align-middle">
                            {client.noShows > 0 ? (
                              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium tabular-nums text-amber-800">
                                {client.noShows}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm tabular-nums text-gray-500">
                            {client.lastVisitLabel}
                          </td>
                          <td
                            className="px-6 py-4 text-right align-middle"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-0.5">
                              {viewProfileButton(client)}
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  className={cn(
                                    buttonVariants({
                                      variant: "ghost",
                                      size: "icon-sm",
                                    }),
                                    "size-8 text-gray-400 hover:text-gray-900",
                                  )}
                                  aria-label={`More actions for ${client.name}`}
                                >
                                  <MoreVertical className="size-4" aria-hidden />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => openHistory(client)}
                                  >
                                    View profile
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
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => openHistory(client)}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm"
                  >
                    <div className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 flex-1 text-base leading-snug font-semibold text-gray-900">
                          {client.name}
                        </p>
                        <div className="flex shrink-0 items-center gap-1">
                          <span
                            className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-700"
                            title="Total bookings"
                          >
                            {client.totalBookings}
                          </span>
                          {client.noShows > 0 ? (
                            <span
                              className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-800"
                              title="No-shows"
                            >
                              {client.noShows}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div
                        className="space-y-2 border-t border-gray-100 pt-3"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <AddClientDialog
        open={addClientOpen}
        onOpenChange={setAddClientOpen}
      />

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
                  ’s CRM record. Past appointments stay on file.
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

      <ClientProfileDialog
        client={historyClient}
        open={historyOpen}
        onOpenChange={handleHistoryOpenChange}
      />
    </div>
  );
}

function AddClientDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [allergies, setAllergies] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setName("");
      setPhone("");
      setEmail("");
      setNotes("");
      setAllergies("");
      setError(null);
    }
  }, [open]);

  const submit = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const res = await createClient({
        name,
        phone,
        email,
        notes,
        allergies,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onOpenChange(false);
    });
  }, [name, phone, email, notes, allergies, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent
        className="border border-gray-200/80 bg-white sm:max-w-md"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle className="text-gray-900">Add client</DialogTitle>
          <DialogDescription className="text-gray-600">
            Add a walk-in or known client to your CRM. They'll be linked
            automatically when they next book.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="add-client-name">Full name</Label>
            <Input
              id="add-client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aoife Murphy"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-client-phone">Phone</Label>
            <Input
              id="add-client-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="+353 87 1234567"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-client-email">Email (optional)</Label>
            <Input
              id="add-client-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="aoife@example.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-client-allergies">Allergies (optional)</Label>
            <Input
              id="add-client-allergies"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="e.g. PPD, ammonia"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-client-notes">Notes (optional)</Label>
            <Textarea
              id="add-client-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Preferences, formulas, anything the team should know."
              rows={3}
            />
          </div>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={submit}
            className="gap-1.5"
          >
            {pending ? (
              <>
                <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Add client"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientProfileDialog({
  client,
  open,
  onOpenChange,
}: {
  client: ClientDisplay | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [notesDraft, setNotesDraft] = useState("");
  const [allergiesDraft, setAllergiesDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savePending, startSaveTransition] = useTransition();

  useEffect(() => {
    if (!client) return;
    setNotesDraft(client.notes ?? "");
    setAllergiesDraft(client.allergies ?? "");
    setEmailDraft(client.email ?? "");
    setSaveError(null);
    setSaved(false);
  }, [client?.id]);

  const canEdit = client?.clientId !== null && client?.clientId !== undefined;

  const saveDetails = useCallback(() => {
    if (!client?.clientId) return;
    setSaveError(null);
    setSaved(false);
    startSaveTransition(async () => {
      const res = await updateClient({
        clientId: client.clientId!,
        email: emailDraft,
        notes: notesDraft,
        allergies: allergiesDraft,
      });
      if (!res.ok) {
        setSaveError(res.message);
        return;
      }
      setSaved(true);
    });
  }, [client, emailDraft, notesDraft, allergiesDraft]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] max-w-[calc(100%-2rem)] overflow-hidden border border-gray-200/80 bg-white p-0 sm:max-w-lg">
        {client ? (
          <>
            <DialogHeader className="shrink-0 space-y-0 border-b border-gray-200 px-6 py-4 text-left">
              <DialogTitle className="text-gray-900">
                {client.name}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Profile and booking history for {client.name}.
              </DialogDescription>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                <ClientPhoneLink raw={client.phone} />
                <span>•</span>
                <span className="tabular-nums">
                  {client.totalBookings} booking
                  {client.totalBookings === 1 ? "" : "s"}
                </span>
                {client.noShows > 0 ? (
                  <>
                    <span>•</span>
                    <span className="text-amber-700 tabular-nums">
                      {client.noShows} no-show
                      {client.noShows === 1 ? "" : "s"}
                    </span>
                  </>
                ) : null}
              </div>
            </DialogHeader>

            <div className="max-h-[calc(min(90vh,720px)-4rem)] overflow-y-auto px-6 py-4">
              {canEdit ? (
                <section className="mb-6 space-y-3">
                  <h3 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                    Details
                  </h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="profile-email" className="text-xs">
                        Email
                      </Label>
                      <Input
                        id="profile-email"
                        value={emailDraft}
                        onChange={(e) => setEmailDraft(e.target.value)}
                        type="email"
                        placeholder="email@example.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="profile-allergies" className="text-xs">
                        Allergies
                      </Label>
                      <Input
                        id="profile-allergies"
                        value={allergiesDraft}
                        onChange={(e) => setAllergiesDraft(e.target.value)}
                        placeholder="e.g. PPD, ammonia"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="profile-notes" className="text-xs">
                        Notes
                      </Label>
                      <Textarea
                        id="profile-notes"
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        rows={4}
                        placeholder="Preferences, formulas, anything the team should know."
                      />
                    </div>
                    {saveError ? (
                      <p className="text-sm text-red-600" role="alert">
                        {saveError}
                      </p>
                    ) : null}
                    {saved ? (
                      <p className="text-sm text-emerald-700">Saved.</p>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      onClick={saveDetails}
                      disabled={savePending}
                      className="gap-1.5"
                    >
                      {savePending ? (
                        <>
                          <Loader2
                            className="size-3.5 shrink-0 animate-spin"
                            aria-hidden
                          />
                          Saving…
                        </>
                      ) : (
                        "Save details"
                      )}
                    </Button>
                  </div>
                </section>
              ) : (
                <section className="mb-6 rounded-md border border-dashed border-gray-200 bg-gray-50/80 px-3 py-2.5 text-xs text-gray-600">
                  Promote this guest to a managed client by saving their next
                  booking with notes — or add them via{" "}
                  <span className="font-medium">Add Client</span>.
                </section>
              )}

              <section>
                <h3 className="mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Past appointments
                </h3>
                {client.history.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No past visits on file yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {client.history.map((appt) => (
                      <li
                        key={appt.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium tabular-nums text-gray-500">
                            {appt.dateLabel}
                          </p>
                          <p className="text-sm font-medium text-gray-900">
                            {appt.service}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            appt.status === "completed"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : appt.status === "no_show"
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : appt.status === "cancelled"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-gray-200 bg-white text-gray-600",
                          )}
                        >
                          {appt.status === "no_show"
                            ? "No-show"
                            : appt.status.charAt(0).toUpperCase() +
                              appt.status.slice(1)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
