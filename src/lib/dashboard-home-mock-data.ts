import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import type { AnalyticsSegment } from "@/lib/dashboard-home-analytics";
import type { HomeCaraPerformanceSnapshot } from "@/lib/dashboard-home-cara-performance";
import type { HomeCallTimesBucket } from "@/lib/dashboard-home-call-times";
import type {
  HomeCaraTrainingRow,
  HomeRequestRow,
} from "@/lib/dashboard-home-requests";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

/** Salon demo — local home dashboard preview only. */
export const DASHBOARD_HOME_MOCK = {
  hero: {
    callsAnswered: 47,
    requestsCaptured: 14,
    routed: 8,
    callbacks: 3,
    needsAttention: 3,
    minutesUsed: 86,
  },

  activity: [
    {
      id: "mock-activity-1",
      title: "Emma Walsh",
      subtitle: "Balayage price enquiry",
      time: "4m ago",
      href: DASHBOARD_ROUTES.calls,
      badge: "Call answered",
    },
    {
      id: "mock-activity-2",
      title: "Booking request",
      subtitle: "Saturday blow-dry slot",
      time: "18m ago",
      href: DASHBOARD_ROUTES.actionInbox,
      badge: "Enquiry captured",
    },
    {
      id: "mock-activity-3",
      title: "Aoife Byrne",
      subtitle: "Callback after 3pm",
      time: "42m ago",
      href: DASHBOARD_ROUTES.actionInbox,
      badge: "Callback request",
    },
  ] satisfies TimelineFeedRow[],

  needsAttention: [
    {
      id: "mock-attention-1",
      href: `${DASHBOARD_ROUTES.actionInbox}?ticket=mock-1`,
      title: "Emma Walsh",
      description: "Pricing question",
      time: "12m ago",
    },
    {
      id: "mock-attention-2",
      href: `${DASHBOARD_ROUTES.actionInbox}?ticket=mock-2`,
      title: "Aoife Byrne",
      description: "Callback request",
      time: "42m ago",
    },
    {
      id: "mock-attention-3",
      href: `${DASHBOARD_ROUTES.actionInbox}?ticket=mock-3`,
      title: "Niamh O'Sullivan",
      description: "Booking to confirm",
      time: "1h ago",
    },
  ] satisfies HomeRequestRow[],

  openActions: 3,

  caraTraining: [
    {
      id: "mock-training-1",
      href: `${DASHBOARD_ROUTES.caraTraining}?item=mock-1`,
      title: "Knowledge gap",
      description: "Keratin treatment aftercare advice",
      time: "2h ago",
    },
    {
      id: "mock-training-2",
      href: `${DASHBOARD_ROUTES.caraTraining}?item=mock-2`,
      title: "Review draft",
      description: "Student discount policy",
      time: "Yesterday",
    },
    {
      id: "mock-training-3",
      href: `${DASHBOARD_ROUTES.caraTraining}?item=mock-3`,
      title: "Knowledge gap",
      description: "Patch test timing for colour",
      time: "Yesterday",
    },
  ] satisfies HomeCaraTrainingRow[],

  openTrainingCount: 3,

  requestTypeSegments: [
    {
      id: "general",
      label: "General enquiries",
      value: 18,
      percent: 43,
      shade: "#0b1220",
    },
    {
      id: "callbacks",
      label: "Callbacks",
      value: 8,
      percent: 19,
      shade: "#475569",
    },
    {
      id: "pricing",
      label: "Pricing",
      value: 11,
      percent: 26,
      shade: "#94a3b8",
    },
    {
      id: "product",
      label: "Product enquiries",
      value: 5,
      percent: 12,
      shade: "#cbd5e1",
    },
  ] satisfies AnalyticsSegment[],

  callOutcomeSegments: [
    {
      id: "answered",
      label: "Answered by Cara",
      value: 36,
      percent: 77,
      shade: "#0b1220",
    },
    {
      id: "information",
      label: "Information provided",
      value: 6,
      percent: 13,
      shade: "#475569",
    },
    {
      id: "follow-up",
      label: "Follow-up created",
      value: 4,
      percent: 8,
      shade: "#94a3b8",
    },
    {
      id: "other",
      label: "Other",
      value: 1,
      percent: 2,
      shade: "#cbd5e1",
    },
  ] satisfies AnalyticsSegment[],

  caraPerformance: {
    isOnline: true,
    statusLabel: "Live",
    qualitySegments: [
      {
        id: "happy",
        label: "Happy calls",
        value: 41,
        percent: 87,
        shade: "#0b1220",
      },
      {
        id: "needs-review",
        label: "Needs review",
        value: 6,
        percent: 13,
        shade: "#cbd5e1",
      },
    ],
    avgDurationLabel: "2m 14s",
    totalCalls: 47,
  } satisfies HomeCaraPerformanceSnapshot,

  callTimes: [
    { id: "h-9", label: "9am", value: 2 },
    { id: "h-10", label: "10am", value: 6 },
    { id: "h-11", label: "11am", value: 11 },
    { id: "h-12", label: "12pm", value: 5 },
    { id: "h-13", label: "1pm", value: 4 },
    { id: "h-14", label: "2pm", value: 7 },
    { id: "h-15", label: "3pm", value: 9 },
    { id: "h-16", label: "4pm", value: 8 },
    { id: "h-17", label: "5pm", value: 4 },
    { id: "h-18", label: "6pm", value: 1 },
  ] satisfies HomeCallTimesBucket[],
} as const;
