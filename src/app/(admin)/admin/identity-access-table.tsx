"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { AdminBadge } from "@/components/admin/admin-badge";
import {
  adminTableClass,
  adminTableEmptyClass,
  adminTableHeadClass,
  adminTableRowClass,
  adminTableTdClass,
  adminTableTdTruncateClass,
  adminTableThActionsClass,
  adminTableThClass,
  adminTableThWidth,
} from "@/components/admin/admin-table";
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
  organizationName: string;
  status: "active" | "pending" | "suspended";
  passwordStatus: "set" | "must_set";
  lastLoginLabel: string;
  adminConsoleAccess: boolean;
  adminConsoleLocked: boolean;
};

type IdentityAccessTableProps = {
  rows: IdentityAccessRow[];
  bare?: boolean;
};

export function IdentityAccessTable({ rows, bare = false }: IdentityAccessTableProps) {
  const table = (
    <table className={adminTableClass}>
      <thead className={adminTableHeadClass}>
        <tr>
          <th className={adminTableThWidth("w-[20%]")}>User email</th>
          <th className={adminTableThWidth("w-[16%]")}>Linked client</th>
          <th className={adminTableThWidth("w-[9%]")}>Status</th>
          <th className={adminTableThWidth("w-[9%]")}>Password</th>
          <th className={adminTableThWidth("w-[12%]")}>Admin console</th>
          <th className={adminTableThWidth("w-[15%]")}>Last login</th>
          <th className={adminTableThActionsClass}>Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.length === 0 ? (
          <tr>
            <td colSpan={7} className={adminTableEmptyClass}>
              No auth users found.
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.userId} className={adminTableRowClass}>
              <td
                className={`truncate text-sm font-medium text-gray-900 ${adminTableTdClass}`}
                title={row.email || undefined}
              >
                {row.email || ""}
              </td>
              <td className={adminTableTdTruncateClass}>
                {row.organizationId ? (
                  <Link
                    href={`/admin/customers/${row.organizationId}`}
                    className="block truncate text-sm font-medium text-gray-900 underline-offset-2 hover:underline"
                    title={row.organizationName}
                  >
                    {row.organizationName}
                  </Link>
                ) : (
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {row.organizationName}
                  </span>
                )}
              </td>
              <td className={`whitespace-nowrap ${adminTableTdClass}`}>
                <AdminBadge className="capitalize">{row.status}</AdminBadge>
              </td>
              <td className={`whitespace-nowrap ${adminTableTdClass}`}>
                <AdminBadge>
                  {row.passwordStatus === "must_set" ? "Must set" : "Set"}
                </AdminBadge>
              </td>
              <td className={`whitespace-nowrap ${adminTableTdClass}`}>
                <AdminBadge>
                  {row.adminConsoleAccess
                    ? row.adminConsoleLocked
                      ? "Owner allowlist"
                      : "Granted"
                    : "No access"}
                </AdminBadge>
              </td>
              <td
                className={`truncate text-sm text-gray-500 ${adminTableTdClass}`}
                title={row.lastLoginLabel}
              >
                {row.lastLoginLabel}
              </td>
              <td className={`whitespace-nowrap ${adminTableTdClass}`}>
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
  );

  if (bare) {
    return table;
  }

  return (
    <div className="overflow-x-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {table}
    </div>
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
