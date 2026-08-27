"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Printer, Download, Mail, MessageCircle, X, Plus, Landmark } from "lucide-react";
import { recordDealerPayment, type ActionState } from "@/actions/dealer-payments";

const initialState: ActionState = {};

interface Entry {
  date: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  slipUrl?: string | null;
}

interface Props {
  dealerId: string;
  dealerName: string;
  contactPerson: string | null;
  bankName: string | null;
  bankAccountTitle: string | null;
  bankAccountNumber: string | null;
  bankIban: string | null;
  startDate: string;
  endDate: string;
  entries: Entry[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

export function DealerStatementClient(props: Props) {
  const [showPayment, setShowPayment] = useState(false);

  function statementText() {
    const lines = [
      `${props.dealerName}${props.contactPerson ? ` (${props.contactPerson})` : ""} - Statement`,
      `Period: ${props.startDate} to ${props.endDate}`,
      "",
      ...props.entries.map(
        (e) => `${e.date} | ${e.description} | ${e.debit ? `Debit: Rs ${e.debit.toLocaleString()}` : `Credit: Rs ${e.credit.toLocaleString()}`} | Balance: Rs ${e.runningBalance.toLocaleString()}`
      ),
      "",
      `Total Commission (Payable): Rs ${props.totalDebit.toLocaleString()}`,
      `Total Payments: Rs ${props.totalCredit.toLocaleString()}`,
      `Closing Balance (Payable): Rs ${props.closingBalance.toLocaleString()}`,
    ];
    return lines.join("\n");
  }

  function handlePrint() {
    window.print();
  }
  function handleDownload() {
    const blob = new Blob([statementText()], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${props.dealerName.replace(/\s+/g, "-")}-statement-${props.startDate}-to-${props.endDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(statementText())}`, "_blank");
  }
  function handleEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent(`${props.dealerName} Statement`)}&body=${encodeURIComponent(statementText())}`;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <form className="flex items-center gap-2">
          <input type="date" name="start" defaultValue={props.startDate} className="rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="date" name="end" defaultValue={props.endDate} className="rounded-lg border border-surface-200 p-2 text-sm" />
          <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">View</button>
        </form>
        <div className="flex gap-2">
          <button onClick={() => setShowPayment(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Payment Record Karein
          </button>
          <button onClick={handlePrint} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Printer className="h-4 w-4" /></button>
          <button onClick={handleDownload} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Download className="h-4 w-4" /></button>
          <button onClick={handleWhatsApp} className="rounded-lg border border-green-200 bg-green-50 p-2 text-green-700 hover:bg-green-100"><MessageCircle className="h-4 w-4" /></button>
          <button onClick={handleEmail} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Mail className="h-4 w-4" /></button>
        </div>
      </div>

      {(props.bankName || props.bankAccountNumber) && (
        <div className="mb-4 flex items-center gap-3 rounded-card border border-surface-200 bg-surface-50 p-3 text-sm dark:border-surface-800 dark:bg-surface-800">
          <Landmark className="h-4 w-4 shrink-0 text-surface-400" />
          <div className="flex flex-wrap gap-4 text-surface-600 dark:text-surface-400">
            {props.bankName && <span><strong>Bank:</strong> {props.bankName}</span>}
            {props.bankAccountTitle && <span><strong>Title:</strong> {props.bankAccountTitle}</span>}
            {props.bankAccountNumber && <span><strong>Account #:</strong> {props.bankAccountNumber}</span>}
            {props.bankIban && <span><strong>IBAN:</strong> {props.bankIban}</span>}
          </div>
        </div>
      )}

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="mb-4 border-b border-surface-100 pb-3 dark:border-surface-800">
          <h2 className="font-display text-lg font-semibold text-surface-900 dark:text-white">{props.dealerName} {props.contactPerson ? `(${props.contactPerson})` : ""}</h2>
          <p className="text-sm text-surface-500">{props.startDate} to {props.endDate}</p>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
            <p className="text-xs text-surface-400">Total Commission</p>
            <p className="font-semibold text-red-600">Rs {props.totalDebit.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
            <p className="text-xs text-surface-400">Total Payments</p>
            <p className="font-semibold text-green-600">Rs {props.totalCredit.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <p className="text-xs text-amber-500">Closing Balance (Payable)</p>
            <p className="font-semibold text-amber-700">Rs {props.closingBalance.toLocaleString()}</p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 text-left dark:border-surface-800">
              <th className="px-2 py-2 font-medium text-surface-500">Date</th>
              <th className="px-2 py-2 font-medium text-surface-500">Description</th>
              <th className="px-2 py-2 text-right font-medium text-surface-500">Debit</th>
              <th className="px-2 py-2 text-right font-medium text-surface-500">Credit</th>
              <th className="px-2 py-2 text-right font-medium text-surface-500">Balance</th>
              <th className="px-2 py-2 font-medium text-surface-500">Slip</th>
            </tr>
          </thead>
          <tbody>
            {props.entries.map((e, i) => (
              <tr key={i} className="border-b border-surface-50 last:border-0 dark:border-surface-800">
                <td className="px-2 py-1.5 text-surface-500">{e.date}</td>
                <td className="px-2 py-1.5 text-surface-700 dark:text-surface-300">{e.description}</td>
                <td className="px-2 py-1.5 text-right text-red-600">{e.debit ? `Rs ${e.debit.toLocaleString()}` : "-"}</td>
                <td className="px-2 py-1.5 text-right text-green-600">{e.credit ? `Rs ${e.credit.toLocaleString()}` : "-"}</td>
                <td className="px-2 py-1.5 text-right text-surface-600 dark:text-surface-400">Rs {e.runningBalance.toLocaleString()}</td>
                <td className="px-2 py-1.5">
                  {e.slipUrl ? (
                    <a href={e.slipUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">View</a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
            {props.entries.length === 0 && (
              <tr><td colSpan={6} className="px-2 py-8 text-center text-surface-400">Is period mein koi transaction nahi hai.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showPayment && <PaymentModal dealerId={props.dealerId} onClose={() => setShowPayment(false)} />}
    </div>
  );
}

function PaymentModal({ dealerId, onClose }: { dealerId: string; onClose: () => void }) {
  const [state, formAction] = useFormState(recordDealerPayment, initialState);
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">Payment Record Karein</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} encType="multipart/form-data" className="space-y-2">
          <input type="hidden" name="dealer_id" value={dealerId} />
          <input type="date" name="payment_date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="number" step="0.01" name="amount" required placeholder="Amount (Rs)" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <textarea name="notes" rows={2} placeholder="Notes" className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <div>
            <label className="text-xs text-surface-500">Payment Slip Upload Karein</label>
            <input type="file" name="slip" accept="image/*,application/pdf" className="mt-1 w-full text-xs" />
          </div>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Save Karein"}</button>;
}