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
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

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
  const lang = useLang();
  const [showRepay, setShowRepay] = useState(false);
  const [showMigrate, setShowMigrate] = useState(false);
  const [showLimit, setShowLimit] = useState(false);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setShowIssue(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" />{t("fc_issue_credit", lang)}</button>
        <button onClick={() => setShowRepay(true)} className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">
          <Plus className="h-4 w-4" />{t("fc_record_repayment", lang)}</button>
        <button onClick={() => setShowMigrate(true)} className="flex items-center gap-1.5 rounded-lg bg-surface-100 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300">{t("fc_migrate", lang)}</button>
        <button onClick={() => setShowLimit(true)} className="flex items-center gap-1.5 rounded-lg bg-surface-100 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300">
          <Settings className="h-4 w-4" />{t("fc_set_limit", lang)}</button>
      </div>

      <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">{t("fc_farmer_balances", lang)}</h3>
      <div className="mb-6 overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-4 py-3 font-medium text-surface-500">{t("c_farmer", lang)}</th>
              <th className="px-4 py-3 text-right font-medium text-surface-500">{t("c_total_issued", lang)}</th>
              <th className="px-4 py-3 text-right font-medium text-surface-500">{t("c_total_paid", lang)}</th>
              <th className="px-4 py-3 text-right font-medium text-surface-500">{t("c_baqi", lang)}</th>
              <th className="px-4 py-3 text-right font-medium text-surface-500">{t("c_credit_limit", lang)}</th>
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
              <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">{t("fc_no_outstanding", lang)}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">{t("fc_full_history", lang)}</h3>
      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500">{t("c_date", lang)}</th>
              <th className="px-3 py-2 font-medium text-surface-500">{t("c_farmer", lang)}</th>
              <th className="px-3 py-2 font-medium text-surface-500">{t("c_type", lang)}</th>
              <th className="px-3 py-2 font-medium text-surface-500">{t("fc_taken_by", lang)}</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_amount", lang)}</th>
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
              <tr><td colSpan={5} className="px-3 py-8 text-center text-surface-400">{t("c_no_records", lang)}</td></tr>
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
  const lang = useLang();
  const [confirmOverride, setConfirmOverride] = useState(false);
  const isLimitError = state.error?.startsWith("LIMIT_EXCEEDED:");
  if (state.success) setTimeout(onClose, 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("fc_issue_credit", lang)}</h3>
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
        {state.success && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("fc_credit_issued", lang)}</p>}
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
              <option value="seed">{t("c_seed", lang)}</option>
              <option value="fertilizer">{t("c_fertilizer", lang)}</option>
              <option value="pesticide">{t("c_pesticide", lang)}</option>
              <option value="machinery">{t("c_machinery", lang)}</option>
              <option value="wanda">{t("fc_wanda", lang)}</option>
              <option value="milk">{t("fc_milk_auto", lang)}</option>
              <option value="other">{t("c_other", lang)}</option>
            </Select>
          </div>
          <div>
            <Label>Amount (Rs.) *</Label>
            <Input name="amount" type="number" step="0.01" required />
          </div>
          <div>
            <Label>{t("fc_who_took", lang)}</Label>
            <Input name="collected_by" placeholder={t("c_enter_name", lang)} />
          </div>
          <div>
            <Label>{t("c_notes", lang)}</Label>
            <Textarea name="notes" rows={2} placeholder={t("fc_notes_example", lang)} />
          </div>
          <SubmitButton label={isLimitError && !confirmOverride ? "Confirm Karein Upar" : "Credit Issue Karein"} disabled={isLimitError && !confirmOverride} />
        </form>
      </div>
    </div>
  );
}

function RepaymentModal({ farmers, financeAccounts, onClose }: { farmers: Farmer[]; financeAccounts: FinanceAccount[]; onClose: () => void }) {
  const [state, formAction] = useFormState(recordFarmerCreditRepayment, initialState);
  const lang = useLang();
  if (state.success) setTimeout(onClose, 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("fc_record_repayment", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("fc_repayment_done", lang)}</p>}
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
            <Label>{t("c_notes", lang)}</Label>
            <Textarea name="notes" rows={2} />
          </div>
          <SubmitButton label={t("fc_record_repayment", lang)} />
        </form>
      </div>
    </div>
  );
}

function MigrateModal({ farmers, onClose }: { farmers: Farmer[]; onClose: () => void }) {
  const [state, formAction] = useFormState(migrateOpeningBalance, initialState);
  const lang = useLang();
  if (state.success) setTimeout(onClose, 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("fc_migrate", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-2 text-xs text-surface-400">{t("fc_migrate_note", lang)}</p>
        {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("fc_migrated", lang)}</p>}
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
            <Input name="amount" type="number" step="0.01" required placeholder={t("fc_migrate_amount_eg", lang)} />
          </div>
          <div>
            <Label>{t("c_notes", lang)}</Label>
            <Textarea name="notes" rows={2} placeholder={t("fc_optional_detail", lang)} />
          </div>
          <SubmitButton label={t("fc_migrate", lang)} />
        </form>
      </div>
    </div>
  );
}

function LimitModal({ farmers, onClose }: { farmers: Farmer[]; onClose: () => void }) {
  const [state, formAction] = useFormState(setFarmerCreditLimit, initialState);
  const lang = useLang();
  const [selectedFarmer, setSelectedFarmer] = useState("");
  const currentLimit = farmers.find((f) => f.id === selectedFarmer)?.credit_limit;
  if (state.success) setTimeout(() => window.location.reload(), 900);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("fc_set_limit", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("fc_limit_set", lang)}</p>}
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
            <Label>{t("fc_limit_field", lang)}</Label>
            <Input name="credit_limit" type="number" step="0.01" defaultValue={currentLimit ?? ""} placeholder={t("fc_limit_amount_eg", lang)} />
          </div>
          <SubmitButton label={t("fc_set_limit", lang)} />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending || disabled} className="w-full">{pending ? "Saving..." : label}</Button>;
}