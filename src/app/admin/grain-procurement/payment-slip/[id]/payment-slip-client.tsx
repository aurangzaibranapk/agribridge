"use client";
import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { editGrainPayment, emailGrainPaymentSlip, type ActionState } from "@/actions/grain-procurement";
import { Printer, MessageCircle, Mail, ArrowLeft, Pencil, X, AlertCircle } from "lucide-react";

const initialState: ActionState = {};

interface Slip {
  id: string;
  amount: number;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  seller_name: string;
  seller_code: string | null;
  seller_phone: string | null;
  seller_type: string;
  receipt_photo_url: string | null;
  is_edited: boolean;
  original_amount: number | null;
  edited_at: string | null;
}
interface FinanceAccount { id: string; name: string; }

export function PaymentSlipClient({ slip, financeAccounts }: { slip: Slip; financeAccounts: FinanceAccount[] }) {
  const [showEdit, setShowEdit] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const slipNumber = `SLIP-${slip.id.slice(0, 8).toUpperCase()}`;
  const shareText = `Al Rana Traders - Payment Slip ${slipNumber}\n${slip.seller_name}\nAmount: Rs ${slip.amount.toLocaleString()}\nDate: ${new Date(slip.created_at).toLocaleDateString()}\n\nDekhein: ${typeof window !== "undefined" ? window.location.href : ""}`;

  function handlePrint() {
    window.print();
  }
  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  }

  return (
    <div className="mx-auto max-w-xl p-4">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/admin/grain-procurement" className="flex items-center gap-1 text-sm text-surface-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Wapas
        </Link>
        <div className="flex gap-2">
          <button onClick={() => setShowEdit(true)} className="flex items-center gap-1.5 rounded-lg bg-surface-100 px-3 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            <Printer className="h-3.5 w-3.5" /> Print/Download
          </button>
          <button onClick={handleWhatsApp} className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </button>
          <button onClick={() => setShowEmail(true)} className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
            <Mail className="h-3.5 w-3.5" /> Email
          </button>
        </div>
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-8 shadow-card print:border-0 print:shadow-none">
        <div className="mb-6 flex items-center justify-between border-b border-surface-200 pb-4">
          <div>
            <h1 className="font-display text-xl font-bold text-surface-900">Al Rana Traders</h1>
            <p className="text-sm text-surface-500">AgriBridge - Grain Payment Slip</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-semibold text-surface-700">{slipNumber}</p>
            <p className="text-xs text-surface-400">{new Date(slip.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wide text-surface-400">{slip.seller_type}</p>
          <p className="font-display text-lg font-semibold text-surface-900">{slip.seller_name}</p>
          {slip.seller_code && <p className="text-xs text-surface-500">Code: {slip.seller_code}</p>}
          {slip.seller_phone && <p className="text-xs text-surface-500">Phone: {slip.seller_phone}</p>}
        </div>

        {slip.is_edited && (
          <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Ye payment edit hui hai.{slip.original_amount ? ` Original Amount: Rs ${slip.original_amount.toLocaleString()}.` : ""}{slip.edited_at ? ` ${new Date(slip.edited_at).toLocaleString()}` : ""}</span>
          </div>
        )}
        <div className="rounded-lg border border-green-100 bg-green-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-surface-500">Payment Amount</p>
              <p className="font-display text-2xl font-bold text-green-700">Rs {slip.amount.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-surface-500">Method</p>
              <p className="text-sm font-semibold uppercase text-surface-800">{(slip.payment_method ?? "cash").replace(/_/g, " ")}</p>
            </div>
          </div>
        </div>

        {slip.receipt_photo_url && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium text-surface-500">Farmer Ki Signed Receiving</p>
            <img src={slip.receipt_photo_url} alt="Receiving" className="max-h-64 rounded-lg border border-surface-200 object-contain" />
          </div>
        )}

        {slip.notes && (
          <div className="mt-4 border-t border-surface-100 pt-2 text-xs text-surface-500">
            <p className="font-medium">Notes:</p>
            <p>{slip.notes}</p>
          </div>
        )}

        <div className="mt-8 border-t border-surface-100 pt-3">
          <p className="text-center text-[10px] text-surface-300">This is a computer-generated payment slip from the AgriBridge system.</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-surface-400">Software by ZR Technologies</p>
            <p className="text-xs text-surface-400">0312-6513294</p>
          </div>
        </div>
      </div>

      {showEdit && <EditModal slip={slip} financeAccounts={financeAccounts} onClose={() => setShowEdit(false)} />}
      {showEmail && <EmailModal paymentId={slip.id} onClose={() => setShowEmail(false)} />}
    </div>
  );
}

function EditModal({ slip, financeAccounts, onClose }: { slip: Slip; financeAccounts: FinanceAccount[]; onClose: () => void }) {
  const [state, formAction] = useFormState(editGrainPayment, initialState);
  if (state.success) setTimeout(() => window.location.reload(), 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Payment Edit Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">Update ho gaya.</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="payment_id" value={slip.id} />
          <div>
            <label className="text-xs text-surface-500">Amount (Rs.)</label>
            <input type="number" step="0.01" name="amount" defaultValue={slip.amount} required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-surface-500">Payment Method</label>
            <select name="payment_method" defaultValue={slip.payment_method ?? "cash"} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="easypaisa">EasyPaisa</option>
              <option value="jazzcash">JazzCash</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-500">Account (Finance correction ke liye)</label>
            <select name="account_id" required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
              <option value="">- select -</option>
              {financeAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-500">Notes</label>
            <textarea name="notes" defaultValue={slip.notes ?? ""} rows={2} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <SubmitButton label="Update Karein" />
        </form>
      </div>
    </div>
  );
}

function EmailModal({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  const [state, formAction] = useFormState(emailGrainPaymentSlip, initialState);
  if (state.success) setTimeout(onClose, 1200);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Email Se Bhejein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-2 text-xs text-surface-400">Professional PDF slip seedha attachment ki tarah email mein chali jayegi.</p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">Email bhej di gayi.</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="payment_id" value={paymentId} />
          <input type="email" name="to_email" required placeholder="Email address" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton label="Bhejein" />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : label}</button>;
}