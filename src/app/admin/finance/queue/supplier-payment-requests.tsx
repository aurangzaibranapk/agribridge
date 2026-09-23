"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { requestSupplierPayment, approveSupplierPayment, rejectSupplierPayment, type ActionState } from "@/actions/supplier-payment-requests";
import { X, CheckCircle2, XCircle, FileText, Plus } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Supplier {
  id: string;
  name: string;
}

interface PaymentRequest {
  id: string;
  request_number: string;
  supplier_name: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  slip_url: string | null;
  status: string;
  rejection_reason: string | null;
}

export function SupplierPaymentRequests({
  requests,
  suppliers,
  canRequest,
  canApprove,
}: {
  requests: PaymentRequest[];
  suppliers: Supplier[];
  canRequest: boolean;
  canApprove: boolean;
}) {
  const lang = useLang();
  const [showRequest, setShowRequest] = useState(false);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-surface-900 dark:text-white">{t("fq_supplier_requests", lang)} ({requests.length})</h2>
        {canRequest && (
          <button onClick={() => setShowRequest(true)} className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            <Plus className="h-3.5 w-3.5" /> {t("fq_request_payment", lang)}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        {requests.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-surface-400">{t("fq_no_request_pending", lang)}</p>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="border-b border-surface-100 px-4 py-3 last:border-0 dark:border-surface-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-surface-900 dark:text-white">{r.supplier_name}</p>
                  <p className="text-xs text-surface-400">{r.request_number} | {r.payment_method}</p>
                  {r.notes && <p className="text-xs text-surface-500">{r.notes}</p>}
                  {r.slip_url && (
                    <a href={r.slip_url} target="_blank" rel="noopener noreferrer" className="mt-0.5 flex items-center gap-1 text-xs text-brand-600 hover:underline">
                      <FileText className="h-3 w-3" /> {t("fq_view_slip", lang)}
                    </a>
                  )}
                  {r.rejection_reason && <p className="mt-1 text-xs text-red-600">{t("fq_reject_reason_label", lang)}: {r.rejection_reason}</p>}
                </div>
                <p className="text-sm font-semibold text-surface-900 dark:text-white">Rs {r.amount.toLocaleString()}</p>
              </div>
              {canApprove && r.status === "pending" && <ApproveRejectButtons requestId={r.id} />}
            </div>
          ))
        )}
      </div>

      {showRequest && <RequestPaymentModal suppliers={suppliers} onClose={() => setShowRequest(false)} />}
    </div>
  );
}

function ApproveRejectButtons({ requestId }: { requestId: string }) {
  const lang = useLang();
  const [showReject, setShowReject] = useState(false);
  const [, approveAction] = useFormState(approveSupplierPayment, initialState);

  return (
    <div className="mt-2 flex gap-2">
      <form action={approveAction}>
        <input type="hidden" name="request_id" value={requestId} />
        <button type="submit" className="flex items-center gap-1 rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3" /> {t("fq_approve", lang)}
        </button>
      </form>
      <button onClick={() => setShowReject(true)} className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">
        <XCircle className="h-3 w-3" /> {t("fq_reject", lang)}
      </button>
      {showReject && <RejectModal requestId={requestId} onClose={() => setShowReject(false)} />}
    </div>
  );
}

function RejectModal({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(rejectSupplierPayment, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("fq_reject_request_title", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="request_id" value={requestId} />
          <textarea name="rejection_reason" required rows={3} placeholder={t("fq_reject_reason_ph", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <button type="submit" className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700">{t("fq_confirm_reject", lang)}</button>
        </form>
      </div>
    </div>
  );
}

function RequestPaymentModal({ suppliers, onClose }: { suppliers: Supplier[]; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(requestSupplierPayment, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("fq_request_title", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-2 text-xs text-surface-400">{t("fq_request_note", lang)}</p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} encType="multipart/form-data" className="space-y-2">
          <select name="supplier_id" required className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="">{t("fq_pick_supplier", lang)}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select name="payment_method" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="Bank Transfer">{t("fq_bank_transfer", lang)}</option>
            <option value="Cash">{t("fn_cash", lang)}</option>
            <option value="Online Payment">{t("fq_online_payment", lang)}</option>
            <option value="Cheque">{t("fq_cheque", lang)}</option>
          </select>
          <input type="number" step="0.01" name="amount" required placeholder={t("fn_amount_rs", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <textarea name="notes" rows={2} placeholder={t("fn_notes_optional", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <div>
            <label className="text-xs text-surface-500">{t("fq_upload_slip", lang)}</label>
            <input type="file" name="slip" accept="image/*,application/pdf" className="mt-1 w-full text-xs" />
          </div>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const lang = useLang();
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : t("fq_send_request", lang)}</button>;
}