"use client";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createMilkEntry, recordMilkPayment, type ActionState } from "@/actions/milk";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
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
            <span className="text-xs font-medium uppercase tracking-wide">Today's Collection</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">
            {todayTotal.toFixed(1)} L
          </p>
        </Card>
        <Card className="border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30">
          <div className="flex items-center gap-2 text-red-600">
            <Wallet className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Total Owed to Farmers</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-red-700 dark:text-red-300">
            Rs {totalOwed.toLocaleString()}
          </p>
        </Card>
        <Card className="border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
          <div className="flex items-center gap-2 text-surface-500">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Active Suppliers</span>
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
              Recent Entries
            </h2>
            <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                    <th className="px-3 py-2 font-medium text-surface-500">Date</th>
                    <th className="px-3 py-2 font-medium text-surface-500">Chiller</th>
                    <th className="px-3 py-2 font-medium text-surface-500">Farmer</th>
                    <th className="px-3 py-2 font-medium text-surface-500">Shift</th>
                    <th className="px-3 py-2 text-right font-medium text-surface-500">Qty (L)</th>
                    <th className="px-3 py-2 text-right font-medium text-surface-500">FAT/SNF</th>
                    <th className="px-3 py-2 text-right font-medium text-surface-500">Rate</th>
                    <th className="px-3 py-2 text-right font-medium text-surface-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.slice(0, 20).map((e) => (
                    <tr key={e.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                      <td className="px-3 py-2 text-surface-500">{e.entry_date}</td>
                      <td className="px-3 py-2 text-surface-500">{e.branch_name ?? "-"}</td>
                      <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{e.farmer_name}</td>
                      <td className="px-3 py-2 capitalize text-surface-600 dark:text-surface-400">{e.shift}</td>
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
                        No milk entries yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
              Farmer Balances
            </h2>
            <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                    <th className="px-3 py-2 font-medium text-surface-500">Farmer</th>
                    <th className="px-3 py-2 text-right font-medium text-surface-500">Supplied</th>
                    <th className="px-3 py-2 text-right font-medium text-surface-500">Paid</th>
                    <th className="px-3 py-2 text-right font-medium text-surface-500">Balance Due</th>
                    <th className="px-3 py-2 font-medium text-surface-500">Action</th>
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
                            Pay
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {balances.filter((b) => b.total_supplied > 0).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-surface-400">
                        No suppliers yet.
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
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">New Milk Entry</h2>
      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <div className="mb-3 space-y-2">
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            Entry record ho gayi.{state.smsSent === false ? " (SMS gateway abhi configure nahi hai - message neeche copy kar lein)" : ""}
          </p>
          {state.smsText && (
            <pre className="whitespace-pre-wrap rounded-lg bg-surface-50 p-3 text-xs text-surface-700 dark:bg-surface-800 dark:text-surface-300">{state.smsText}</pre>
          )}
        </div>
      )}
      <form action={formAction} className="space-y-3">
        {branches.length > 1 && (
          <div>
            <Label>Chiller/Branch *</Label>
            <Select name="branch_id" required>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </div>
        )}
        {branches.length === 1 && <input type="hidden" name="branch_id" value={branches[0].id} />}
        <div>
          <Label>Farmer *</Label>
          <Select name="farmer_id" required value={farmerId} onChange={(e) => setFarmerId(e.target.value)}>
            <option value="">- select -</option>
            {farmers.map((f) => (
              <option key={f.id} value={f.id}>{f.full_name} ({f.farmer_code})</option>
            ))}
          </Select>
        </div>
        {selectedBalance && (
          <div className="rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-600 dark:bg-surface-800 dark:text-surface-300">
            Balance Due: <strong className={selectedBalance.balance_due > 0 ? "text-red-600" : ""}>Rs {selectedBalance.balance_due.toLocaleString()}</strong>
          </div>
        )}
        <div>
          <Label>Date</Label>
          <Input type="date" name="entry_date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div>
          <Label>Shift (auto-detected: {autoShift})</Label>
          <Select name="shift" value={shift} onChange={(e) => setShift(e.target.value)}>
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
          </Select>
        </div>
        {isLate && (
          <div>
            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" /> Ye {shift} slot hai lekin abhi waqt {autoShift} ka hai - wajah likhein
            </p>
            <Input name="late_reason" required placeholder="e.g. Subah der ho gayi thi, ab entry kar raha hoon" />
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Volume (Liters) *</Label>
            <Input type="number" step="0.1" name="quantity_liters" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </div>
          <div>
            <Label>FAT % *</Label>
            <Input type="number" step="0.01" name="fat_percentage" value={fat} onChange={(e) => setFat(e.target.value)} required />
          </div>
          <div>
            <Label>LR *</Label>
            <Input type="number" step="0.1" name="lr" value={lr} onChange={(e) => setLr(e.target.value)} required />
          </div>
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea name="notes" rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-surface-100 pt-3 text-sm dark:border-surface-800">
          <div className="rounded-lg bg-surface-50 px-3 py-2 dark:bg-surface-800">
            <p className="text-xs text-surface-400">SNF (auto)</p>
            <p className="font-semibold text-surface-800 dark:text-surface-100">{snf ? snf.toFixed(2) : "-"}%</p>
          </div>
          <div className="rounded-lg bg-surface-50 px-3 py-2 dark:bg-surface-800">
            <p className="text-xs text-surface-400">Adjusted Volume (13 TS)</p>
            <p className="font-semibold text-surface-800 dark:text-surface-100">{adjVol ? adjVol.toFixed(2) : "-"}L</p>
          </div>
        </div>
        <p className="text-xs text-surface-400">Amount rate farmer ki type (Self Drop-off/Field Collection) se khud calculate hoga.</p>
        <SubmitButton label="Record Entry" />
      </form>
    </div>
  );
}

function PaymentModal({ balance, onClose }: { balance: Balance; onClose: () => void }) {
  const [state, formAction] = useFormState(recordMilkPayment, initialState);

  if (state.success) {
    setTimeout(onClose, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">Record Payment</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-sm text-surface-500">
          {balance.full_name} - Owed: Rs {balance.balance_due.toLocaleString()}
        </p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">Payment recorded.</p>}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="farmer_id" value={balance.farmer_id} />
          <div>
            <Label>Amount (Rs.) *</Label>
            <Input type="number" step="0.01" name="amount" max={balance.balance_due} defaultValue={balance.balance_due} required />
          </div>
          <div>
            <Label>Payment Method</Label>
            <Select name="payment_method">
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="easypaisa">EasyPaisa</option>
              <option value="jazzcash">JazzCash</option>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea name="notes" rows={2} />
          </div>
          <SubmitButton label="Record Payment" />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : label}</Button>;
}