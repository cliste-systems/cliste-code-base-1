/**
 * Upload salon price-list PDF and wire brochure route for test account.
 *
 *   npx tsx scripts/upload-salon-price-list.ts --email bloom-beauty-5cf8f1@cliste.test
 */

import "./mock-server-only.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";

config({ path: ".env.local" });

import {
  createRouteFromTemplate,
  ensureAccountRoutes,
  routesFromStoredLinks,
  serializeRoutes,
  type SavedRoute,
} from "../src/app/(dashboard)/dashboard/routing/route-models";
import { ROUTE_TEMPLATE_BY_ID } from "../src/app/(dashboard)/dashboard/routing/route-templates";
import { parseRoutingLinks } from "../src/app/(dashboard)/dashboard/routing/routing-links";
import {
  updateBusinessFileTogglesForOrg,
  uploadBusinessFileForOrg,
} from "../src/lib/business-files-server";
import { createAdminClient } from "../src/utils/supabase/admin";

const PDF_PATH = resolve(
  process.cwd(),
  "fixtures/salon-test/bloom-beauty-price-list.pdf",
);
const DEFAULT_EMAIL = "bloom-beauty-5cf8f1@cliste.test";

function parseArgs() {
  const args = process.argv.slice(2);
  let email = DEFAULT_EMAIL;
  let orgId = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) email = args[++i];
    if (args[i] === "--org" && args[i + 1]) orgId = args[++i];
  }
  return { email, orgId };
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
  if (!profile?.organization_id) throw new Error(`No org for ${email}`);
  return profile.organization_id as string;
}

async function main() {
  const { email, orgId: argOrgId } = parseArgs();
  const admin = createAdminClient();
  const organizationId = await resolveOrgId(admin, argOrgId, email);
  const buffer = readFileSync(PDF_PATH);
  const file = new File([buffer], "bloom-beauty-price-list.pdf", {
    type: "application/pdf",
  });

  const upload = await uploadBusinessFileForOrg({
    organizationId,
    file,
    documentKind: "price_list",
    hasServiceCatalog: true,
    hasFaqs: true,
  });

  if (!upload.ok) throw new Error(upload.message);

  const toggles = await updateBusinessFileTogglesForOrg(
    admin,
    organizationId,
    upload.file.id,
    { answerEnabled: true, sendEnabled: true },
  );
  if (!toggles.ok) throw new Error(toggles.message);

  const { data: org } = await admin
    .from("organizations")
    .select("routing_links")
    .eq("id", organizationId)
    .single();

  const existingRoutes = routesFromStoredLinks(
    parseRoutingLinks(org?.routing_links),
  );
  const hasBrochure = existingRoutes.some(
    (route) =>
      route.templateId === "brochure" &&
      route.active &&
      route.businessFileId === upload.file.id,
  );

  let routes: SavedRoute[] = existingRoutes;
  if (!hasBrochure) {
    const template = ROUTE_TEMPLATE_BY_ID.get("brochure");
    if (!template) throw new Error("Brochure template missing.");
    const brochureRoute = {
      ...createRouteFromTemplate(template),
      name: "Price list",
      keywords: "price list, prices, menu, brochure, services",
      businessFileId: upload.file.id,
      active: true,
    };
    routes = ensureAccountRoutes([...existingRoutes, brochureRoute]);
  }

  const routingLinks = serializeRoutes(routes);
  const { error } = await admin
    .from("organizations")
    .update({
      routing_links: routingLinks,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) throw new Error(error.message);

  console.log("\n✓ Price list uploaded and routed\n");
  console.log(`  File ID:   ${upload.file.id}`);
  console.log(`  Routes:    ${routingLinks.length}`);
  console.log(`  Extracted: ${upload.file.processingStatus}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
