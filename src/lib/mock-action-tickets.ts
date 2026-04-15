export type MockActionTicket = {
  id: string;
  callerNumber: string;
  timeLabel: string;
  summary: string;
};

/** Static demo data for Action Inbox UI (Step 3). Replace with Supabase in Step 4. */
export const MOCK_ACTION_TICKETS: MockActionTicket[] = [
  {
    id: "mock-1",
    callerNumber: "+353 87 111 2222",
    timeLabel: "10:30 AM",
    summary:
      "Caller needs a patch test before booking color.",
  },
  {
    id: "mock-2",
    callerNumber: "+353 89 555 6666",
    timeLabel: "9:15 AM",
    summary:
      "Asked about colour correction pricing and whether same-day consults are possible.",
  },
  {
    id: "mock-3",
    callerNumber: "+353 86 777 8888",
    timeLabel: "2:45 PM",
    summary:
      "Mentioned a previous allergic reaction to dye — wants a stylist callback before rebooking.",
  },
];
