"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { manualWalletAdjustment, type ActionState } from "@/actions/wallet";
import { Wallet as WalletIcon, X } from "lucide-react";

const initialState: ActionState = {};

export function WalletAdjustButton({ walletId, ownerName }: { walletId: string; ownerName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
      >
        <WalletIcon className="h-3.5 w-3.5" /> Add/Deduct
      </button>
      {open && <AdjustModal walletId={walletId} ownerName={ownerName} onClose={() => setOpen(false)} />}
    </>
  );
}

function AdjustModal({ walletId, ownerName, onClose }: { walletId: string; ownerName: string; onClose: () => void }) {
  const [state, formAction] = useFormState(manualWalletAdjustment, initialState);

  if (state.success) {
    setTimeout(onClose, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">Adjust Wallet</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-sm text-surface-500">{ownerName}</p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Adjusted successfully.</p>}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="wallet_id" value={walletId} />
          <div>
            <label className="text-xs font-medium text-surface-500">Direction</label>
            <select name="direction" defaultValue="credit" className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
              <option value="credit">Add Funds (Credit)</option>
              <option value="debit">Deduct Funds (Debit)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-500">Amount (Rs.)</label>
            <input name="amount" type="number" step="0.01" required className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-500">Type</label>
            <select name="type" defaultValue="manual_adjustment" className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
              <option value="manual_adjustment">Manual Adjustment</option>
              <option value="manual_topup">Top-up</option>
              <option value="cashback">Cashback</option>
              <option value="referral_bonus">Referral Bonus</option>
              <option value="incentive">Incentive</option>
              <option value="subsidy">Subsidy</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-500">Notes</label>
            <textarea name="notes" rows={2} className="mt-1 w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </div>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Saving..." : "Apply"}
    </button>
  );
}