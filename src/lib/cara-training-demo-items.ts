import type { CaraTrainingListItem } from "@/app/(dashboard)/dashboard/cara-training/cara-training-helpers";
import {
  buildTrainingCallFacts,
  isOpenTrainingStatus,
} from "@/app/(dashboard)/dashboard/cara-training/cara-training-helpers";
import {
  formatTrainingUnderstandingAssistantMessage,
  normalizeTrainingQuestion,
} from "@/lib/cara-training-understanding-guards";
import {
  targetSectionForPatch,
  type CaraTrainingPatch,
} from "@/lib/cara-training-types";

export type DemoTrainingActionResult =
  | { ok: true; item: CaraTrainingListItem }
  | { ok: false; message: string };

function demoActionTimestamp(): string {
  return new Date().toISOString();
}

function ownerMessagesWithoutDeferred(
  item: CaraTrainingListItem,
): CaraTrainingListItem["owner_messages"] {
  return item.owner_messages.filter(
    (message) =>
      !(
        message.role === "assistant" &&
        message.content.startsWith("Deferred —")
      ),
  );
}

function buildDemoFaqPatch(
  item: CaraTrainingListItem,
  answer: string,
): CaraTrainingPatch {
  return {
    kind: "faq",
    question: normalizeTrainingQuestion(item.cara_question),
    answer,
  };
}

/** Local-only answer flow for fixed demo rows (no Supabase). */
export function applyDemoTrainingAnswer(
  item: CaraTrainingListItem,
  answerText: string,
): DemoTrainingActionResult {
  if (item.status !== "awaiting_answer") {
    return { ok: false, message: "This item is not waiting for an answer." };
  }

  const answer = answerText.trim();
  if (!answer) {
    return { ok: false, message: "Enter an answer." };
  }

  const now = demoActionTimestamp();
  const patch = buildDemoFaqPatch(item, answer);

  return {
    ok: true,
    item: {
      ...item,
      status: "draft_ready",
      owner_messages: [
        ...ownerMessagesWithoutDeferred(item),
        { role: "user", content: answer, at: now },
        {
          role: "assistant",
          content: formatTrainingUnderstandingAssistantMessage(answer),
          at: now,
        },
      ],
      proposed_patch: patch,
      target_section: targetSectionForPatch(patch),
      updated_at: now,
    },
  };
}

export function applyDemoTrainingConfirm(
  item: CaraTrainingListItem,
): DemoTrainingActionResult {
  if (item.status !== "draft_ready" || !item.proposed_patch) {
    return { ok: false, message: "Nothing to confirm." };
  }

  const now = demoActionTimestamp();
  return {
    ok: true,
    item: {
      ...item,
      status: "applied",
      applied_patch: item.proposed_patch,
      applied_at: now,
      updated_at: now,
    },
  };
}

export function applyDemoTrainingDismiss(
  item: CaraTrainingListItem,
): DemoTrainingActionResult {
  if (!isOpenTrainingStatus(item.status)) {
    return { ok: false, message: "This item cannot be dismissed." };
  }

  const now = demoActionTimestamp();
  return {
    ok: true,
    item: {
      ...item,
      status: "dismissed",
      dismissed_at: now,
      updated_at: now,
    },
  };
}

export function applyDemoTrainingBackToEdit(
  item: CaraTrainingListItem,
): DemoTrainingActionResult {
  if (item.status !== "draft_ready") {
    return { ok: false, message: "This item is not ready to edit." };
  }

  return {
    ok: true,
    item: {
      ...item,
      status: "awaiting_answer",
      proposed_patch: null,
      target_section: null,
      updated_at: demoActionTimestamp(),
    },
  };
}

export function applyDemoTrainingRevert(
  item: CaraTrainingListItem,
): DemoTrainingActionResult {
  if (item.status !== "applied") {
    return { ok: false, message: "This item is not saved yet." };
  }

  return {
    ok: true,
    item: {
      ...item,
      status: "awaiting_answer",
      proposed_patch: null,
      applied_patch: null,
      target_section: null,
      applied_at: null,
      applied_by: null,
      updated_at: demoActionTimestamp(),
    },
  };
}

/** Fixed demo rows for local UI review — merged only in development. */
export const CARA_TRAINING_DEMO_ITEM_IDS = {
  hotChickenCounter: "a1000001-0000-4000-8000-000000000001",
  clickCollectToCarPark: "a1000001-0000-4000-8000-000000000002",
  minimumCardPayment: "a1000001-0000-4000-8000-000000000003",
  atmCashBack: "a1000001-0000-4000-8000-000000000004",
  veganSalmon: "a1000001-0000-4000-8000-000000000005",
  postOfficeLocation: "a1000001-0000-4000-8000-000000000006",
  smallDogInBag: "a1000001-0000-4000-8000-000000000007",
  roadworksSideEntrance: "a1000001-0000-4000-8000-000000000008",
  breadPriceToday: "a1000001-0000-4000-8000-000000000009",
  closingTimeConflict: "a1000001-0000-4000-8000-00000000000a",
  butcherSliceDeliHam: "a1000001-0000-4000-8000-00000000000b",
  realRewardsOnAlcohol: "a1000001-0000-4000-8000-00000000000c",
} as const;

