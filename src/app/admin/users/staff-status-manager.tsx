"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { suspendStaff, reactivateStaff, deleteStaff, type ActionState } from "@/actions/users";
import { AlertTriangle, X } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function StaffStatusManager({ userId, status }: { userId: string; status: string }) {
  const lang = useLang();
  const [modalAction, setModalAction] = useState<"suspend" | "delete" | null>(null);

  if (status === "active") {
    return (
      <div className="flex gap-1.5">
        <button onClick={() => setModalAction("suspend")} className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100">{t("at_suspend", lang)}</button>
        <button onClick={() => setModalAction("delete")} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">{t("at_withdraw", lang)}</button>
        {modalAction && <ReasonModal userId={userId} action={modalAction} onClose={() => setModalAction(null)} />}
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      <ReactivateForm userId={userId} />
      <button onClick={() => setModalAction("delete")} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">{t("at_withdraw", lang)}</button>
      {modalAction === "delete" && <ReasonModal userId={userId} action="delete" onClose={() => setModalAction(null)} />}
    </div>
  );
}

function ReasonModal({ userId, action, onClose }: { userId: string; action: "suspend" | "delete"; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(action === "suspend" ? suspendStaff : deleteStaff, initialState);
  if (state.success) setTimeout(onClose, 600);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 font-display text-base font-semibold text-surface-900">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> {action === "suspend" ? "Staff Suspend Karein" : "Staff Nikalein"}
          </h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="user_id" value={userId} />
          <label className="text-xs font-medium text-surface-600">{t("br_reason_field", lang)}</label>
          <textarea name="reason" required rows={3} placeholder={t("us_reason_eg", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton label={action === "suspend" ? "Suspend Karein" : "Nikal Dein"} />
        </form>
      </div>
    </div>
  );
}

function ReactivateForm({ userId }: { userId: string }) {
  const lang = useLang();
  const [, formAction] = useFormState(reactivateStaff, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="user_id" value={userId} />
      <button type="submit" className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700">{t("at_reactivate", lang)}</button>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : label}</button>;
}