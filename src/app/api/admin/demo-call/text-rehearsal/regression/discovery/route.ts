import { NextResponse } from "next/server";

import { requireAdminSessionUser } from "@/lib/admin-session";
import { generateRetailDiscoveryBatch } from "@/lib/retail-discovery-generator";
import {
  persistRetailDiscoveryScenarios,
  promoteRetailDiscoveryScenario,
} from "@/lib/retail-regression-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenerateBody = {
  action: "generate_batch";
  calledNumber?: string;
  generationId?: string;
  batchIndex?: number;
  count?: number;
  avoidExamples?: string[];
};

type PromoteBody = {
  action: "promote";
  calledNumber?: string;
  scenarioId?: string;
};

type Body = GenerateBody | PromoteBody;

async function requireAdmin() {
  try {
    await requireAdminSessionUser();
    return null;
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    if (body.action === "generate_batch") {
      const calledNumber = String(body.calledNumber ?? "").trim();
      const generationId = String(body.generationId ?? "").trim();
      const batchIndex = Number(body.batchIndex ?? -1);
      const count = Number(body.count ?? 0);

      if (
        !calledNumber ||
        !generationId ||
        !Number.isInteger(batchIndex) ||
        batchIndex < 0 ||
        !Number.isInteger(count) ||
        count < 1 ||
        count > 20
      ) {
        return NextResponse.json(
          {
            error:
              "calledNumber, generationId, non-negative batchIndex and count 1-20 are required.",
          },
          { status: 400 },
        );
      }

      const avoidExamples = Array.isArray(body.avoidExamples)
        ? body.avoidExamples.map(String).slice(-40)
        : [];

      const drafts = await generateRetailDiscoveryBatch({
        batchIndex,
        count,
        avoidExamples,
      });
      const scenarios = await persistRetailDiscoveryScenarios({
        calledNumber,
        generationId,
        batchIndex,
        drafts,
      });

      return NextResponse.json({ scenarios });
    }

    if (body.action === "promote") {
      const calledNumber = String(body.calledNumber ?? "").trim();
      const scenarioId = String(body.scenarioId ?? "").trim();
      if (!calledNumber || !scenarioId) {
        return NextResponse.json(
          { error: "calledNumber and scenarioId are required." },
          { status: 400 },
        );
      }

      await promoteRetailDiscoveryScenario({ calledNumber, scenarioId });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Discovery operation failed.";
    const status = message.includes("configured") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
