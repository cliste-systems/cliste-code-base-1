import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { loadAdminClientDetail } from "@/lib/load-admin-clients";

import { loadCaraTrainingData } from "@/app/(admin)/admin/organizations/[id]/cara-training/cara-training-actions";
import { CaraTrainingShell } from "./cara-training-shell";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orgId: string }>;
};

export default async function ClientCaraTrainingPage({ params }: PageProps) {
  const { orgId } = await params;

  const client = await loadAdminClientDetail(orgId);
  if (!client) notFound();
  if (client.provisionSource !== "managed") notFound();

  const data = await loadCaraTrainingData(orgId);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <div>
        <Link
          href={`/admin/customers/${orgId}`}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Back to customer
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Train Cara — {data.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Structured training fields compile into the worker prompt. Do not edit
          raw system instructions elsewhere.
        </p>
      </div>
      <CaraTrainingShell initial={data} />
    </div>
  );
}
