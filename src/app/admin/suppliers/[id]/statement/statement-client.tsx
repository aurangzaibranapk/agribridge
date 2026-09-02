"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Printer, Download, Mail, MessageCircle, X, Plus, Landmark } from "lucide-react";
import { recordSupplierPayment, type ActionState } from "@/actions/supplier-payments";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

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
  supplierId: string;
  supplierName: string;
  companyName: string | null;
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

export function SupplierStatementClient(props: Props) {
  const [showPayment, setShowPayment] = useState(false);
  const lang = useLang();

  function statementText() {
    const lines = [
      `${props.supplierName}${props.companyName ? ` (${props.companyName})` : ""} - Statement`,
      `Period: ${props.startDate} to ${props.endDate}`,
      "",
      ...props.entries.map(
        (e) => `${e.date} | ${e.description} | ${e.debit ? `Debit: Rs ${e.debit.toLocaleString()}` : `Credit: Rs ${e.credit.toLocaleString()}`} | Balance: Rs ${e.runningBalance.toLocaleString()}`
      ),
      "",
      `Total Purchases: Rs ${props.totalDebit.toLocaleString()}`,
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
    a.download = `${props.supplierName.replace(/\s+/g, "-")}-statement-${props.startDate}-to-${props.endDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(statementText())}`, "_blank");
  }
  function handleEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent(`${props.supplierName} Statement`)}&body=${encodeURIComponent(statementText())}`;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <form className="flex items-center gap-2">
          <input type="date" name="start" defaultValue={props.startDate} className="rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="date" name="end" defaultValue={props.endDate} className="rounded-lg border border-surface-200 p-2 text-sm" />
          <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">{t("c_view", lang)}</button>
        </form>
        <div className="flex gap-2">
          <button onClick={() => setShowPayment(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" />{t("c_record_payment", lang)}</button>
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
            {props.bankName && <span><strong>{t("st_bank_label", lang)}</strong> {props.bankName}</span>}
            {props.bankAccountTitle && <span><strong>{t("st_title_label", lang)}</strong> {props.bankAccountTitle}</span>}
            {props.bankAccountNumber && <span><strong>{t("at_account_hash", lang)}</strong> {props.bankAccountNumber}</span>}
            {props.bankIban && <span><strong>{t("st_iban_label", lang)}</strong> {props.bankIban}</span>}
          </div>
        </div>
      )}

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="mb-4 border-b border-surface-100 pb-3 dark:border-surface-800">
          <h2 className="font-display text-lg font-semibold text-surface-900 dark:text-white">{props.supplierName} {props.companyName ? `(${props.companyName})` : ""}</h2>
          <p className="text-sm text-surface-500">{props.startDate} to {props.endDate}</p>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
            <p className="text-xs text-surface-400">{t("c_total_purchases", lang)}</p>
            <p className="font-semibold text-red-600">Rs {props.totalDebit.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
            <p className="text-xs text-surface-400">{t("c_total_payments", lang)}</p>
            <p className="font-semibold text-green-600">Rs {props.totalCredit.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <p className="text-xs text-amber-500">{t("c_closing_balance_payable", lang)}</p>
            <p className="font-semibold text-amber-700">Rs {props.closingBalance.toLocaleString()}</p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 text-left dark:border-surface-800">
              <th className="px-2 py-2 font-medium text-surface-500">{t("c_date", lang)}</th>
              <th className="px-2 py-2 font-medium text-surface-500">{t("c_description", lang)}</th>
              <th className="px-2 py-2 text-right font-medium text-surface-500">{t("c_debit", lang)}</th>
              <th className="px-2 py-2 text-right font-medium text-surface-500">{t("c_credit", lang)}</th>
              <th className="px-2 py-2 text-right font-medium text-surface-500">{t("c_balance", lang)}</th>
              <th className="px-2 py-2 font-medium text-surface-500">{t("c_slip", lang)}</th>
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
                    <a href={e.slipUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">{t("c_view", lang)}</a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
            {props.entries.length === 0 && (
              <tr><td colSpan={6} className="px-2 py-8 text-center text-surface-400">{t("c_no_tx_period", lang)}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showPayment && <PaymentModal supplierId={props.supplierId} onClose={() => setShowPayment(false)} />}
    </div>
  );
}

function PaymentModal({ supplierId, onClose }: { supplierId: string; onClose: () => void }) {
  const [state, formAction] = useFormState(recordSupplierPayment, initialState);
  const lang = useLang();
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("c_record_payment", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} encType="multipart/form-data" className="space-y-2">
          <input type="hidden" name="supplier_id" value={supplierId} />
          <input type="date" name="payment_date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="number" step="0.01" name="amount" required placeholder={t("c_amount_rs", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <select name="payment_method" className="w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="cash">{t("c_cash", lang)}</option>
            <option value="bank_transfer">{t("c_bank_transfer", lang)}</option>
            <option value="cheque">{t("c_cheque", lang)}</option>
          </select>
          <textarea name="notes" rows={2} placeholder={t("c_notes", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <div>
            <label className="text-xs text-surface-500">{t("c_upload_payment_slip", lang)}</label>
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
  return <button data-guide="supplier-pay" type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : "Save Karein"}</button>;
}