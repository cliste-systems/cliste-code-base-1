"use client";

import { useState, useTransition } from "react";

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
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">
          Export a customer&rsquo;s data
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          GDPR Article 15. Returns a JSON file you can hand to the customer.
        </p>
        <form onSubmit={onExport} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="tel"
            inputMode="tel"
            placeholder="+353 87 123 4567"
            value={exportPhone}
            onChange={(e) => setExportPhone(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none"
            required
          />
          <button
            type="submit"
            disabled={exportPending}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-gray-800 disabled:opacity-50"
          >
            {exportPending ? "Searching\u2026" : "Search"}
          </button>
        </form>
        {exportState.status === "error" && (
          <p className="mt-3 text-sm text-red-600">{exportState.message}</p>
        )}
        {exportState.status === "ready" && (
          <div className="mt-4 rounded-md bg-gray-50 p-4 text-sm text-gray-700">
            <p>
              Found <strong>{exportState.data.appointments.length}</strong>{" "}
              appointments,{" "}
              <strong>{exportState.data.call_logs.length}</strong> call logs,{" "}
              <strong>{exportState.data.action_tickets.length}</strong> action
              tickets for <strong>{exportState.phoneE164}</strong>.
            </p>
            <button
              type="button"
              onClick={downloadExport}
              className="mt-3 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-900 shadow-sm hover:bg-gray-100"
            >
              Download JSON
            </button>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-red-200 bg-red-50/30 p-5">
        <h2 className="text-lg font-semibold text-red-900">
          Erase a customer&rsquo;s data
        </h2>
        <p className="mt-1 text-sm text-red-900/80">
          GDPR Article 17. Anonymises name, phone and email on every record;
          appointment times and prices are kept for tax. This cannot be undone.
        </p>
        <form onSubmit={onErase} className="mt-4 space-y-3">
          <input
            type="tel"
            inputMode="tel"
            placeholder="+353 87 123 4567"
            value={erasePhone}
            onChange={(e) => setErasePhone(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none"
            required
          />
          <input
            type="text"
            placeholder='Type "ERASE" to confirm'
            value={eraseConfirm}
            onChange={(e) => setEraseConfirm(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase shadow-sm focus:border-red-700 focus:outline-none"
            required
          />
          <button
            type="submit"
            disabled={erasePending || eraseConfirm.toUpperCase() !== "ERASE"}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-800 disabled:opacity-50"
          >
            {erasePending ? "Erasing\u2026" : "Erase customer data"}
          </button>
        </form>
        {eraseState.status === "error" && (
          <p className="mt-3 text-sm text-red-700">{eraseState.message}</p>
        )}
        {eraseState.status === "done" && (
          <div className="mt-4 rounded-md bg-white p-4 text-sm text-gray-700">
            <p>
              Erased data for <strong>{eraseState.phoneE164}</strong>:{" "}
              {eraseState.counts.appointments_anonymised} appointments,{" "}
              {eraseState.counts.call_logs_redacted} call logs,{" "}
              {eraseState.counts.action_tickets_redacted} action tickets.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
