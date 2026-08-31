"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { convertInquiryToDealer, type ActionState } from "@/actions/dealers";
import { Button, Input, Label } from "@/components/ui/form";
import { UserPlus, X } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function ConvertDealerButton({
  inquiryId,
  suggestedName,
  suggestedPhone,
  suggestedEmail,
}: {
  inquiryId: string;
  suggestedName: string;
  suggestedPhone: string | null;
  suggestedEmail: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
      >
        <UserPlus className="h-3.5 w-3.5" /> Convert to Dealer
      </button>
      {open && (
        <ConvertModal
          inquiryId={inquiryId}
          suggestedName={suggestedName}
          suggestedPhone={suggestedPhone}
          suggestedEmail={suggestedEmail}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ConvertModal({
  inquiryId,
  suggestedName,
  suggestedPhone,
  suggestedEmail,
  onClose,
}: {
  inquiryId: string;
  suggestedName: string;
  suggestedPhone: string | null;
  suggestedEmail: string | null;
  onClose: () => void;
}) {
  const [state, formAction] = useFormState(convertInquiryToDealer, initialState);
  const lang = useLang();

  if (state.success) {
    setTimeout(onClose, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("ii_create_dealer", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        {state.error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>
        )}
        {state.success && (
          <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            Dealer created! An invite email was sent to set their password.
          </p>
        )}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="inquiry_id" value={inquiryId} />
          <div>
            <Label>Business Name *</Label>
            <Input name="business_name" defaultValue={suggestedName} required />
          </div>
          <div>
            <Label>Email * (invite sent here)</Label>
            <Input name="email" type="email" defaultValue={suggestedEmail ?? ""} required />
          </div>
          <div>
            <Label>Phone *</Label>
            <Input name="phone" defaultValue={suggestedPhone ?? ""} required />
          </div>
          <div>
            <Label>{t("c_district", lang)}</Label>
            <Input name="district" />
          </div>
          <div>
            <Label>{t("c_tehsil", lang)}</Label>
            <Input name="tehsil" />
          </div>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Creating..." : "Create Dealer & Send Invite"}</Button>;
}