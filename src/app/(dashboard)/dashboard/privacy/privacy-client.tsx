"use client";

import { useState, useTransition } from "react";
import { Download, Trash2 } from "lucide-react";

import { DashboardAnimatedGroup } from "@/components/dashboard/dashboard-animated-group";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
  DASHBOARD_SECONDARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import {
  eraseCustomerData,
  exportCustomerData,
  type GdprErasureCounts,
  type GdprExportPayload,
} from "./actions";

type ExportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ready"; data: GdprExportPayload; phoneE164: string };

type EraseState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; counts: GdprErasureCounts; phoneE164: string };

export function PrivacyToolsClient() {
  const [exportPhone, setExportPhone] = useState("");
  const [exportState, setExportState] = useState<ExportState>({ status: "idle" });
  const [exportPending, startExport] = useTransition();

  const [erasePhone, setErasePhone] = useState("");
  const [eraseConfirm, setEraseConfirm] = useState("");
  const [eraseState, setEraseState] = useState<EraseState>({ status: "idle" });
  const [erasePending, startErase] = useTransition();

  const fieldClass = cn(DASHBOARD_INPUT_CLASS, "text-[13px] text-[#0b1220]");

  function onExport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("phone", exportPhone);
    startExport(async () => {
      const r = await exportCustomerData(fd);
      if (!r.ok) {
        setExportState({ status: "error", message: r.message });
      } else {
        setExportState({ status: "ready", data: r.data, phoneE164: r.phoneE164 });
      }
    });
  }

  function downloadExport() {
    if (exportState.status !== "ready") return;
    const blob = new Blob([JSON.stringify(exportState.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cliste-data-export-${exportState.phoneE164.replace(/\D/g, "")}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onErase(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("phone", erasePhone);
    fd.set("confirm", eraseConfirm);
    startErase(async () => {
      const r = await eraseCustomerData(fd);
      if (!r.ok) {
        setEraseState({ status: "error", message: r.message });
      } else {
        setEraseState({ status: "done", counts: r.affected, phoneE164: r.phoneE164 });
        setErasePhone("");
        setEraseConfirm("");
      }
    });
  }

  return (
    <DashboardAnimatedGroup>
      <SectionCard
        flat
        icon={Download}
        title="Export a customer's data"
        description="GDPR Article 15 — right of access. Search by phone, then download everything we hold for that customer. The file is JSON — a standard export you can open in Notes or TextEdit, or send to a solicitor or IT helper if they ask for it."
      >
        <form
          onSubmit={onExport}
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="gdpr-export-phone">Customer phone</Label>
            <Input
              id="gdpr-export-phone"
              type="tel"
              inputMode="tel"
              placeholder="+353 87 123 4567"
              value={exportPhone}
              onChange={(e) => setExportPhone(e.target.value)}
              className={fieldClass}
              required
            />
          </div>
          <Button
            type="submit"
            disabled={exportPending}
            className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "w-full sm:w-auto")}
          >
            {exportPending ? "Searching…" : "Search records"}
          </Button>
        </form>
        {exportState.status === "error" ? (
          <p className="text-[13px] text-red-600" role="alert">
            {exportState.message}
          </p>
        ) : null}
        {exportState.status === "ready" ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-[13px] leading-relaxed text-slate-700">
            <p>
              Found{" "}
              <strong className="text-[#0b1220]">
                {exportState.data.appointments.length}
              </strong>{" "}
              appointments,{" "}
              <strong className="text-[#0b1220]">
                {exportState.data.call_logs.length}
              </strong>{" "}
              call logs,{" "}
              <strong className="text-[#0b1220]">
                {exportState.data.action_tickets.length}
              </strong>{" "}
              action tickets for{" "}
              <strong className="text-[#0b1220]">{exportState.phoneE164}</strong>.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={downloadExport}
              className={cn("mt-3", DASHBOARD_SECONDARY_BUTTON_CLASS)}
            >
              Download JSON
            </Button>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        flat
        icon={Trash2}
        title="Erase a customer's data"
        description="GDPR Article 17 — erasure. Cannot be undone."
      >
        <form onSubmit={onErase} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gdpr-erase-phone">Customer phone</Label>
              <Input
                id="gdpr-erase-phone"
                type="tel"
                inputMode="tel"
                placeholder="+353 87 123 4567"
                value={erasePhone}
                onChange={(e) => setErasePhone(e.target.value)}
                className={fieldClass}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gdpr-erase-confirm">Confirmation</Label>
              <Input
                id="gdpr-erase-confirm"
                type="text"
                placeholder='Type "ERASE" to confirm'
                value={eraseConfirm}
                onChange={(e) => setEraseConfirm(e.target.value)}
                className={cn(fieldClass, "uppercase")}
                required
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={erasePending || eraseConfirm.toUpperCase() !== "ERASE"}
            className={cn(
              DASHBOARD_SECONDARY_BUTTON_CLASS,
              "border-red-300 text-red-800 hover:border-red-400 hover:bg-red-50 disabled:opacity-50",
            )}
          >
            {erasePending ? "Erasing…" : "Erase customer data"}
          </Button>
        </form>
        {eraseState.status === "error" ? (
          <p className="text-[13px] text-red-700" role="alert">
            {eraseState.message}
          </p>
        ) : null}
        {eraseState.status === "done" ? (
          <div className="rounded-xl border border-slate-200 bg-white/80 p-4 text-[13px] leading-relaxed text-slate-700">
            <p>
              Erased data for{" "}
              <strong className="text-[#0b1220]">{eraseState.phoneE164}</strong>:{" "}
              {eraseState.counts.appointments_anonymised} appointments,{" "}
              {eraseState.counts.call_logs_redacted} call logs,{" "}
              {eraseState.counts.action_tickets_redacted} action tickets.
            </p>
          </div>
        ) : null}
      </SectionCard>
    </DashboardAnimatedGroup>
  );
}
