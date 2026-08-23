import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { loadCaraTrainingData } from "./cara-training-actions";
import { CaraTrainingForm } from "./cara-training-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CaraTrainingPage({ params }: PageProps) {
  const { id } = await params;
  const data = await loadCaraTrainingData(id);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8">
      <div>
        <Link
          href={`/admin/organizations/${id}`}
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-medium"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Back to store
        </Link>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Train Cara — {data.name}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Structured training fields compile into the worker prompt. Do not edit
          raw system instructions elsewhere.
        </p>
      </div>
      <CaraTrainingForm initial={data} />
    </div>
  );
}
