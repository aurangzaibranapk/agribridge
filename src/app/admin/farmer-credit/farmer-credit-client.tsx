"use client";
import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import {
  issueFarmerCredit,
  recordFarmerCreditRepayment,
  migrateOpeningBalance,
  setFarmerCreditLimit,
  type ActionState,
} from "@/actions/farmer-credit";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Plus, X, FileText, Settings } from "lucide-react";

const initialState: ActionState = {};

interface Farmer { id: string; full_name: string; farmer_code: string; credit_limit: number | null; }
interface Balance { farmer_id: string; farmer_name: string; farmer_code: string; totalDebit: number; totalCredit: number; credit_limit: number | null; balance_due: number; }
interface LedgerRow {
  id: string;
  farmer_id: string;
  farmer_name: string;
  farmer_code: string;
  source_type: string;
  ledger_type: string;
  amount: number;
  collected_by: string | null;
  notes: string | null;
  created_at: string;
}
interface FinanceAccount { id: string; name: string; account_type: string; }

const SOURCE_LABELS: Record<string, string> = {
  seed: "Seed",
  fertilizer: "Fertilizer",
  pesticide: "Pesticide",
  machinery: "Machinery",
  milk: "Milk (Weekly Auto-Deduct)",
  wanda: "Wanda",
  opening_balance: "Opening Balance (DigiKhata)",
  produce_repayment: "Produce Repayment",
  other: "Other",
};

export function FarmerCreditClient({
  farmers,
  balances,
  ledger,
  financeAccounts,
}: {
  farmers: Farmer[];
  balances: Balance[];
  ledger: LedgerRow[];
  financeAccounts: FinanceAccount[];
}) {
  const [showIssue, setShowIssue] = useState(false);
  const [showRepay, setShowRepay] = useState(false);
  const [showMigrate, setShowMigrate] = useState(false);
  const [showLimit, setShowLimit] = useState(false);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setShowIssue(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Credit Issue Karein
        </button>
        <button onClick={() => setShowRepay(true)} className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">
          <Plus className="h-4 w-4" /> Repayment Record Karein
        </button>
        <button onClick={() => setShowMigrate(true)} className="flex items-center gap-1.5 rounded-lg bg-surface-100 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300">
          DigiKhata Se Migrate Karein
        </button>
        <button onClick={() => setShowLimit(true)} className="flex items-center gap-1.5 rounded-lg bg-surface-100 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300">
          <Settings className="h-4 w-4" /> Credit Limit Set Karein
        </button>
      </div>

      <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">Farmer-wise Balances (Kis Ka Khata)</h3>
      <div className="mb-6 overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-4 py-3 font-medium text-surface-500">Farmer</th>
              <th className="px-4 py-3 text-right font-medium text-surface-500">Total Issued</th>
              <th className="px-4 py-3 text-right font-medium text-surface-500">Total Paid</th>
              <th className="px-4 py-3 text-right font-medium text-surface-500">Baaqi</th>
              <th className="px-4 py-3 text-right font-medium text-surface-500">Credit Limit</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => {
              const overLimit = b.credit_limit !== null && b.balance_due > b.credit_limit;
              return (
                <tr key={b.farmer_id} className={`border-b border-surface-100 last:border-0 dark:border-surface-800 ${overLimit ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
                  <td className="px-4 py-3 font-medium text-surface-800 dark:text-surface-200">
                    {b.farmer_name} <span className="ml-1 font-mono text-xs text-surface-400">({b.farmer_code})</span>
                  </td>
                  <td className="px-4 py-3 text-right text-surface-600 dark:text-surface-400">Rs {b.totalDebit.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-green-600">Rs {b.totalCredit.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${b.balance_due > 0 ? "text-amber-600" : "text-green-600"}`}>Rs {b.balance_due.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-xs text-surface-500">{b.credit_limit ? `Rs ${b.credit_limit.toLocaleString()}` : "-"}{overLimit && <span className="ml-1 text-red-600">(Over)</span>}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/farmer-credit/statement?farmer_id=${b.farmer_id}`} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                      <FileText className="h-3 w-3" /> Statement
                    </Link>
                  </td>
                </tr>
              );
            })}
            {balances.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">Koi outstanding credit nahi hai.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">Poori Recent History</h3>
      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500">Date</th>
              <th className="px-3 py-2 font-medium text-surface-500">Farmer</th>
              <th className="px-3 py-2 font-medium text-surface-500">Type</th>
              <th className="px-3 py-2 font-medium text-surface-500">Le Ke Jaane Wala</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Amount</th>
            </tr>
          </thead>
          <tbody>
            {ledger.slice(0, 30).map((r) => (
              <tr key={r.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{r.farmer_name}</td>
                <td className="px-3 py-2 text-surface-600 dark:text-surface-400">
                  {r.ledger_type === "debit" ? SOURCE_LABELS[r.source_type] ?? r.source_type : "Payment/Repayment"}
                  {r.notes && <p className="text-xs text-surface-400">{r.notes}</p>}
                </td>
                <td className="px-3 py-2 text-xs text-surface-500">{r.collected_by ?? "-"}</td>
                <td className={`px-3 py-2 text-right font-semibold ${r.ledger_type === "debit" ? "text-amber-600" : "text-green-600"}`}>
                  {r.ledger_type === "debit" ? "+" : "-"} Rs {r.amount.toLocaleString()}
                </td>
              </tr>
            ))}
            {ledger.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-surface-400">Koi record nahi hai.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showIssue && <IssueCreditModal farmers={farmers} onClose={() => setShowIssue(false)} />}
      {showRepay && <RepaymentModal farmers={farmers} financeAccounts={financeAccounts} onClose={() => setShowRepay(false)} />}
      {showMigrate && <MigrateModal farmers={farmers} onClose={() => setShowMigrate(false)} />}
      {showLimit && <LimitModal farmers={farmers} onClose={() => setShowLimit(false)} />}
    </div>
  );
}

function IssueCreditModal({ farmers, onClose }: { farmers: Farmer[]; onClose: () => void }) {
  const [state, formAction] = useFormState(issueFarmerCredit, initialState);
  const [confirmOverride, setConfirmOverride] = useState(false);
  const isLimitError = state.error?.startsWith("LIMIT_EXCEEDED:");
  if (state.success) setTimeout(onClose, 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">Credit Issue Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && !isLimitError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {isLimitError && (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <p>{state.error?.replace("LIMIT_EXCEEDED:", "")}</p>
            <label className="mt-2 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={confirmOverride} onChange={(e) => setConfirmOverride(e.target.checked)} />
              Phir bhi issue karna hai (Limit se zyada)
            </label>
          </div>
        )}
        {state.success && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Credit issue ho gayi.</p>}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="override_limit" value={confirmOverride ? "true" : "false"} />
          <div>
            <Label>Farmer *</Label>
            <Select name="farmer_id" required>
              <option value="">- select -</option>
              {farmers.map((f) => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.farmer_code})</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Credit Type *</Label>
            <Select name="source_type" required>
              <option value="seed">Seed</option>
              <option value="fertilizer">Fertilizer</option>
              <option value="pesticide">Pesticide</option>
              <option value="machinery">Machinery</option>
              <option value="wanda">Wanda</option>
              <option value="milk">Milk (Weekly Auto-Deduct)</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div>
            <Label>Amount (Rs.) *</Label>
            <Input name="amount" type="number" step="0.01" required />
          </div>
          <div>
            <Label>Le Ke Jaane Wala Kaun Hai? (agar Farmer khud nahi)</Label>
            <Input name="collected_by" placeholder="Naam likhein" />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea name="notes" rows={2} placeholder="e.g. DAP 2 bags, 5 acres" />
          </div>
          <SubmitButton label={isLimitError && !confirmOverride ? "Confirm Karein Upar" : "Credit Issue Karein"} disabled={isLimitError && !confirmOverride} />
        </form>
      </div>
    </div>
  );
}

