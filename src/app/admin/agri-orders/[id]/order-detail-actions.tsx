"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { salesVerifyOrder, financeVerifyOrder, approveOrder, rejectOrder, type ActionState } from "@/actions/agri-orders";
import { CheckSquare, DollarSign, CheckCircle2, XCircle, X } from "lucide-react";
import type { OrderPermissions } from "@/lib/order-permissions";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

export function OrderDetailActions({ orderId, status, permissions }: { orderId: string; status: string; permissions: OrderPermissions }) {
  const lang = useLang();
  const [showReject, setShowReject] = useState(false);
  const [showAction, setShowAction] = useState<null | { action: any; label: string; icon: React.ReactNode }>(null);
  if (["completed", "cancelled", "rejected"].includes(status)) return null;

  // Reject should only be offered to whoever's turn it actually is at
  // this exact stage — not to every HQ role that could reject at SOME
  // stage. Otherwise Finance sees "Reject" while Sales still hasn't
  // verified, which is confusing (nothing else to do, no verify shown).
  const canShowReject =
    (status === "submitted" && permissions.canSalesVerify) ||
    (status === "sales_verified" && permissions.canFinanceVerify) ||
    (status === "finance_verified" && permissions.canApprove);

  return (
    <div className="flex flex-wrap gap-2">
      {status === "submitted" && permissions.canSalesVerify && (
        <button
          onClick={() => setShowAction({ action: salesVerifyOrder, label: "Sales Verify Karein", icon: <CheckSquare className="h-3.5 w-3.5" /> })}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700"
        >
          <CheckSquare className="h-3.5 w-3.5" />{t("at_sales_verify", lang)}</button>
      )}
      {status === "sales_verified" && permissions.canFinanceVerify && (
        <button
          onClick={() => setShowAction({ action: financeVerifyOrder, label: "Finance Verify Karein", icon: <DollarSign className="h-3.5 w-3.5" /> })}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700"
        >
          <DollarSign className="h-3.5 w-3.5" />{t("at_finance_verify", lang)}</button>
      )}
      {status === "finance_verified" && permissions.canApprove && (
        <button
          onClick={() => setShowAction({ action: approveOrder, label: "Order Approve Karein", icon: <CheckCircle2 className="h-3.5 w-3.5" /> })}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />{t("at_approve_order", lang)}</button>
      )}
      {canShowReject && (
        <button onClick={() => setShowReject(true)} className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100">
          <XCircle className="h-3.5 w-3.5" />{t("at_reject", lang)}</button>
      )}
      {showReject && <RejectModal orderId={orderId} onClose={() => setShowReject(false)} />}
      {showAction && (
        <ActionCommentModal orderId={orderId} action={showAction.action} label={showAction.label} onClose={() => setShowAction(null)} />
      )}
    </div>
  );
}

function ActionCommentModal({ orderId, action, label, onClose }: { orderId: string; action: any; label: string; onClose: () => void }) {
  const lang = useLang();
  const router = useRouter();
  const [state, formAction] = useFormState(action, initialState);

  useEffect(() => {
    if (state.success) {
      router.refresh();
      const timer = setTimeout(onClose, 800);
      return () => clearTimeout(timer);
    }
  }, [state.success]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{label}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="order_id" value={orderId} />
          <textarea name="comment" rows={3} placeholder={t("ac_comment_optional", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <ConfirmButton label={label} />
        </form>
      </div>
    </div>
  );
}

function RejectModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const lang = useLang();
  const router = useRouter();
  const [state, formAction] = useFormState(rejectOrder, initialState);

  useEffect(() => {
    if (state.success) {
      router.refresh();
      const timer = setTimeout(onClose, 800);
      return () => clearTimeout(timer);
    }
  }, [state.success]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("ac_reject_order", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="order_id" value={orderId} />
          <textarea name="rejection_reason" required rows={3} placeholder={t("c_reject_reason", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <button type="submit" className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700">{t("c_confirm_reject", lang)}</button>
        </form>
      </div>
    </div>
  );
}

function ConfirmButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {pending ? "..." : label}
    </button>
  );
}