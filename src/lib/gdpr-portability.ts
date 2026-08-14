export type GdprPortabilityPayload = {
  format: "cliste-gdpr-portability-v1";
  generated_at: string;
  organization_id: string;
  truncated: boolean;
  appointments: Record<string, unknown>[];
  call_logs: Record<string, unknown>[];
  action_tickets: Record<string, unknown>[];
};

/** Convert portability payload to CSV (one section per record type). */
export function portabilityPayloadToCsv(data: GdprPortabilityPayload): string {
  const sections: string[] = [];

  const appendSection = (title: string, rows: Record<string, unknown>[]) => {
    sections.push(`# ${title}`);
    if (rows.length === 0) {
      sections.push("(no records)");
      sections.push("");
      return;
    }
    const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    sections.push(headers.join(","));
    for (const row of rows) {
      sections.push(
        headers
          .map((h) => {
            const v = row[h];
            const s = v == null ? "" : String(v);
            return s.includes(",") || s.includes('"') || s.includes("\n")
              ? `"${s.replace(/"/g, '""')}"`
              : s;
          })
          .join(","),
      );
    }
    sections.push("");
  };

  appendSection("appointments", data.appointments);
  appendSection("call_logs", data.call_logs);
  appendSection("action_tickets", data.action_tickets);
  if (data.truncated) {
    sections.push("# truncated");
    sections.push(
      "Export hit the 5000-row cap on at least one table. Contact Cliste for a full dump.",
    );
    sections.push("");
  }

  return sections.join("\n");
}
