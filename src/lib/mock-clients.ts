export type MockPastAppointment = {
  id: string;
  dateLabel: string;
  service: string;
};

export type MockClient = {
  id: string;
  name: string;
  phone: string;
  totalBookings: number;
  noShows: number;
  lastVisitLabel: string;
  history: MockPastAppointment[];
};

export const MOCK_CLIENTS: MockClient[] = [
  {
    id: "c1",
    name: "John Murphy",
    phone: "+353 87 111 2222",
    totalBookings: 12,
    noShows: 1,
    lastVisitLabel: "Mar 22, 2026",
    history: [
      {
        id: "h1",
        dateLabel: "Mar 22, 2026",
        service: "Skin fade & beard trim",
      },
      {
        id: "h2",
        dateLabel: "Feb 14, 2026",
        service: "Haircut",
      },
      {
        id: "h3",
        dateLabel: "Jan 8, 2026",
        service: "Shape up",
      },
    ],
  },
  {
    id: "c2",
    name: "Aoife Ní Chatháin",
    phone: "+353 86 234 8891",
    totalBookings: 6,
    noShows: 0,
    lastVisitLabel: "Mar 27, 2026",
    history: [
      {
        id: "h4",
        dateLabel: "Mar 27, 2026",
        service: "Blow-dry & style",
      },
      {
        id: "h5",
        dateLabel: "Mar 1, 2026",
        service: "Half head highlights",
      },
      {
        id: "h6",
        dateLabel: "Jan 20, 2026",
        service: "Cut & colour consult",
      },
    ],
  },
  {
    id: "c3",
    name: "Seán O'Brien",
    phone: "+353 89 500 1122",
    totalBookings: 28,
    noShows: 3,
    lastVisitLabel: "Mar 10, 2026",
    history: [
      {
        id: "h7",
        dateLabel: "Mar 10, 2026",
        service: "Executive cut",
      },
      {
        id: "h8",
        dateLabel: "Feb 2, 2026",
        service: "Executive cut",
      },
      {
        id: "h9",
        dateLabel: "Jan 5, 2026",
        service: "Grey blend",
      },
      {
        id: "h10",
        dateLabel: "Dec 12, 2025",
        service: "Hot towel shave",
      },
    ],
  },
  {
    id: "c4",
    name: "Mary Kelly",
    phone: "+353 83 777 0099",
    totalBookings: 4,
    noShows: 0,
    lastVisitLabel: "Jan 18, 2026",
    history: [
      {
        id: "h11",
        dateLabel: "Jan 18, 2026",
        service: "Set & blow-dry",
      },
      {
        id: "h12",
        dateLabel: "Nov 30, 2025",
        service: "Trim & treatment",
      },
    ],
  },
];
