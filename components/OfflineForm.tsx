"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { addOfflineDraft, formDataToPayload, type OfflineDraftType } from "../lib/offline-drafts";

type OfflineFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  draftType: OfflineDraftType;
  className?: string;
  children: ReactNode;
};

const TYPE_LABELS: Record<OfflineDraftType, string> = {
  customer: "customer",
  invoice: "invoice",
  payment: "payment",
  expense: "expense"
};

export function OfflineForm({ action, draftType, className, children }: OfflineFormProps) {
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (navigator.onLine) return;

    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    const payload = formDataToPayload(new FormData(form));
    await addOfflineDraft(draftType, payload);
    setMessage(`Saved this ${TYPE_LABELS[draftType]} on this device. It will sync when internet returns.`);
  }

  return (
    <>
      {message ? <div className="notice success">{message}</div> : null}
      <form action={action} className={className} onSubmit={handleSubmit}>
        {children}
      </form>
    </>
  );
}
