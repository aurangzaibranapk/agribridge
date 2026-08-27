"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveBillingSettings, saveMonthlyExpense, type ActionState } from "@/actions/billing";
import { Settings, X, TrendingUp, TrendingDown, Printer, Download, MessageCircle, Mail } from "lucide-react";

const initialState: ActionState = {};

interface Branch {
  id: string;
  name: string;
}

interface Deductions {
  staffSalaries: number;
  petrolCost: number;
  dieselCost: number;
  electricityCost: number;
  chillerMaintenanceCost: number;
  maintenanceCost: number;
  shortageLoss: number;
}

interface Props {
  month: number;
  year: number;
  months: string[];
  branches: Branch[];
  branchFilter: string;
  selectedBranchName: string;
  companyName: string;
  serviceRate: number;
  totalAdjustedVolume: number;
  grossIncome: number;
  deductions: Deductions;
  totalDeductions: number;
  netProfit: number;
}

export function BillingClient(props: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [showExpense, setShowExpense] = useState(false);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <form className="flex flex-wrap items-center gap-2">
          <select name="month" defaultValue={props.month} className="rounded-lg border border-surface-200 p-2 text-sm">
            {props.months.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <input type="number" name="year" defaultValue={props.year} className="w-24 rounded-lg border border-surface-200 p-2 text-sm" />
          <select name="branch_id" defaultValue={props.branchFilter} className="rounded-lg border border-surface-200 p-2 text-sm">
            <option value="">Sab Chillers (Combined)</option>
            {props.branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">View</button>
        </form>
        <div className="flex gap-2">
          <button onClick={() => setShowExpense(true)} className="rounded-lg border border-surface-200 px-3 py-2 text-xs font-medium text-surface-600 hover:bg-surface-50">
            Electricity/Maintenance Add Karein
          </button>
          <button onClick={() => setShowSettings(true)} className="flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-xs font-medium text-surface-600 hover:bg-surface-50">
            <Settings className="h-3.5 w-3.5" /> Rate Settings
          </button>
        </div>
      </div>

      {showSettings && <SettingsModal companyName={props.companyName} serviceRate={props.serviceRate} onClose={() => setShowSettings(false)} />}
      {showExpense && <ExpenseModal month={props.month} year={props.year} branchId={props.branchFilter} onClose={() => setShowExpense(false)} />}

      <InvoiceCard {...props} />
    </div>
  );
}

function InvoiceCard(props: Props) {
  const invoiceText = () =>
    `${props.companyName} - Milk Collection Invoice\n${props.selectedBranchName}\n${props.months[props.month - 1]} ${props.year}\n\nTotal Milk Handled: ${props.totalAdjustedVolume.toFixed(1)}L\nService Rate: Rs ${props.serviceRate}/L\nTotal Payable: Rs ${props.grossIncome.toLocaleString()}`;

  function handlePrint() {
    window.print();
  }
  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(invoiceText())}`, "_blank");
  }
  function handleEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent(`Invoice - ${props.selectedBranchName} - ${props.months[props.month - 1]} ${props.year}`)}&body=${encodeURIComponent(invoiceText())}`;
  }
  function handleDownload() {
    const blob = new Blob([invoiceText()], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${props.selectedBranchName.replace(/\s+/g, "-")}-${props.months[props.month - 1]}-${props.year}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 rounded-card border border-surface-200 bg-white p-6 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="mb-4 flex items-center justify-between border-b border-surface-100 pb-4 dark:border-surface-800">
          <div>
            <h2 className="font-display text-lg font-semibold text-surface-900 dark:text-white">{props.companyName} - Invoice</h2>
            <p className="text-sm text-surface-500">{props.selectedBranchName} | {props.months[props.month - 1]} {props.year}</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button onClick={handlePrint} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Printer className="h-4 w-4" /></button>
            <button onClick={handleDownload} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Download className="h-4 w-4" /></button>
            <button onClick={handleWhatsApp} className="rounded-lg border border-green-200 bg-green-50 p-2 text-green-700 hover:bg-green-100"><MessageCircle className="h-4 w-4" /></button>
            <button onClick={handleEmail} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Mail className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="mb-6 rounded-lg bg-brand-50 p-4 dark:bg-brand-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-300">Total Milk Handled</p>
              <p className="font-display text-2xl font-bold text-brand-900 dark:text-brand-100">{props.totalAdjustedVolume.toFixed(1)} L</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-300">Rate</p>
              <p className="font-display text-xl font-bold text-brand-900 dark:text-brand-100">Rs {props.serviceRate}/L</p>
            </div>
          </div>
          <div className="mt-3 border-t border-brand-200 pt-3 dark:border-brand-800">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-600 dark:text-brand-300">Total Payable (Company)</p>
            <p className="font-display text-3xl font-bold text-brand-900 dark:text-brand-100">Rs {props.grossIncome.toLocaleString()}</p>
          </div>
        </div>

        <h3 className="mb-2 font-display text-sm font-semibold text-surface-900 dark:text-white">Operational Expenses (Deductions)</h3>
        {!props.branchFilter && props.deductions.staffSalaries > 0 && (
          <p className="mb-2 text-xs text-surface-400">Staff Salaries sirf "Sab Chillers" view mein dikhti hain (per-chiller split abhi nahi hai).</p>
        )}
        <table className="w-full text-sm">
          <tbody>
            <ExpenseRow label="Staff Salaries" amount={props.deductions.staffSalaries} />
            <ExpenseRow label="Petrol" amount={props.deductions.petrolCost} />
            <ExpenseRow label="Diesel/Generator" amount={props.deductions.dieselCost} />
            <ExpenseRow label="Electricity" amount={props.deductions.electricityCost} />
            <ExpenseRow label="Chiller Maintenance" amount={props.deductions.chillerMaintenanceCost} />
            <ExpenseRow label="Motorcycle Maintenance" amount={props.deductions.maintenanceCost} />
            <ExpenseRow label="Milk Shortage Loss" amount={props.deductions.shortageLoss} />
            <tr className="border-t border-surface-200 dark:border-surface-800">
              <td className="py-2 font-semibold text-surface-900 dark:text-white">Total Deductions</td>
              <td className="py-2 text-right font-semibold text-red-600">- Rs {props.totalDeductions.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={`rounded-card border p-5 shadow-card ${props.netProfit >= 0 ? "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/30" : "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30"}`}>
        <div className="flex items-center gap-2">
          {props.netProfit >= 0 ? <TrendingUp className="h-5 w-5 text-green-600" /> : <TrendingDown className="h-5 w-5 text-red-600" />}
          <span className="text-xs font-semibold uppercase tracking-wide text-surface-500">Net Operational Profit</span>
        </div>
        <p className={`mt-2 font-display text-3xl font-bold ${props.netProfit >= 0 ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
          Rs {props.netProfit.toLocaleString()}
        </p>
        <div className="mt-4 space-y-1 border-t border-surface-200 pt-3 text-xs text-surface-500 dark:border-surface-700">
          <p>Gross Income: Rs {props.grossIncome.toLocaleString()}</p>
          <p>Total Deductions: Rs {props.totalDeductions.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

function ExpenseRow({ label, amount }: { label: string; amount: number }) {
  return (
    <tr className="border-b border-surface-50 last:border-0 dark:border-surface-800">
      <td className="py-1.5 text-surface-600 dark:text-surface-400">{label}</td>
      <td className="py-1.5 text-right text-surface-700 dark:text-surface-300">Rs {amount.toLocaleString()}</td>
    </tr>
  );
}

function SettingsModal({ companyName, serviceRate, onClose }: { companyName: string; serviceRate: number; onClose: () => void }) {
  const [state, formAction] = useFormState(saveBillingSettings, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Billing Settings</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <div>
            <label className="text-xs text-surface-500">Company Naam</label>
            <input name="company_name" defaultValue={companyName} required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-surface-500">Service Rate (Rs/Litre) - aapki proposal mein Rs 8-10 hai</label>
            <input type="number" step="0.01" name="service_rate_per_liter" defaultValue={serviceRate} required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <SubmitButton label="Save Karein" />
        </form>
      </div>
    </div>
  );
}

function ExpenseModal({ month, year, branchId, onClose }: { month: number; year: number; branchId: string; onClose: () => void }) {
  const [state, formAction] = useFormState(saveMonthlyExpense, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Electricity / Maintenance</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="expense_month" value={month} />
          <input type="hidden" name="expense_year" value={year} />
          {branchId && <input type="hidden" name="branch_id" value={branchId} />}
          <select name="category" required className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="electricity">Electricity</option>
            <option value="chiller_maintenance">Chiller Maintenance</option>
          </select>
          <input type="number" step="0.01" name="amount" required placeholder="Amount (Rs)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <textarea name="notes" rows={2} placeholder="Notes (optional)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton label="Save Karein" />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : label}</button>;
}