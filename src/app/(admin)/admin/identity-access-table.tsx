"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";

import {
  adminGrantConsoleAccess,
  adminRevokeConsoleAccess,
  adminSendPasswordRecoveryLink,
  adminSuspendUser,
  adminUnsuspendUser,
} from "./actions";

export type IdentityAccessRow = {
  userId: string;
  email: string;
  organizationId: string | null;
  salonName: string;
  status: "active" | "pending" | "suspended";
  passwordStatus: "set" | "must_set";
  lastLoginLabel: string;
  adminConsoleAccess: boolean;
  adminConsoleLocked: boolean;
};

type IdentityAccessTableProps = {
  rows: IdentityAccessRow[];
};

export function IdentityAccessTable({ rows }: IdentityAccessTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full min-w-[900px] border-collapse text-left">
        <thead>
          <tr className="border-b border-gray-200 bg-white">
            <th className="w-[30%] px-5 py-3.5 text-xs font-medium text-gray-500">
              User email
            </th>
            <th className="w-[20%] px-5 py-3.5 text-xs font-medium text-gray-500">
              Linked salon
            </th>
            <th className="w-[15%] px-5 py-3.5 text-xs font-medium text-gray-500">
              Status
            </th>
            <th className="w-[15%] px-5 py-3.5 text-xs font-medium text-gray-500">
              Password
            </th>
            <th className="w-[15%] px-5 py-3.5 text-xs font-medium text-gray-500">
              Admin console
            </th>
            <th className="px-5 py-3.5 text-xs font-medium text-gray-500">
              Last login
            </th>
            <th className="px-5 py-3.5 text-right text-xs font-medium text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="px-5 py-12 text-center text-sm text-gray-500"
              >
                No auth users found.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.userId}
                className="group transition-colors hover:bg-gray-50/50"
              >
                <td className="px-5 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
                  {row.email || "—"}
                </td>
                <td className="px-5 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
                  {row.organizationId ? (
                    <Link
                      href={`/admin/organizations/${row.organizationId}`}
                      className="text-gray-900 underline-offset-2 hover:underline"
                    >
                      {row.salonName}
                    </Link>
                  ) : (
                    row.salonName
                  )}
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <StatusBadge status={row.status} />
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <PasswordBadge status={row.passwordStatus} />
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <AdminConsoleBadge
                    hasAccess={row.adminConsoleAccess}
                    locked={row.adminConsoleLocked}
                  />
                </td>
                <td className="px-5 py-4 text-sm font-normal whitespace-nowrap text-gray-500">
                  {row.lastLoginLabel}
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <div className="flex items-center justify-end">
                    <RowActions
                      userId={row.userId}
                      email={row.email}
                      status={row.status}
                      hasAdminConsoleAccess={row.adminConsoleAccess}
                      adminConsoleLocked={row.adminConsoleLocked}
                    />
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function PasswordBadge({
  status,
}: {
  status: IdentityAccessRow["passwordStatus"];
}) {
  if (status === "must_set") {
    return (
      <span className="inline-flex items-center rounded-md border border-amber-200/80 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
        Must set
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-gray-200/80 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
      Set
    </span>
  );
}

function StatusBadge({ status }: { status: IdentityAccessRow["status"] }) {
  if (status === "suspended") {
    return (
      <span className="inline-flex items-center rounded-md border border-red-200/60 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
        Suspended
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="inline-flex items-center rounded-md border border-green-200/60 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-amber-200/80 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
      Pending
    </span>
  );
}

function AdminConsoleBadge({
  hasAccess,
  locked,
}: {
  hasAccess: boolean;
  locked: boolean;
}) {
  if (hasAccess && locked) {
    return (
      <span className="inline-flex items-center rounded-md border border-blue-200/70 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
        Owner allowlist
      </span>
    );
  }
  if (hasAccess) {
    return (
      <span className="inline-flex items-center rounded-md border border-green-200/60 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        Granted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-gray-200/80 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
      No access
    </span>
  );
}

function RowActions({
  userId,
  email,
  status,
  hasAdminConsoleAccess,
  adminConsoleLocked,
}: {
  userId: string;
  email: string;
  status: IdentityAccessRow["status"];
  hasAdminConsoleAccess: boolean;
  adminConsoleLocked: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rowError, setRowError] = useState<string | null>(null);

  const onRecovery = useCallback(() => {
    if (!email?.trim()) {
      setRowError("This user has no email; recovery links require email.");
      return;
    }
    setRowError(null);
    startTransition(async () => {
      const result = await adminSendPasswordRecoveryLink(
        userId,
        email,
        typeof window !== "undefined" ? window.location.origin : null,
      );
      if (!result.ok) {
        setRowError(result.message);
        return;
      }
      try {
        await navigator.clipboard.writeText(result.url);
        window.alert(
          "Recovery link copied to clipboard. Paste it into a secure channel for the user, or open it yourself in a private window.",
        );
      } catch {
        window.prompt("Copy this recovery link:", result.url);
      }
    });
  }, [email, userId]);

  const onSuspend = useCallback(() => {
    if (
      !window.confirm(
        "Suspend this account? They will not be able to sign in until lifted.",
      )
    ) {
      return;
    }
    setRowError(null);
    startTransition(async () => {
      const result = await adminSuspendUser(userId);
      if (!result.ok) {
        setRowError(result.message);
        return;
      }
      router.refresh();
    });
  }, [router, userId]);

  const onUnsuspend = useCallback(() => {
    setRowError(null);
    startTransition(async () => {
      const result = await adminUnsuspendUser(userId);
      if (!result.ok) {
        setRowError(result.message);
        return;
      }
      router.refresh();
    });
  }, [router, userId]);

  const onGrantAdminConsoleAccess = useCallback(() => {
    setRowError(null);
    startTransition(async () => {
      const result = await adminGrantConsoleAccess(userId);
      if (!result.ok) {
        setRowError(result.message);
        return;
      }
      router.refresh();
    });
  }, [router, userId]);

  const onRevokeAdminConsoleAccess = useCallback(() => {
    if (adminConsoleLocked) {
      setRowError("This owner account is always allowlisted via env.");
      return;
    }
    setRowError(null);
    startTransition(async () => {
      const result = await adminRevokeConsoleAccess(userId);
      if (!result.ok) {
        setRowError(result.message);
        return;
      }
      router.refresh();
    });
  }, [adminConsoleLocked, router, userId]);

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending}
          aria-label="Row actions"
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors",
            "hover:bg-gray-50 hover:text-gray-600",
            "focus:outline-none focus:ring-2 focus:ring-gray-200",
            "disabled:opacity-50",
          )}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onRecovery} disabled={pending || !email}>
            Send password reset link
          </DropdownMenuItem>
          {hasAdminConsoleAccess ? (
            <DropdownMenuItem
              onClick={onRevokeAdminConsoleAccess}
              disabled={pending || adminConsoleLocked}
            >
              Revoke admin console access
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={onGrantAdminConsoleAccess}
              disabled={pending}
            >
              Grant admin console access
            </DropdownMenuItem>
          )}
          {status === "suspended" ? (
            <DropdownMenuItem onClick={onUnsuspend} disabled={pending}>
              Lift suspension
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              onClick={onSuspend}
              disabled={pending}
            >
              Suspend account
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {rowError ? (
        <p className="max-w-[12rem] text-right text-xs leading-snug text-red-600">
          {rowError}
        </p>
      ) : null}
    </div>
  );
}
