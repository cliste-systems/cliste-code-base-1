/**
 * Fill Train Cara knowledge for Bloom Beauty Studio (salon test account).
 *
 *   npx tsx scripts/complete-bloom-train-cara.ts [--org <uuid>] [--email <signup-email>]
 */

import "./mock-server-only.ts";
import { config } from "dotenv";

config({ path: ".env.local" });

import { ensureSalonBookingRouteInPayload } from "../src/app/(onboarding)/onboarding/knowledge/ensure-salon-booking-route";
import type { CaraHandleOptionId } from "../src/app/(onboarding)/onboarding/knowledge/train-cara-constants";
import { serializeRoutes } from "../src/app/(dashboard)/dashboard/routing/route-models";
import { syncServiceNamesToBoundary, upsertServiceForOrg } from "../src/lib/service-catalog";
import { createAdminClient } from "../src/utils/supabase/admin";

const ONBOARDING_NUMBER_STEP = 4;

const DEFAULT_EMAIL = "bloom-beauty-5cf8f1@cliste.test";
const BOOKING_URL = "https://www.fresha.com/a/bloom-beauty-studio-dublin";
const OWNER_PHONE = "+353871234567";

const SERVICES = [
  { name: "Ladies Cut", category: "Hair", price: 45, durationMinutes: 45 },
  { name: "Gents Cut", category: "Hair", price: 32, durationMinutes: 30 },
  { name: "Blow-dry", category: "Hair", price: 35, durationMinutes: 30 },
  { name: "Full Colour", category: "Colour", price: 95, durationMinutes: 120 },
  { name: "Balayage", category: "Colour", price: 120, durationMinutes: 150 },
  { name: "Root Touch-up", category: "Colour", price: 65, durationMinutes: 60 },
  { name: "Gel Manicure", category: "Nails", price: 38, durationMinutes: 45 },
  { name: "Lash Lift", category: "Beauty", price: 55, durationMinutes: 60 },
  { name: "Brow Shape", category: "Beauty", price: 18, durationMinutes: 15 },
] as const;

function parseArgs() {
  const args = process.argv.slice(2);
  let orgId = "";
  let email = DEFAULT_EMAIL;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--org" && args[i + 1]) orgId = args[++i];
    if (args[i] === "--email" && args[i + 1]) email = args[++i];
  }
  return { orgId, email };
}

async function resolveOrgId(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  email: string,
): Promise<string> {
  if (orgId) return orgId;

  const { data: users } = await admin.auth.admin.listUsers();
  const user = users.users.find((u) => u.email === email);
  if (!user?.id) throw new Error(`No auth user for ${email}`);

  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.organization_id) {
    throw new Error(`No organization for ${email}`);
  }
  return profile.organization_id as string;
}

async function main() {
  const { orgId: argOrgId, email } = parseArgs();
  const admin = createAdminClient();
  const organizationId = await resolveOrgId(admin, argOrgId, email);
  const now = new Date().toISOString();

  for (const service of SERVICES) {
    await upsertServiceForOrg(admin, organizationId, {
      name: service.name,
      category: service.category,
      price: service.price,
      durationMinutes: service.durationMinutes,
      source: "manual",
      description: null,
      policyFlags: [],
      aiVoiceNotes: null,
    });
  }

  const catalog = await import("../src/lib/service-catalog").then((m) =>
    m.listServicesForOrg(admin, organizationId),
  );
  const servicesOffered = syncServiceNamesToBoundary(catalog);

  const businessDescription =
    "Full-service hair and beauty salon in Dublin city centre — cuts, colour, balayage, blow-dries, gel nails, lash lifts, and express facials. Appointment-based with walk-ins welcome when a stylist is free.";
  const knowledgeSummary =
    "Bloom Beauty Studio is a busy city-centre salon focused on appointment-based hair and beauty services. Walk-ins are welcome when a stylist is free, but booking is recommended for colour and longer treatments.";
  const hours =
    "Tuesday–Friday 9:00–18:00, Saturday 9:00–17:00. Closed Sunday and Monday.";
  const exclusions =
    "We don't do tattoos, wet shaves, or mobile home visits.";
  const faqs = [
    {
      question: "Do you take walk-ins?",
      answer:
        "Yes when a stylist is free, but we recommend booking for colour or longer appointments.",
    },
    {
      question: "Is there parking nearby?",
      answer:
        "Street parking on Grafton Street and paid car parks on Stephen's Green within a few minutes' walk.",
    },
    {
      question: "What is your cancellation policy?",
      answer:
        "Please give at least 24 hours notice so we can offer the slot to another client.",
    },
    {
      question: "Do I need a consultation for colour?",
      answer:
        "A quick consultation is included with full colour and balayage appointments.",
    },
  ];
  const captureFields = [
    { id: "name", label: "Name" },
    { id: "phone", label: "Phone number" },
    { id: "preferred_service", label: "Preferred service" },
    { id: "preferred_day", label: "Preferred day" },
    { id: "preferred_time", label: "Preferred time" },
    { id: "stylist", label: "Stylist preference" },
    { id: "first_visit", label: "First visit?" },
  ];
  const handleOptions: CaraHandleOptionId[] = [
    "answer_common_questions",
    "take_message",
    "send_link",
  ];

  const ensured = ensureSalonBookingRouteInPayload({
    routes: [],
    linkUrl: BOOKING_URL,
    captureFields,
    handleOptions,
    niche: "hair_salon",
    businessType: "Salon & Beauty — hair, nails and lashes",
  });

  const routingLinks = serializeRoutes(ensured.routes);

  const { error } = await admin
    .from("organizations")
    .update({
      agent_business_type: "Salon & Beauty — hair, nails and lashes",
      raw_business_description: businessDescription,
      business_knowledge_summary: knowledgeSummary,
      agent_services_departments: servicesOffered,
      agent_services_not_offered: exclusions,
      agent_opening_hours: hours,
      agent_faqs: faqs,
      agent_capture_fields: captureFields,
      agent_details_to_collect:
        "Name, phone, preferred service, day and time, stylist preference, first visit.",
      cara_handle_options: ensured.handleOptions,
      routing_links: routingLinks,
      notification_email: email,
      notification_phone: OWNER_PHONE,
      fallback_number: OWNER_PHONE,
      call_routing_mode: "cliste_number",
      train_cara_step: null,
      onboarding_step: ONBOARDING_NUMBER_STEP,
      updated_at: now,
    })
    .eq("id", organizationId);

  if (error) throw new Error(error.message);

  console.log("\n✓ Train Cara data saved\n");
  console.log(`  Org ID:    ${organizationId}`);
  console.log(`  Email:     ${email}`);
  console.log(`  Services:  ${catalog.length} catalog items`);
  console.log(`  Routes:    ${routingLinks.length}`);
  console.log(`  Step:      ${ONBOARDING_NUMBER_STEP} (number)\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