function RepaymentModal({ farmers, financeAccounts, onClose }: { farmers: Farmer[]; financeAccounts: FinanceAccount[]; onClose: () => void }) {
  const [state, formAction] = useFormState(recordFarmerCreditRepayment, initialState);
  if (state.success) setTimeout(onClose, 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">Repayment Record Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Repayment record ho gayi.</p>}
        <form action={formAction} className="space-y-3">
          <div>
            <Label>Farmer *</Label>
            <Select name="farmer_id" required>
              <option value="">- select -</option>
              {farmers.map((f) => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.farmer_code})</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Amount (Rs.) *</Label>
            <Input name="amount" type="number" step="0.01" required />
          </div>
          <div>
            <Label>Konsa Account Mein Paisa Aya *</Label>
            <Select name="account_id" required>
              <option value="">- select -</option>
              {financeAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea name="notes" rows={2} />
          </div>
          <SubmitButton label="Repayment Record Karein" />
        </form>
      </div>
    </div>
  );
}

function MigrateModal({ farmers, onClose }: { farmers: Farmer[]; onClose: () => void }) {
  const [state, formAction] = useFormState(migrateOpeningBalance, initialState);
  if (state.success) setTimeout(onClose, 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">DigiKhata Se Migrate Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-2 text-xs text-surface-400">Purane DigiKhata ka total balance ek dafa yahan enter karein - "DigiKhata se migrate hui" note ke sath save hoga. Har Farmer ke liye sirf ek dafa ho sakta hai.</p>
        {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Migrate ho gaya.</p>}
        <form action={formAction} className="space-y-3">
          <div>
            <Label>Farmer *</Label>
            <Select name="farmer_id" required>
              <option value="">- select -</option>
              {farmers.map((f) => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.farmer_code})</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Total Balance (Rs.) - Farmer ka Company pe udhaar to positive, Company Farmer ka de to negative *</Label>
            <Input name="amount" type="number" step="0.01" required placeholder="e.g. 50000 ya -20000" />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea name="notes" rows={2} placeholder="Optional extra detail" />
          </div>
          <SubmitButton label="Migrate Karein" />
        </form>
      </div>
    </div>
  );
}

function LimitModal({ farmers, onClose }: { farmers: Farmer[]; onClose: () => void }) {
  const [state, formAction] = useFormState(setFarmerCreditLimit, initialState);
  const [selectedFarmer, setSelectedFarmer] = useState("");
  const currentLimit = farmers.find((f) => f.id === selectedFarmer)?.credit_limit;
  if (state.success) setTimeout(() => window.location.reload(), 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">Credit Limit Set Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Limit set ho gaya.</p>}
        <form action={formAction} className="space-y-3">
          <div>
            <Label>Farmer *</Label>
            <Select name="farmer_id" value={selectedFarmer} onChange={(e) => setSelectedFarmer(e.target.value)} required>
              <option value="">- select -</option>
              {farmers.map((f) => (
                <option key={f.id} value={f.id}>{f.full_name} ({f.farmer_code}) {f.credit_limit ? `- Abhi: Rs ${f.credit_limit.toLocaleString()}` : ""}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Credit Limit (Rs.) - khaali chhodein to limit hatana hai</Label>
            <Input name="credit_limit" type="number" step="0.01" defaultValue={currentLimit ?? ""} placeholder="e.g. 100000" />
          </div>
          <SubmitButton label="Limit Set Karein" />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending || disabled} className="w-full">{pending ? "Saving..." : label}</Button>;
}