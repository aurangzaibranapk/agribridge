"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { convertInquiryToInvestor, type ActionState } from "@/actions/investors";
import { Button, Input, Label, Select } from "@/components/ui/form";
import { UserPlus, X } from "lucide-react";

const initialState: ActionState = {};

export function ConvertInvestorButton({
  inquiryId,
  suggestedName,
  suggestedPhone,
  suggestedEmail,
  suggestedDealType,
}: {
  inquiryId: string;
  suggestedName: string;
  suggestedPhone: string | null;
  suggestedEmail: string | null;
  suggestedDealType: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg bg-purple-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-purple-700"
      >
        <UserPlus className="h-3.5 w-3.5" /> Convert to Investor
      </button>
      {open && (
        <ConvertModal
          inquiryId={inquiryId}
          suggestedName={suggestedName}
          suggestedPhone={suggestedPhone}
          suggestedEmail={suggestedEmail}
          suggestedDealType={suggestedDealType}
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
  suggestedDealType,
  onClose,
}: {
  inquiryId: string;
  suggestedName: string;
  suggestedPhone: string | null;
  suggestedEmail: string | null;
  suggestedDealType: string | null;
  onClose: () => void;
}) {
  const [state, formAction] = useFormState(convertInquiryToInvestor, initialState);

  if (state.success) {
    setTimeout(onClose, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">Create Investor Account</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        {state.error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>
        )}
        {state.success && (
          <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            Investor created! An invite email was sent to set their password.
          </p>
        )}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="inquiry_id" value={inquiryId} />
          <div>
            <Label>Full Name *</Label>
            <Input name="full_name" defaultValue={suggestedName} required />
          </div>
          <div>
            <Label>Email * (invite sent here)</Label>
            <Input name="email" type="email" defaultValue={suggestedEmail ?? ""} required />
          </div>
          <div>
            <Label>Phone</Label>
            <Input name="phone" defaultValue={suggestedPhone ?? ""} />
          </div>
          <div>
            <Label>Deal Type</Label>
            <Select name="deal_type" defaultValue={suggestedDealType ?? "product_investment"}>
              <option value="product_investment">Product Investment</option>
              <option value="dairy_investment">Dairy & Livestock</option>
              <option value="franchise">Franchise</option>
            </Select>
          </div>
          <div>
            <Label>Investment Amount (Rs.) *</Label>
            <Input name="amount_invested" type="number" step="0.01" required />
          </div>
          <div>
            <Label>Profit Share % *</Label>
            <Input name="profit_share_percentage" type="number" step="0.01" placeholder="e.g. 15" required />
          </div>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Creating..." : "Create Investor & Send Invite"}</Button>;
}