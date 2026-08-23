"use client";

import { useCallback } from "react";

import { StoreDepartmentsEditor } from "@/components/store-departments/store-departments-editor";

import {
  saveCaraTrainingDepartments,
  type CaraTrainingData,
} from "@/app/(admin)/admin/organizations/[id]/cara-training/cara-training-actions";

import { SectionCard } from "./section-card";

type Props = {
  data: CaraTrainingData;
  onChange: (patch: Partial<CaraTrainingData>) => void;
  onSaved: () => Promise<void>;
};

export function DepartmentsSection({ data, onChange, onSaved }: Props) {
  const handleSave = useCallback(async () => {
    const result = await saveCaraTrainingDepartments(
      data.organizationId,
      data.departments,
    );
    if (!result.ok) return result;
    await onSaved();
    return result;
  }, [data.departments, data.organizationId, onSaved]);

  return (
    <SectionCard
      title="3. Departments"
      description="Structured departments sync to routing links and the compiled prompt."
    >
      <StoreDepartmentsEditor
        departments={data.departments}
        canTransfer={data.canTransfer}
        onChange={(departments) =>
          onChange({ departments: departments as CaraTrainingData["departments"] })
        }
        onSave={handleSave}
      />
    </SectionCard>
  );
}
