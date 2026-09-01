"use client";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createMilkEntry, recordMilkPayment, type ActionState } from "@/actions/milk";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { Droplet, Wallet, DollarSign, X, AlertTriangle } from "lucide-react";

interface Farmer {
  id: string;
  full_name: string;
  farmer_code: string;
}

interface Branch {
  id: string;
  name: string;
}

interface MilkEntry {
  id: string;
  entry_date: string;
  shift: string;
  quantity_liters: number;
  fat_percentage: number | null;
  snf_percentage: number | null;
  rate_per_liter: number;
  total_amount: number;
  farmer_name: string;
  branch_name: string | null;
}

interface Balance {
  farmer_id: string;
  full_name: string;
  farmer_code: string;
  total_supplied: number;
  total_paid: number;
  balance_due: number;
}

const initialState: ActionState = {};

export function MilkClient({
  farmers,
  entries,
  balances,
  branches,
}: {
  farmers: Farmer[];
  entries: MilkEntry[];
  balances: Balance[];
  branches: Branch[];
}) {
  const lang = useLang();
  const [payTarget, setPayTarget] = useState<Balance | null>(null);

  const todayTotal = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return entries.filter((e) => e.entry_date === today).reduce((sum, e) => sum + e.quantity_liters, 0);
  }, [entries]);

  const totalOwed = useMemo(() => balances.reduce((sum, b) => sum + b.balance_due, 0), [balances]);

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
          <div className="flex items-center gap-2 text-surface-500">
            <Droplet className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("mk_today_collection", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">
            {todayTotal.toFixed(1)} L
          </p>
        </Card>
        <Card className="border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30">
          <div className="flex items-center gap-2 text-red-600">
            <Wallet className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("mk_total_owed", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-red-700 dark:text-red-300">
            Rs {totalOwed.toLocaleString()}
          </p>
        </Card>
        <Card className="border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
          <div className="flex items-center gap-2 text-surface-500">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("mk_active_suppliers", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">
            {balances.filter((b) => b.total_supplied > 0).length}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
              {t("mk_recent_entries", lang)}
            </h2>
            <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                    <th className="px-3 py-2 font-medium text-surface-500">{t("mk_date", lang)}</th>
                    <th className="px-3 py-2 font-medium text-surface-500">{t("mk_chiller", lang)}</th>
                    <th className="px-3 py-2 font-medium text-surface-500">{t("mk_farmer", lang)}</th>
                    <th className="px-3 py-2 font-medium text-surface-500">{t("mk_shift", lang)}</th>
                    <th className="px-3 py-2 text-right font-medium text-surface-500">{t("mk_qty_l", lang)}</th>
                    <th className="px-3 py-2 text-right font-medium text-surface-500">{t("mk_fat_snf", lang)}</th>
                    <th className="px-3 py-2 text-right font-medium text-surface-500">{t("mk_rate", lang)}</th>
                    <th className="px-3 py-2 text-right font-medium text-surface-500">{t("mk_total", lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.slice(0, 20).map((e) => (
                    <tr key={e.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                      <td className="px-3 py-2 text-surface-500">{e.entry_date}</td>
                      <td className="px-3 py-2 text-surface-500">{e.branch_name ?? "-"}</td>
                      <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{e.farmer_name}</td>
                      <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{t(e.shift === "morning" ? "mk_morning" : "mk_evening", lang)}</td>
                      <td className="px-3 py-2 text-right text-surface-700 dark:text-surface-300">{e.quantity_liters}</td>
                      <td className="px-3 py-2 text-right text-surface-500">
                        {e.fat_percentage ?? "-"}/{e.snf_percentage ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-right text-surface-700 dark:text-surface-300">Rs {e.rate_per_liter}</td>
                      <td className="px-3 py-2 text-right font-semibold text-surface-900 dark:text-white">
                        Rs {e.total_amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-surface-400">
                        {t("mk_no_entries", lang)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
              {t("mk_farmer_balances", lang)}
            </h2>
            <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                    <th className="px-3 py-2 font-medium text-surface-500">{t("mk_farmer", lang)}</th>
                    <th className="px-3 py-2 text-right font-medium text-surface-500">{t("mk_supplied", lang)}</th>
                    <th className="px-3 py-2 text-right font-medium text-surface-500">{t("mk_paid", lang)}</th>
                    <th className="px-3 py-2 text-right font-medium text-surface-500">{t("mk_balance_due", lang)}</th>
                    <th className="px-3 py-2 font-medium text-surface-500">{t("mk_action", lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.filter((b) => b.total_supplied > 0).map((b) => (
                    <tr key={b.farmer_id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                      <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{b.full_name}</td>
                      <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">
                        Rs {b.total_supplied.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">
                        Rs {b.total_paid.toLocaleString()}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${b.balance_due > 0 ? "text-red-600" : "text-surface-500"}`}>
                        Rs {b.balance_due.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        {b.balance_due > 0 && (
                          <button
                            onClick={() => setPayTarget(b)}
                            className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
                          >
                            {t("mk_pay", lang)}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {balances.filter((b) => b.total_supplied > 0).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-surface-400">
                        {t("mk_no_suppliers", lang)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <NewEntryForm farmers={farmers} balances={balances} branches={branches} />
      </div>

      {payTarget && <PaymentModal balance={payTarget} onClose={() => setPayTarget(null)} />}
    </div>
  );
}

function currentShift() {
  const hour = new Date().getHours();
  return hour >= 4 && hour < 15 ? "morning" : "evening";
}

function NewEntryForm({ farmers, balances, branches }: { farmers: Farmer[]; balances: Balance[]; branches: Branch[] }) {
  const lang = useLang();
  const [state, formAction] = useFormState(createMilkEntry, initialState);
  const [quantity, setQuantity] = useState("");
  const [fat, setFat] = useState("");
  const [lr, setLr] = useState("");
  const [farmerId, setFarmerId] = useState("");
  const autoShift = currentShift();
  const [shift, setShift] = useState(autoShift);
  const isLate = shift !== autoShift;

  const qtyNum = parseFloat(quantity) || 0;
  const fatNum = parseFloat(fat) || 0;
  const lrNum = parseFloat(lr) || 0;
  const snfConstant = 0.805;
  const referenceTs = 13;
  const snf = lrNum > 0 && fatNum > 0 ? lrNum / 4 + fatNum * 0.2 + snfConstant : 0;
  const ts = fatNum + snf;
  const adjVol = qtyNum > 0 && ts > 0 ? qtyNum * (ts / referenceTs) : 0;

  const selectedBalance = balances.find((b) => b.farmer_id === farmerId);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">{t("mk_new_entry", lang)}</h2>
      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <div className="mb-3 space-y-2">
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            {t("mk_entry_saved", lang)}{state.smsSent === false ? t("mk_sms_not_configured", lang) : ""}
          </p>
          {state.smsText && (
            <pre className="whitespace-pre-wrap rounded-lg bg-surface-50 p-3 text-xs text-surface-700 dark:bg-surface-800 dark:text-surface-300">{state.smsText}</pre>
          )}
        </div>
      )}
      <form action={formAction} className="space-y-3">
        {branches.length > 1 && (
          <div>
            <Label>{t("mk_chiller_branch_req", lang)}</Label>
            <Select name="branch_id" required>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </div>
        )}
        {branches.length === 1 && <input type="hidden" name="branch_id" value={branches[0].id} />}
        <div>
          <Label>{t("mk_farmer_req", lang)}</Label>
          <Select name="farmer_id" required value={farmerId} onChange={(e) => setFarmerId(e.target.value)}>
            <option value="">{t("mk_select", lang)}</option>
            {farmers.map((f) => (
              <option key={f.id} value={f.id}>{f.full_name} ({f.farmer_code})</option>
            ))}
          </Select>
        </div>
        {selectedBalance && (
          <div className="rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-600 dark:bg-surface-800 dark:text-surface-300">
            {t("mk_balance_due_label", lang)}: <strong className={selectedBalance.balance_due > 0 ? "text-red-600" : ""}>Rs {selectedBalance.balance_due.toLocaleString()}</strong>
          </div>
        )}
        <div>
          <Label>{t("mk_date", lang)}</Label>
          <Input type="date" name="entry_date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div>
          <Label>{t("mk_shift_auto", lang)}: {t(autoShift === "morning" ? "mk_morning" : "mk_evening", lang)}</Label>
          <Select name="shift" value={shift} onChange={(e) => setShift(e.target.value)}>
            <option value="morning">{t("mk_morning", lang)}</option>
            <option value="evening">{t("mk_evening", lang)}</option>
          </Select>
        </div>
        {isLate && (
          <div>
            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" /> {t("mk_late_warn_1", lang)} {t(shift === "morning" ? "mk_morning" : "mk_evening", lang)} {t("mk_late_warn_2", lang)} {t(autoShift === "morning" ? "mk_morning" : "mk_evening", lang)} {t("mk_late_warn_3", lang)}
            </p>
            <Input name="late_reason" required placeholder={t("mk_late_reason_eg", lang)} />
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>{t("mk_volume_req", lang)}</Label>
            <Input type="number" step="0.1" name="quantity_liters" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </div>
          <div>
            <Label>{t("mk_fat_req", lang)}</Label>
            <Input type="number" step="0.01" name="fat_percentage" value={fat} onChange={(e) => setFat(e.target.value)} required />
          </div>
          <div>
            <Label>{t("mk_lr_req", lang)}</Label>
            <Input type="number" step="0.1" name="lr" value={lr} onChange={(e) => setLr(e.target.value)} required />
          </div>
        </div>
        <div>
          <Label>{t("mk_notes", lang)}</Label>
          <Textarea name="notes" rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-surface-100 pt-3 text-sm dark:border-surface-800">
          <div className="rounded-lg bg-surface-50 px-3 py-2 dark:bg-surface-800">
            <p className="text-xs text-surface-400">{t("mk_snf_auto", lang)}</p>
            <p className="font-semibold text-surface-800 dark:text-surface-100">{snf ? snf.toFixed(2) : "-"}%</p>
          </div>
          <div className="rounded-lg bg-surface-50 px-3 py-2 dark:bg-surface-800">
            <p className="text-xs text-surface-400">{t("mk_adjusted_volume", lang)}</p>
            <p className="font-semibold text-surface-800 dark:text-surface-100">{adjVol ? adjVol.toFixed(2) : "-"}L</p>
          </div>
        </div>
        <p className="text-xs text-surface-400">{t("mk_amount_auto_note", lang)}</p>
        <SubmitButton label={t("mk_record_entry", lang)} />
      </form>
    </div>
  );
}

function PaymentModal({ balance, onClose }: { balance: Balance; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(recordMilkPayment, initialState);

  if (state.success) {
    setTimeout(onClose, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("mk_record_payment", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-sm text-surface-500">
          {balance.full_name} — {t("mk_owed", lang)}: Rs {balance.balance_due.toLocaleString()}
        </p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("mk_payment_recorded", lang)}</p>}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="farmer_id" value={balance.farmer_id} />
          <div>
            <Label>{t("mk_amount_req", lang)}</Label>
            <Input type="number" step="0.01" name="amount" max={balance.balance_due} defaultValue={balance.balance_due} required />
          </div>
          <div>
            <Label>{t("mk_payment_method", lang)}</Label>
            <Select name="payment_method">
              <option value="cash">{t("mk_cash", lang)}</option>
              <option value="bank_transfer">{t("mk_bank_transfer", lang)}</option>
              <option value="easypaisa">EasyPaisa</option>
              <option value="jazzcash">JazzCash</option>
            </Select>
          </div>
          <div>
            <Label>{t("mk_notes", lang)}</Label>
            <Textarea name="notes" rows={2} />
          </div>
          <SubmitButton label={t("mk_record_payment", lang)} />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : label}</Button>;
}