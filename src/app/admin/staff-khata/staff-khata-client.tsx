"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { recordStaffKhataDebit, processMonthEndSalary, type ActionState } from "@/actions/staff-khata";
import { Wallet, X, TrendingUp } from "lucide-react";

const initialState: ActionState = {};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface StaffBalance {
  profile_id: string;
  full_name: string;
  balance: number;
}

interface LedgerEntry {
  id: string;
  profile_id: string;
  ledger_type: string;
  source_type: string;
  amount: number;
  notes: string | null;
  created_at: string;
}

export function StaffKhataClient({ balances, ledger }: { balances: StaffBalance[]; ledger: LedgerEntry[] }) {
  const [debitTarget, setDebitTarget] = useState<StaffBalance | null>(null);
  const [processTarget, setProcessTarget] = useState<StaffBalance | null>(null);

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">Staff Khata Balances</h2>
          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">Staff</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">Balance</th>
                  <th className="px-3 py-2 font-medium text-surface-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={b.profile_id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{b.full_name}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${b.balance > 0 ? "text-brand-600" : "text-surface-400"}`}>
                      Rs {b.balance.toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5">
                        <button onClick={() => setDebitTarget(b)} className="rounded-lg border border-surface-200 px-2 py-1 text-xs text-surface-600 hover:bg-surface-50">
                          Spend Record Karein
                        </button>
                        {b.balance > 0 && (
                          <button onClick={() => setProcessTarget(b)} className="flex items-center gap-1 rounded-lg bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700">
                            <TrendingUp className="h-3 w-3" /> Month-End Process
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {balances.length === 0 && (
                  <tr><td colSpan={3} className="px-3 py-8 text-center text-surface-400">Koi staff balance nahi hai.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">Recent Ledger</h2>
          <div className="max-h-[500px] space-y-1.5 overflow-y-auto rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
            {ledger.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg bg-surface-50 px-2.5 py-1.5 text-xs dark:bg-surface-800">
                <div>
                  <p className="text-surface-600 dark:text-surface-300">{l.source_type.replace(/_/g, " ")}</p>
                  <p className="text-surface-400">{new Date(l.created_at).toLocaleDateString()}</p>
                </div>
                <span className={l.ledger_type === "credit" ? "font-medium text-green-600" : "font-medium text-red-600"}>
                  {l.ledger_type === "credit" ? "+" : "-"}Rs {l.amount.toLocaleString()}
                </span>
              </div>
            ))}
            {ledger.length === 0 && <p className="p-4 text-center text-xs text-surface-400">Koi entry nahi hai.</p>}
          </div>
        </div>
      </div>

      {debitTarget && <DebitModal staff={debitTarget} onClose={() => setDebitTarget(null)} />}
      {processTarget && <ProcessModal staff={processTarget} onClose={() => setProcessTarget(null)} />}
    </div>
  );
}

function DebitModal({ staff, onClose }: { staff: StaffBalance; onClose: () => void }) {
  const [state, formAction] = useFormState(recordStaffKhataDebit, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 font-display text-base font-semibold text-surface-900">
            <Wallet className="h-4 w-4" /> {staff.full_name} - Spend
          </h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-xs text-surface-500">Current Balance: Rs {staff.balance.toLocaleString()}</p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="profile_id" value={staff.profile_id} />
          <select name="source_type" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="grocery">Grocery</option>
            <option value="advance">Advance</option>
            <option value="other">Other</option>
          </select>
          <input type="number" step="0.01" name="amount" required placeholder="Amount (Rs)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <textarea name="notes" rows={2} placeholder="Notes" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton label="Save Karein" />
        </form>
      </div>
    </div>
  );
}

function ProcessModal({ staff, onClose }: { staff: StaffBalance; onClose: () => void }) {
  const [state, formAction] = useFormState(processMonthEndSalary, initialState);
  if (state.success) setTimeout(onClose, 800);
  const now = new Date();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Month-End Process</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-xs text-surface-500">
          {staff.full_name} - Balance <strong>Rs {staff.balance.toLocaleString()}</strong> Salary Due mein shift ho jayegi.
        </p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="profile_id" value={staff.profile_id} />
          <select name="pay_month" defaultValue={now.getMonth() + 1} className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <input type="number" name="pay_year" defaultValue={now.getFullYear()} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton label="Process Karein" />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : label}</button>;
}