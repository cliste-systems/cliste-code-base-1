import type { TimelineFeedRow } from "@/components/dashboard/dashboard-timeline-feed";
import type { AnalyticsSegment } from "@/lib/dashboard-home-analytics";
import type { HomeCaraPerformanceSnapshot } from "@/lib/dashboard-home-cara-performance";
import type { HomeCallTimesBucket } from "@/lib/dashboard-home-call-times";
import type {
  HomeCaraTrainingRow,
  HomeRequestRow,
} from "@/lib/dashboard-home-requests";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

/** Kavanaghs retail demo — overview (/dashboard) preview only. */
export const DASHBOARD_HOME_MOCK = {
  hero: {
    callsAnswered: 33,
    requestsCaptured: 12,
    routed: 5,
    callbacks: 4,
    needsAttention: 3,
    minutesUsed: 85,
  },

  activity: [
    {
      id: "mock-activity-1",
      title: "Siobhán",
      subtitle: "087 234 5678",
      time: "5m ago",
      href: DASHBOARD_ROUTES.calls,
    },
    {
      id: "mock-activity-2",
      title: "Tom",
      subtitle: "086 112 3344",
      time: "9m ago",
      href: DASHBOARD_ROUTES.calls,
    },
    {
      id: "mock-activity-3",
      title: "Mary",
      subtitle: "085 998 7766",
      time: "14m ago",
      href: DASHBOARD_ROUTES.calls,
    },
  ] satisfies TimelineFeedRow[],

  needsAttention: [
    {
      id: "mock-attention-1",
      href: `${DASHBOARD_ROUTES.actionInbox}?ticket=mock-1`,
      title: "Siobhán",
      description: "Real Rewards — double points this weekend?",
      time: "12m ago",
    },
    {
      id: "mock-attention-2",
      href: `${DASHBOARD_ROUTES.actionInbox}?ticket=mock-2`,
      title: "Tom",
      description: "Do you stock Lismore milk today?",
      time: "18m ago",
    },
    {
      id: "mock-attention-3",
      href: `${DASHBOARD_ROUTES.actionInbox}?ticket=mock-3`,
      title: "Rita",
      description: "Click & Collect — change pickup to 6pm",
      time: "46m ago",
    },
  ] satisfies HomeRequestRow[],

  openActions: 3,

  caraTraining: [
    {
      id: "mock-training-1",
      href: `${DASHBOARD_ROUTES.caraTraining}?item=mock-1`,
      title: "Knowledge gap",
      description: "Real Rewards at Applegreen & Circle K",
      time: "40m ago",
    },
    {
      id: "mock-training-2",
      href: `${DASHBOARD_ROUTES.caraTraining}?item=mock-2`,
      title: "Knowledge gap",
      description: "Christmas turkey pre-orders",
      time: "1h ago",
    },
    {
      id: "mock-training-3",
      href: `${DASHBOARD_ROUTES.caraTraining}?item=mock-3`,
      title: "Knowledge gap",
      description: "An Post bill pay cut-off times",
      time: "2h ago",
    },
  ] satisfies HomeCaraTrainingRow[],

  openTrainingCount: 3,

  requestTypeSegments: [
    {
      id: "general",
      label: "General enquiries",
      value: 14,
      percent: 38,
      shade: "#0b1220",
    },
    {
      id: "pricing",
      label: "Pricing",
      value: 9,
      percent: 24,
      shade: "#475569",
    },
    {
      id: "callbacks",
      label: "Callbacks",
      value: 7,
      percent: 19,
      shade: "#94a3b8",
    },
    {
      id: "product",
      label: "Product enquiries",
      value: 7,
      percent: 19,
      shade: "#cbd5e1",
    },
  ] satisfies AnalyticsSegment[],

  callOutcomeSegments: [
    {
      id: "answered",
      label: "Answered by Cara",
      value: 24,
      percent: 73,
      shade: "#0b1220",
    },
    {
      id: "information",
      label: "Information provided",
      value: 4,
      percent: 12,
      shade: "#475569",
    },
    {
      id: "follow-up",
      label: "Follow-up created",
      value: 3,
      percent: 9,
      shade: "#94a3b8",
    },
    {
      id: "other",
      label: "Other",
      value: 2,
      percent: 6,
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
        value: 29,
        percent: 88,
        shade: "#0b1220",
      },
      {
        id: "needs-review",
        label: "Needs review",
        value: 4,
        percent: 12,
        shade: "#cbd5e1",
      },
    ],
    avgDurationLabel: "1m 42s",
    totalCalls: 33,
  } satisfies HomeCaraPerformanceSnapshot,

  callTimes: [
    { id: "h-9", label: "9am", value: 2 },
    { id: "h-10", label: "10am", value: 4 },
    { id: "h-11", label: "11am", value: 8 },
    { id: "h-12", label: "12pm", value: 5 },
    { id: "h-13", label: "1pm", value: 3 },
    { id: "h-14", label: "2pm", value: 6 },
    { id: "h-15", label: "3pm", value: 7 },
    { id: "h-16", label: "4pm", value: 5 },
    { id: "h-17", label: "5pm", value: 3 },
    { id: "h-18", label: "6pm", value: 1 },
  ] satisfies HomeCallTimesBucket[],
} as const;