const now = "2026-09-17T15:30:00.000Z";
const yesterday = "2026-09-16T11:15:00.000Z";
const twoDaysAgo = "2026-09-15T09:40:00.000Z";
const lastWeek = "2026-09-10T14:20:00.000Z";

function demoItem(
  overrides: Partial<CaraTrainingListItem> &
    Pick<CaraTrainingListItem, "id" | "status" | "source" | "gap_summary" | "caller_context" | "cara_question">,
): CaraTrainingListItem {
  return {
    organization_id: "demo-org",
    call_log_id: null,
    action_ticket_id: null,
    owner_messages: [],
    proposed_patch: null,
    applied_patch: null,
    target_section: null,
    applied_at: null,
    applied_by: null,
    dismissed_at: null,
    occurrence_count: 1,
    last_seen_at: now,
    created_at: now,
    updated_at: now,
    ...overrides,
  } satisfies CaraTrainingListItem;
}

const demoCallLogId = (suffix: string) =>
  `a2000001-0000-4000-8000-${suffix.padStart(12, "0")}`;

export function buildCaraTrainingDemoItems(): CaraTrainingListItem[] {
  const items = [
    demoItem({
      id: CARA_TRAINING_DEMO_ITEM_IDS.hotChickenCounter,
      status: "awaiting_answer",
      source: "call_gap",
      call_log_id: demoCallLogId("001"),
      gap_summary: "Hot chicken counter location",
      caller_context:
        "Caller asked if the hot chicken is at the deli counter or the bakery — they were standing between both and staff pointed them different ways.",
      cara_question: "Is hot chicken sold at the deli counter or the bakery?",
      occurrence_count: 3,
      last_seen_at: now,
      created_at: yesterday,
      updated_at: now,
    }),
    demoItem({
      id: CARA_TRAINING_DEMO_ITEM_IDS.clickCollectToCarPark,
      status: "awaiting_answer",
      source: "call_gap",
      call_log_id: demoCallLogId("002"),
      gap_summary: "Click and collect to car park",
      caller_context:
        "Caller wanted click-and-collect brought out to their car in the car park because they had kids with them — not sure if that is the same as delivery.",
      cara_question: "Can click-and-collect orders be brought to the car park?",
      occurrence_count: 1,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
    }),
    demoItem({
      id: CARA_TRAINING_DEMO_ITEM_IDS.minimumCardPayment,
      status: "awaiting_answer",
      source: "call_gap",
      call_log_id: demoCallLogId("003"),
      gap_summary: "Minimum card payment",
      caller_context:
        "Caller had a small €3 shop and the self-checkout would not take their card — they asked if the store has a minimum card spend.",
      cara_question: "Is there a minimum spend for card payments?",
      occurrence_count: 2,
      last_seen_at: yesterday,
      created_at: yesterday,
      updated_at: now,
    }),
    demoItem({
      id: CARA_TRAINING_DEMO_ITEM_IDS.atmCashBack,
      status: "awaiting_answer",
      source: "call_gap",
      call_log_id: demoCallLogId("004"),
      gap_summary: "Cashback at tills",
      caller_context:
        "Caller wanted cashback at the till and asked what the maximum is — they thought every supermarket offers it the same way.",
      cara_question: "Can customers get cashback at the tills?",
      occurrence_count: 1,
      last_seen_at: twoDaysAgo,
      created_at: twoDaysAgo,
      updated_at: yesterday,
    }),
    demoItem({
      id: CARA_TRAINING_DEMO_ITEM_IDS.veganSalmon,
      status: "awaiting_answer",
      source: "call_gap",
      call_log_id: demoCallLogId("005"),
      gap_summary: "Vegan salmon availability",
      caller_context:
        "Caller asked if we sell vegan salmon — they meant plant-based fish alternatives, not fresh fish, and Cara wasn't sure which counter to mention.",
      cara_question: "Do we sell vegan salmon or plant-based fish alternatives?",
      occurrence_count: 1,
      last_seen_at: lastWeek,
      created_at: lastWeek,
      updated_at: lastWeek,
    }),
    demoItem({
      id: CARA_TRAINING_DEMO_ITEM_IDS.postOfficeLocation,
      status: "awaiting_answer",
      source: "call_gap",
      call_log_id: demoCallLogId("006"),
      gap_summary: "Post Office location",
      caller_context:
        "Caller wanted to post a parcel and asked if the Post Office is our in-store counter or the separate An Post desk in the shopping centre.",
      cara_question: "Where is the Post Office — in-store or in the shopping centre?",
      occurrence_count: 4,
      last_seen_at: yesterday,
      created_at: lastWeek,
      updated_at: now,
    }),
    demoItem({
      id: CARA_TRAINING_DEMO_ITEM_IDS.smallDogInBag,
      status: "awaiting_answer",
      source: "call_gap",
      call_log_id: demoCallLogId("007"),
      gap_summary: "Small dog in bag policy",
      caller_context:
        "Caller asked if a small dog in a carrier bag counts the same as an assistance dog — they said other shops allow it but weren't sure about us.",
      cara_question: "Is a small dog in a bag treated the same as an assistance dog?",
      occurrence_count: 2,
      last_seen_at: now,
      created_at: yesterday,
      updated_at: now,
    }),
    demoItem({
      id: CARA_TRAINING_DEMO_ITEM_IDS.roadworksSideEntrance,
      status: "awaiting_answer",
      source: "call_gap",
      call_log_id: demoCallLogId("008"),
      gap_summary: "Temporary side entrance",
      caller_context:
        "Caller said roadworks were on the main road last week and asked if customers should still use the side entrance or if that was only temporary.",
      cara_question: "Should customers still use the side entrance because of roadworks?",
      occurrence_count: 1,
      last_seen_at: twoDaysAgo,
      created_at: twoDaysAgo,
      updated_at: twoDaysAgo,
    }),
    demoItem({
      id: CARA_TRAINING_DEMO_ITEM_IDS.breadPriceToday,
      status: "awaiting_answer",
      source: "call_gap",
      call_log_id: demoCallLogId("009"),
      gap_summary: "Loaf of bread price today",
      caller_context:
        "Caller asked how much a standard loaf of bread is today — not an offer, just today's price — and Cara didn't want to guess without a catalogue fact.",
      cara_question: "How much is a standard loaf of bread today?",
      occurrence_count: 1,
      last_seen_at: lastWeek,
      created_at: lastWeek,
      updated_at: lastWeek,
    }),
    demoItem({
      id: CARA_TRAINING_DEMO_ITEM_IDS.closingTimeConflict,
      status: "awaiting_answer",
      source: "call_gap",
      call_log_id: demoCallLogId("00a"),
      gap_summary: "Conflicting closing times",
      caller_context:
        "Caller said Google shows 10pm but our sign says 9pm — they wanted to know which is right before driving over.",
      cara_question: "What time do we close — Google says 10pm but the sign says 9pm?",
      occurrence_count: 3,
      last_seen_at: yesterday,
      created_at: twoDaysAgo,
      updated_at: yesterday,
    }),
    demoItem({
      id: CARA_TRAINING_DEMO_ITEM_IDS.butcherSliceDeliHam,
      status: "awaiting_answer",
      source: "call_gap",
      call_log_id: demoCallLogId("00b"),
      gap_summary: "Butcher slicing deli ham",
      caller_context:
        "Caller asked if the butcher counter can slice deli ham they picked up from the chilled aisle — staff on the floor weren't sure which counter handles it.",
      cara_question: "Can the butcher counter slice deli ham from the chilled aisle?",
      occurrence_count: 1,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
    }),
    demoItem({
      id: CARA_TRAINING_DEMO_ITEM_IDS.realRewardsOnAlcohol,
      status: "awaiting_answer",
      source: "call_gap",
      call_log_id: demoCallLogId("00c"),
      gap_summary: "Real Rewards on alcohol",
      caller_context:
        "Caller asked at self-checkout whether Real Rewards points can be used on wine — they were not sure if off-licence is excluded from loyalty.",
      cara_question: "Can Real Rewards points be used on alcohol?",
      occurrence_count: 2,
      last_seen_at: twoDaysAgo,
      created_at: twoDaysAgo,
      updated_at: twoDaysAgo,
    }),
  ];

  return items.map((item, index) => ({
    ...item,
    call_facts: buildTrainingCallFacts(item, {
      created_at: item.last_seen_at,
      duration_seconds: 72 + index * 19,
      caller_number: "+353871234567",
    }),
  }));
}

export function mergeDevelopmentTrainingDemos(
  items: CaraTrainingListItem[],
): CaraTrainingListItem[] {
  if (process.env.NODE_ENV !== "development") return items;

  void items;
  return buildCaraTrainingDemoItems();
}

export function isDemoTrainingItemId(itemId: string): boolean {
  return itemId.startsWith("a1000001-0000-4000-8000-");
}

const DEMO_OVERRIDES_STORAGE_KEY = "cara-training-demo-overrides-v3";

/** Persist local demo-item edits for development UI review. */
export function readDemoTrainingItemOverrides(): Record<
  string,
  CaraTrainingListItem
> {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.sessionStorage.getItem(DEMO_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CaraTrainingListItem>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([id]) => isDemoTrainingItemId(id)),
    );
  } catch {
    return {};
  }
}

export function writeDemoTrainingItemOverrides(
  overrides: Record<string, CaraTrainingListItem>,
): void {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") {
    return;
  }
  const demoOnly = Object.fromEntries(
    Object.entries(overrides).filter(([id]) => isDemoTrainingItemId(id)),
  );
  window.sessionStorage.setItem(
    DEMO_OVERRIDES_STORAGE_KEY,
    JSON.stringify(demoOnly),
  );
}
