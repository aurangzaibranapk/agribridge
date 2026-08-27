"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { setBranchCreditLimit, recordAdvancePayment, type ActionState } from "@/actions/branch-credit";
import { Wallet, Settings, TrendingUp, TrendingDown, X } from "lucide-react";

const initialState: ActionState = {};

interface Transaction {
  transaction_type: string;
  amount: number;
  created_at: string;
}

interface Branch {
  id: string;
  name: string;
  creditLimit: number;
  advancePaid: number;
  orderCharges: number;
  outstanding: number;
  availableCredit: number;
  recentTransactions: Transaction[];
}

export function BranchCreditClient({ branches }: { branches: Branch[] }) {
  const [limitModal, setLimitModal] = useState<Branch | null>(null);
  const [advanceModal, setAdvanceModal] = useState<Branch | null>(null);

  return (
    <div className="space-y-4">
      {branches.map((b) => (
        <div key={b.id} className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-display text-base font-semibold text-surface-900 dark:text-white">
              <Wallet className="h-4 w-4" /> {b.name}
            </h3>
            <div className="flex gap-2">
              <button onClick={() => setLimitModal(b)} className="flex items-center gap-1 rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50">
                <Settings className="h-3 w-3" /> Credit Limit
              </button>
              <button onClick={() => setAdvanceModal(b)} className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
                Advance Payment
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg bg-surface-50 p-2.5 text-center dark:bg-surface-800">
              <p className="text-xs text-surface-400">Credit Limit</p>
              <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">Rs {b.creditLimit.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-green-50 p-2.5 text-center">
              <p className="text-xs text-surface-400">Advance Paid</p>
              <p className="text-sm font-semibold text-green-700">Rs {b.advancePaid.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-red-50 p-2.5 text-center">
              <p className="text-xs text-surface-400">Order Charges</p>
              <p className="text-sm font-semibold text-red-700">Rs {b.orderCharges.toLocaleString()}</p>
            </div>
            <div className={`rounded-lg p-2.5 text-center ${b.availableCredit >= 0 ? "bg-brand-50" : "bg-red-50"}`}>
              <p className="text-xs text-surface-400">Available Credit</p>
              <p className={`flex items-center justify-center gap-1 text-sm font-semibold ${b.availableCredit >= 0 ? "text-brand-700" : "text-red-700"}`}>
                {b.availableCredit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                Rs {Math.abs(b.availableCredit).toLocaleString()}
              </p>
            </div>
          </div>

          {b.recentTransactions.length > 0 && (
            <div className="mt-3 border-t border-surface-100 pt-2 dark:border-surface-800">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-surface-400">Recent Transactions</p>
              <div className="flex flex-wrap gap-1.5">
                {b.recentTransactions.map((t, i) => (
                  <span key={i} className={`rounded-full px-2 py-0.5 text-xs ${t.transaction_type === "advance_payment" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {t.transaction_type.replace(/_/g, " ")}: Rs {t.amount.toLocaleString()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
      {branches.length === 0 && <p className="rounded-card border border-dashed border-surface-200 bg-white p-10 text-center text-surface-400">Koi active branch nahi hai.</p>}

      {limitModal && <CreditLimitModal branch={limitModal} onClose={() => setLimitModal(null)} />}
      {advanceModal && <AdvancePaymentModal branch={advanceModal} onClose={() => setAdvanceModal(null)} />}
    </div>
  );
}

function CreditLimitModal({ branch, onClose }: { branch: Branch; onClose: () => void }) {
  const [state, formAction] = useFormState(setBranchCreditLimit, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{branch.name} - Credit Limit</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="branch_id" value={branch.id} />
          <input type="number" step="0.01" name="credit_limit" defaultValue={branch.creditLimit} required placeholder="Credit Limit (Rs)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <textarea name="notes" rows={2} placeholder="Notes" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton label="Save Karein" />
        </form>
      </div>
    </div>
  );
}

function AdvancePaymentModal({ branch, onClose }: { branch: Branch; onClose: () => void }) {
  const [state, formAction] = useFormState(recordAdvancePayment, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{branch.name} - Advance Payment</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-xs text-surface-500">Ye amount is shop ke wallet mein jama ho jayega, aage orders isi se adjust honge.</p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="branch_id" value={branch.id} />
          <input type="number" step="0.01" name="amount" required placeholder="Amount (Rs)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <select name="payment_method" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="easypaisa">EasyPaisa</option>
            <option value="jazzcash">JazzCash</option>
          </select>
          <textarea name="notes" rows={2} placeholder="Notes" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton label="Advance Save Karein" />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : label}</button>;
}