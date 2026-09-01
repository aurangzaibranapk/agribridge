"use client";
import { useFormState, useFormStatus } from "react-dom";
import { approveTransfer, rejectTransfer, type ActionState } from "@/actions/inventory";
import { Check, X } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function TransferActions({ transferId }: { transferId: string }) {
  const [approveState, approveAction] = useFormState(approveTransfer, initialState);
  const [rejectState, rejectAction] = useFormState(rejectTransfer, initialState);

  return (
    <div className="flex items-center gap-2">
      <form action={approveAction}>
        <input type="hidden" name="transfer_id" value={transferId} />
        <ApproveButton />
      </form>
      <form action={rejectAction}>
        <input type="hidden" name="transfer_id" value={transferId} />
        <RejectButton />
      </form>
      {approveState.error && <p className="text-xs text-red-600">{approveState.error}</p>}
      {rejectState.error && <p className="text-xs text-red-600">{rejectState.error}</p>}
    </div>
  );
}

function ApproveButton() {
  const lang = useLang();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      <Check className="h-3.5 w-3.5" /> {t("st_approve", lang)}
    </button>
  );
}

function RejectButton() {
  const lang = useLang();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60 dark:bg-red-950/30 dark:text-red-300"
    >
      <X className="h-3.5 w-3.5" /> {t("st_reject", lang)}
    </button>
  );
}