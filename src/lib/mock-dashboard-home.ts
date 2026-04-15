export type MockActivityLine = {
  id: string;
  time: string;
  text: string;
};

export type MockUpNextAppointment = {
  id: string;
  time: string;
  client: string;
  service: string;
};

export const MOCK_HOME_METRICS = {
  aiBookingsThisWeek: 24,
  missedCallsCaught: 18,
  actionsRequired: 3,
} as const;

/** Shown when dev tier cookie is `connect`. */
export const MOCK_CONNECT_HOME_METRICS = {
  callsHandled: 142,
  linksSentSms: 89,
  actionsRequired: 2,
} as const;

export const MOCK_ACTIVITY_FEED: MockActivityLine[] = [
  {
    id: "a1",
    time: "10:05 AM",
    text: "Sent Cliste booking link by SMS to 085-XXX-XXXX",
  },
  {
    id: "a2",
    time: "09:45 AM",
    text: "Booked John for Skin Fade",
  },
  {
    id: "a3",
    time: "09:12 AM",
    text: "Answered opening hours & parking — caller ended satisfied",
  },
  {
    id: "a4",
    time: "08:58 AM",
    text: "Logged patch-test request to Action Inbox",
  },
  {
    id: "a5",
    time: "08:22 AM",
    text: "Re-routed urgent call to fallback number (owner requested)",
  },
  {
    id: "a6",
    time: "08:05 AM",
    text: "Confirmed balayage duration estimate for new client",
  },
];

export const MOCK_UP_NEXT: MockUpNextAppointment[] = [
  {
    id: "u1",
    time: "11:15 AM",
    client: "Sarah K.",
    service: "Colour & blow-dry",
  },
  {
    id: "u2",
    time: "12:00 PM",
    client: "Marcus D.",
    service: "Skin fade & beard trim",
  },
  {
    id: "u3",
    time: "1:30 PM",
    client: "Aoife N.",
    service: "Root touch-up",
  },
];
