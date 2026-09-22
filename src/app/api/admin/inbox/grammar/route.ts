import { NextResponse } from "next/server";

import { requireAdminSessionUser } from "@/lib/admin-session";
import { completeOpenRouterChat } from "@/lib/openrouter-chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireAdminSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { text?: string };
  try {
    body = (await request.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const original = body.text?.trim() ?? "";
  if (!original) {
    return NextResponse.json(
      { error: "Write the email before checking grammar." },
      { status: 400 },
    );
  }
  if (original.length > 20_000) {
    return NextResponse.json({ error: "Email is too long." }, { status: 400 });
  }

  try {
    const raw = await completeOpenRouterChat({
      temperature: 0,
      maxTokens: Math.min(4000, Math.max(512, Math.ceil(original.length * 1.5))),
      messages: [
        {
          role: "system",
          content: [
            "Proofread an email draft using Irish/British English.",
            "ONLY correct spelling, grammar, punctuation, capitalisation, and obvious typing mistakes.",
            "Preserve the writer's exact meaning, facts, tone, level of formality, greeting, sign-off, paragraph order, names, numbers, URLs, and email addresses.",
            "Do not make the writing more persuasive, polished, friendly, concise, professional, or detailed.",
            "Do not add or remove any idea.",
            "Do not replace ordinary wording merely because another phrase sounds better.",
            "Do not use em dashes or en dashes unless they already appear in the draft.",
            "Return ONLY valid JSON in this exact shape: {\"text\":\"corrected draft\"}.",
          ].join(" "),
        },
        { role: "user", content: original },
      ],
    });

    const parsed = JSON.parse(raw) as { text?: unknown };
    const suggested =
      typeof parsed.text === "string" && parsed.text.trim()
        ? parsed.text.trim()
        : original;

    return NextResponse.json({
      ok: true,
      original,
      suggested,
      changed: suggested !== original,
    });
  } catch (error) {
    console.warn("[admin-inbox] grammar_review_failed", error);
    return NextResponse.json(
      { error: "AI grammar check failed. Try again." },
      { status: 500 },
    );
  }
}
