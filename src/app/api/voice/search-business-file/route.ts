import { NextResponse } from "next/server";

import {
  BUSINESS_FILE_SEARCH_MAX_QUERY_CHARS,
  parseBusinessFileSearchDocumentKind,
  searchOrgBusinessFiles,
} from "@/lib/business-file-search";
import { normalizeCustomerPhoneE164 } from "@/lib/booking-reference";
import {
  authorizeVoiceWebhook,
  voiceWebhookNoSecretResponse,
  voiceWebhookUnauthorizedResponse,
} from "@/lib/voice-webhook-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

type SearchBusinessFileBody = {
  called_number?: string;
  query?: string;
  file_id?: string;
  document_kind?: string;
};

/**
 * Voice worker: search uploaded business files for relevant excerpts.
 * Cara uses this during calls to answer specific menu/price questions without
 * reading entire documents aloud.
 */
export async function POST(request: Request) {
  const auth = await authorizeVoiceWebhook(request);
  if (auth === "no_secret") return voiceWebhookNoSecretResponse();
  if (auth === "bad") return voiceWebhookUnauthorizedResponse();

  let body: SearchBusinessFileBody;
  try {
    body = (await request.json()) as SearchBusinessFileBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const calledNumberRaw = String(body.called_number ?? "").trim();
  if (!calledNumberRaw) {
    return NextResponse.json(
      { ok: false, error: "called_number is required" },
      { status: 400 },
    );
  }

  const query = String(body.query ?? "").trim();
  if (!query) {
    return NextResponse.json(
      { ok: false, error: "query is required" },
      { status: 400 },
    );
  }
  if (query.length > BUSINESS_FILE_SEARCH_MAX_QUERY_CHARS) {
    return NextResponse.json(
      {
        ok: false,
        error: `query must be at most ${BUSINESS_FILE_SEARCH_MAX_QUERY_CHARS} characters`,
      },
      { status: 400 },
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Server configuration error",
      },
      { status: 503 },
    );
  }

  const calledE164 =
    normalizeCustomerPhoneE164(calledNumberRaw) || calledNumberRaw;
  const { data: phoneRow, error: phoneErr } = await admin
    .from("phone_numbers")
    .select("organization_id")
    .eq("e164", calledE164)
    .maybeSingle();

  if (phoneErr) {
    console.error("[voice/search-business-file] phone lookup", phoneErr);
    return NextResponse.json(
      { ok: false, error: "Database error" },
      { status: 500 },
    );
  }
  if (!phoneRow?.organization_id) {
    return NextResponse.json(
      {
        ok: false,
        error: `called_number ${calledE164} is not assigned to any organization`,
      },
      { status: 404 },
    );
  }

  const orgId = phoneRow.organization_id as string;

  const { data: orgRow } = await admin
    .from("organizations")
    .select("is_active")
    .eq("id", orgId)
    .maybeSingle();
  if (!orgRow?.is_active) {
    return NextResponse.json(
      { ok: false, code: "org_suspended", error: "Organization is not active" },
      { status: 403 },
    );
  }

  const fileId = String(body.file_id ?? "").trim() || undefined;
  const documentKind = parseBusinessFileSearchDocumentKind(body.document_kind);

  const matches = await searchOrgBusinessFiles(admin, orgId, {
    query,
    fileId,
    documentKind,
  });

  return NextResponse.json({
    ok: true,
    matches: matches.map((match) => ({
      file_id: match.fileId,
      file_name: match.fileName,
      document_kind: match.documentKind,
      excerpts: match.excerpts.map((excerpt) => ({
        text: excerpt.text,
        score: excerpt.score,
        start_line: excerpt.startLine,
        end_line: excerpt.endLine,
      })),
    })),
  });
}
