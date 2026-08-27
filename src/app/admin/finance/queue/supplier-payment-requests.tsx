"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { requestSupplierPayment, approveSupplierPayment, rejectSupplierPayment, type ActionState } from "@/actions/supplier-payment-requests";
import { X, CheckCircle2, XCircle, FileText, Plus } from "lucide-react";

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
  const [showRequest, setShowRequest] = useState(false);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-surface-900 dark:text-white">Supplier Payment Requests ({requests.length})</h2>
        {canRequest && (
          <button onClick={() => setShowRequest(true)} className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            <Plus className="h-3.5 w-3.5" /> Payment Request Karein
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        {requests.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-surface-400">Koi payment request pending nahi hai.</p>
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
                      <FileText className="h-3 w-3" /> Slip Dekhein
                    </a>
                  )}
                  {r.rejection_reason && <p className="mt-1 text-xs text-red-600">Reject Wajah: {r.rejection_reason}</p>}
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
  const [showReject, setShowReject] = useState(false);
  const [, approveAction] = useFormState(approveSupplierPayment, initialState);

  return (
    <div className="mt-2 flex gap-2">
      <form action={approveAction}>
        <input type="hidden" name="request_id" value={requestId} />
        <button type="submit" className="flex items-center gap-1 rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3" /> Approve Karein
        </button>
      </form>
      <button onClick={() => setShowReject(true)} className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">
        <XCircle className="h-3 w-3" /> Reject Karein
      </button>
      {showReject && <RejectModal requestId={requestId} onClose={() => setShowReject(false)} />}
    </div>
  );
}

function RejectModal({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const [state, formAction] = useFormState(rejectSupplierPayment, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Payment Request Reject Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="request_id" value={requestId} />
          <textarea name="rejection_reason" required rows={3} placeholder="Reject karne ki wajah" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <button type="submit" className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700">Confirm Reject</button>
        </form>
      </div>
    </div>
  );
}

function RequestPaymentModal({ suppliers, onClose }: { suppliers: Supplier[]; onClose: () => void }) {
  const [state, formAction] = useFormState(requestSupplierPayment, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Payment Request Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-2 text-xs text-surface-400">Ye request Admin/Owner ki approval ke baad hi payment ban jayegi.</p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} encType="multipart/form-data" className="space-y-2">
          <select name="supplier_id" required className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="">- Supplier Select Karein -</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select name="payment_method" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cash">Cash</option>
            <option value="Online Payment">Online Payment</option>
            <option value="Cheque">Cheque</option>
          </select>
          <input type="number" step="0.01" name="amount" required placeholder="Amount (Rs)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <textarea name="notes" rows={2} placeholder="Notes (optional)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <div>
            <label className="text-xs text-surface-500">Slip Upload (optional)</label>
            <input type="file" name="slip" accept="image/*,application/pdf" className="mt-1 w-full text-xs" />
          </div>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Request Bhejein"}</button>;
}