"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { submitOrderPayment, verifyOrderPayment, rejectOrderPayment, type ActionState } from "@/actions/agri-orders";
import { CreditCard, X, CheckCircle2, XCircle, FileText } from "lucide-react";
import type { OrderPermissions } from "@/lib/order-permissions";

const initialState: ActionState = {};

interface Payment {
  id: string;
  payment_number: string;
  payment_method: string;
  bank_name: string | null;
  transaction_id: string | null;
  payment_date: string | null;
  paid_amount: number;
  receipt_url: string | null;
  status: string;
  rejection_reason: string | null;
}

function statusColor(status: string) {
  if (status === "verified") return "bg-green-100 text-green-700";
  if (status === "partially_verified") return "bg-amber-100 text-amber-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  return "bg-blue-100 text-blue-700";
}

const METHODS_NEEDING_BANK = ["Bank Transfer", "Online Payment"];

export function PaymentSection({ orderId, payments, permissions }: { orderId: string; payments: Payment[]; permissions: OrderPermissions }) {
  const [showSubmit, setShowSubmit] = useState(false);

  // "Payment Submit Karein" should only be offered while there's no
  // active/settled payment on this order yet - once a payment is
  // verified (or is sitting pending_verification), the branch shouldn't
  // be able to submit another one. It reappears correctly if the
  // Finance Team rejects the payment (status becomes "rejected"), since
  // that's the one case where a fresh submission is genuinely needed.
  const hasActivePayment = payments.some((p) => p.status === "pending_verification" || p.status === "verified" || p.status === "partially_verified");
  const canShowSubmitButton = permissions.canSubmitPayment && !hasActivePayment;

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
          <CreditCard className="h-4 w-4" /> Payment Verification
        </h3>
        {canShowSubmitButton && (
          <button onClick={() => setShowSubmit(true)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            Payment Submit Karein
          </button>
        )}
      </div>

      {payments.some((p) => p.status === "pending_verification") && permissions.canSubmitPayment && (
        <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
          Aapki payment verification ke liye Finance Team ke paas bheji ja chuki hai — agle update ka intezar karein.
        </p>
      )}
      <div className="space-y-2">
        {payments.map((p) => (
          <div key={p.id} className="rounded-lg border border-surface-100 p-3 dark:border-surface-800">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-xs text-surface-500">{p.payment_number}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(p.status)}`}>{p.status.replace(/_/g, " ")}</span>
            </div>
            <p className="text-sm text-surface-700 dark:text-surface-300">{p.payment_method} - Rs {p.paid_amount.toLocaleString()}</p>
            {p.bank_name && <p className="text-xs text-surface-500">{p.bank_name} | TXN: {p.transaction_id ?? "-"}</p>}
            {p.receipt_url && (
              <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 text-xs text-brand-600 hover:underline">
                <FileText className="h-3 w-3" /> Receipt Dekhein
              </a>
            )}
            {p.rejection_reason && <p className="mt-1 text-xs text-red-600">Reject Wajah: {p.rejection_reason}</p>}
            {p.status === "pending_verification" && permissions.canVerifyPayment && <PaymentVerifyActions orderId={orderId} paymentId={p.id} />}
          </div>
        ))}
        {payments.length === 0 && <p className="text-center text-xs text-surface-400">Koi payment submit nahi hui abhi.</p>}
      </div>
      {showSubmit && <SubmitPaymentModal orderId={orderId} onClose={() => setShowSubmit(false)} />}
    </div>
  );
}

function PaymentVerifyActions({ orderId, paymentId }: { orderId: string; paymentId: string }) {
  const [showReject, setShowReject] = useState(false);
  const [verifyState, verifyAction] = useFormState(verifyOrderPayment, initialState);
  return (
    <div className="mt-2 flex gap-2">
      <form action={verifyAction}>
        <input type="hidden" name="order_id" value={orderId} />
        <input type="hidden" name="payment_id" value={paymentId} />
        <input type="hidden" name="partial" value="false" />
        <button type="submit" className="flex items-center gap-1 rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3" /> Verify Karein
        </button>
      </form>
      <button onClick={() => setShowReject(true)} className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">
        <XCircle className="h-3 w-3" /> Reject Karein
      </button>
      {showReject && <RejectPaymentModal orderId={orderId} paymentId={paymentId} onClose={() => setShowReject(false)} />}
    </div>
  );
}

function RejectPaymentModal({ orderId, paymentId, onClose }: { orderId: string; paymentId: string; onClose: () => void }) {
  const [state, formAction] = useFormState(rejectOrderPayment, initialState);
  if (state.success) setTimeout(onClose, 800);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Payment Reject Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="payment_id" value={paymentId} />
          <textarea name="rejection_reason" required rows={3} placeholder="Reject karne ki wajah" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <button type="submit" className="w-full rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700">Confirm Reject</button>
        </form>
      </div>
    </div>
  );
}

function SubmitPaymentModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [state, formAction] = useFormState(submitOrderPayment, initialState);
  const [method, setMethod] = useState("Bank Transfer");
  if (state.success) setTimeout(onClose, 800);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Payment Submit Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">Payment submit ho gayi.</p>}
        <form action={formAction} encType="multipart/form-data" className="space-y-2">
          <input type="hidden" name="order_id" value={orderId} />
          <select name="payment_method" value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cash">Cash</option>
            <option value="Online Payment">Online Payment</option>
            <option value="Cheque">Cheque</option>
            <option value="Credit">Credit</option>
          </select>
          {METHODS_NEEDING_BANK.includes(method) && (
            <>
              <input name="bank_name" required placeholder="Bank Naam (jis bank se payment hui)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
              <input name="transaction_id" placeholder="Transaction ID" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
            </>
          )}
          <input type="date" name="payment_date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="number" step="0.01" name="paid_amount" required placeholder="Paid Amount (Rs)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <div>
            <label className="text-xs text-surface-500">Receipt Upload (optional)</label>
            <input type="file" name="receipt" accept="image/*,application/pdf" className="mt-1 w-full text-xs" />
          </div>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Submit Karein"}</button>;
}