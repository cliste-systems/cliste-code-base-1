"use client";

import { useCallback } from "react";

import { StoreContactsEditor } from "@/components/store-contacts/store-contacts-editor";

import {
  saveCaraTrainingContacts,
  type CaraTrainingData,
} from "@/app/(admin)/admin/organizations/[id]/cara-training/cara-training-actions";

import { SectionCard } from "./section-card";

type Props = {
  data: CaraTrainingData;
  onChange: (patch: Partial<CaraTrainingData>) => void;
  onSaved: () => Promise<void>;
};

export function PeopleEscalationSection({ data, onChange, onSaved }: Props) {
  const handleSave = useCallback(async () => {
    const result = await saveCaraTrainingContacts(
      data.organizationId,
      data.contacts,
    );
    if (!result.ok) return result;
    await onSaved();
    return result;
  }, [data.contacts, data.organizationId, onSaved]);

  return (
    <SectionCard
      title="4. People & escalation"
      description="Store contacts for notifications and internal transfers — never spoken to callers."
    >
      <StoreContactsEditor
        contacts={data.contacts}
        onChange={(contacts) =>
          onChange({ contacts: contacts as CaraTrainingData["contacts"] })
        }
        onSave={handleSave}
      />
    </SectionCard>
  );
}
