import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const GIF = Uint8Array.from([
  71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 0, 0, 0, 255, 255, 255,
  33, 249, 4, 1, 0, 0, 0, 0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 68, 1,
  0, 59,
]);

function gifResponse() {
  return new Response(GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(GIF.byteLength),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return gifResponse();
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return gifResponse();
  }

  try {
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const serviceKey =
      secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    if (!serviceKey || !supabaseUrl) return gifResponse();

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: message } = await admin
      .from("admin_email_messages")
      .select("resend_email_id,direction,opened_at")
      .eq("open_tracking_token", token)
      .eq("direction", "outbound")
      .maybeSingle();

    if (!message || message.opened_at) return gifResponse();

    const openedAt = new Date().toISOString();

    await admin
      .from("admin_email_messages")
      .update({
        opened_at: openedAt,
        last_delivery_event: "email.opened",
        last_delivery_event_at: openedAt,
        updated_at: openedAt,
      })
      .eq("open_tracking_token", token)
      .is("opened_at", null);

    await admin.from("admin_email_events").upsert(
      {
        id: `firstparty-open-${token}`,
        resend_email_id: message.resend_email_id,
        event_type: "email.opened",
        occurred_at: openedAt,
        payload: {
          type: "email.opened",
          source: "hellocara_tracking_pixel",
        },
      },
      { onConflict: "id" },
    );
  } catch {
    // Tracking must never break the recipient's email rendering.
  }

  return gifResponse();
});
