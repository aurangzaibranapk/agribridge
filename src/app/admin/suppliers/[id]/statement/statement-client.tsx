"use client";
import { useState, useEffect } from "react";
import { aajKaKhana } from "@/lib/utils/format";
import { useFormState, useFormStatus } from "react-dom";
import { Printer, Download, Mail, MessageCircle, X, Plus, Phone, Landmark, Building2 } from "lucide-react";
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
  phoneNumber: string | null;
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
  posCounters?: { id: string; name: string }[];
}

export function SupplierStatementClient(props: Props) {
  const [showPayment, setShowPayment] = useState(false);
  const lang = useLang();

  function statementText() {
    const lines = [
      `${props.supplierName}${props.companyName ? ` (${props.companyName})` : ""} - Account Statement`,
      props.phoneNumber ? `Phone: ${props.phoneNumber}` : null,
      `Period: ${props.startDate} to ${props.endDate}`,
      "",
      "Date | Description | Credit (Maal Aya) | Debit (Payment) | Balance",
      ...props.entries.map(
        (e) => `${e.date} | ${e.description} | ${e.credit ? `Credit Rs ${e.credit.toLocaleString()}` : ""} | ${e.debit ? `Debit Rs ${e.debit.toLocaleString()}` : ""} | Rs ${e.runningBalance.toLocaleString()}`
      ),
      "",
      `Total Purchases (Credit): Rs ${props.totalCredit.toLocaleString()}`,
      `Total Payments (Debit): Rs ${props.totalDebit.toLocaleString()}`,
      `Closing Balance (Payable): Rs ${props.closingBalance.toLocaleString()}`,
    ].filter(Boolean);
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

      {/* Bank statement style header */}
      <div className="mb-4 overflow-hidden rounded-xl border border-surface-200 bg-white shadow-card dark:border-surface-700 dark:bg-surface-900 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-surface-100 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-800">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-brand-600" />
              <h2 className="font-display text-xl font-bold text-surface-900 dark:text-white">
                {props.supplierName}
              </h2>
            </div>
            {props.companyName && (
              <p className="mt-0.5 text-sm text-surface-500 dark:text-surface-400">{props.companyName}</p>
            )}
            {props.phoneNumber && (
              <div className="mt-1 flex items-center gap-1 text-sm text-surface-600 dark:text-surface-400">
                <Phone className="h-3.5 w-3.5" />
                <span>{props.phoneNumber}</span>
              </div>
            )}
          </div>
          <div className="text-right text-sm">
            <p className="font-medium text-surface-700 dark:text-surface-300">Account Statement</p>
            <p className="text-surface-500">{props.startDate} — {props.endDate}</p>
          </div>
        </div>

        {(props.bankName || props.bankAccountNumber) && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-surface-100 px-4 py-2.5 text-xs text-surface-600 dark:border-surface-700 dark:text-surface-400">
            <Landmark className="h-3.5 w-3.5 shrink-0 text-surface-400" />
            {props.bankName && <span><span className="font-medium text-surface-500">Bank:</span> {props.bankName}</span>}
            {props.bankAccountTitle && <span><span className="font-medium text-surface-500">Title:</span> {props.bankAccountTitle}</span>}
            {props.bankAccountNumber && <span><span className="font-medium text-surface-500">Account #:</span> {props.bankAccountNumber}</span>}
            {props.bankIban && <span><span className="font-medium text-surface-500">IBAN:</span> {props.bankIban}</span>}
          </div>
        )}

        <div className="grid grid-cols-3 divide-x divide-surface-100 dark:divide-surface-700">
          <div className="p-3 text-center">
            <p className="text-xs text-surface-400">Total Purchases (Credit)</p>
            <p className="mt-0.5 font-semibold text-blue-600">Rs {props.totalCredit.toLocaleString()}</p>
          </div>
          <div className="p-3 text-center">
            <p className="text-xs text-surface-400">Total Payments (Debit)</p>
            <p className="mt-0.5 font-semibold text-green-600">Rs {props.totalDebit.toLocaleString()}</p>
          </div>
          <div className="p-3 text-center">
            <p className="text-xs text-surface-400">Closing Balance (Payable)</p>
            <p className={`mt-0.5 font-semibold ${props.closingBalance > 0 ? "text-amber-600" : "text-surface-600"}`}>
              Rs {props.closingBalance.toLocaleString()}
            </p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-surface-100 bg-surface-50 text-left dark:border-surface-700 dark:bg-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500">Date</th>
              <th className="px-3 py-2 font-medium text-surface-500">Description</th>
              <th className="px-3 py-2 text-right font-medium text-blue-500">Credit (Maal Aya)</th>
              <th className="px-3 py-2 text-right font-medium text-green-500">Debit (Payment Di)</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Balance</th>
              <th className="px-3 py-2 font-medium text-surface-500">Slip</th>
            </tr>
          </thead>
          <tbody>
            {props.entries.map((e, i) => (
              <tr key={i} className="border-t border-surface-50 dark:border-surface-800">
                <td className="px-3 py-2 text-xs text-surface-400">{e.date}</td>
                <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{e.description}</td>
                <td className="px-3 py-2 text-right text-blue-600">{e.credit ? `Rs ${e.credit.toLocaleString()}` : <span className="text-surface-300">—</span>}</td>
                <td className="px-3 py-2 text-right text-green-600">{e.debit ? `Rs ${e.debit.toLocaleString()}` : <span className="text-surface-300">—</span>}</td>
                <td className="px-3 py-2 text-right font-medium text-surface-700 dark:text-surface-300">Rs {e.runningBalance.toLocaleString()}</td>
                <td className="px-3 py-2">
                  {e.slipUrl ? (
                    <a href={e.slipUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">View</a>
                  ) : <span className="text-surface-300">—</span>}
                </td>
              </tr>
            ))}
            {props.entries.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-surface-400">{t("c_no_tx_period", lang)}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showPayment && <PaymentModal supplierId={props.supplierId} posCounters={props.posCounters ?? []} onClose={() => setShowPayment(false)} />}
    </div>
  );
}

function PaymentModal({ supplierId, posCounters, onClose }: { supplierId: string; posCounters: { id: string; name: string }[]; onClose: () => void }) {
  const [state, formAction] = useFormState(recordSupplierPayment, initialState);
  const [payMethod, setPayMethod] = useState("cash");
  const [cashSource, setCashSource] = useState("office_cash");
  const lang = useLang();

  useEffect(() => { if (state.success) { const t = setTimeout(onClose, 800); return () => clearTimeout(t); } }, [state.success, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("c_record_payment", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">✓ Payment record ho gayi</p>}
        <form action={formAction} encType="multipart/form-data" className="space-y-2">
          <input type="hidden" name="supplier_id" value={supplierId} />
          <input type="date" name="payment_date" defaultValue={aajKaKhana()} className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white" />
          <input type="number" step="0.01" name="amount" required placeholder={t("c_amount_rs", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white" />
          <select name="payment_method" value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white">
            <option value="cash">{t("c_cash", lang)}</option>
            <option value="bank_transfer">{t("c_bank_transfer", lang)}</option>
            <option value="cheque">{t("c_cheque", lang)}</option>
            <option value="waseela_card">Waseela Card</option>
          </select>

          {payMethod === "cash" && (
            <div className="rounded-lg border border-surface-100 bg-surface-50 p-3 space-y-2 dark:border-surface-700 dark:bg-surface-800">
              <p className="text-xs font-medium text-surface-600 dark:text-surface-400">Cash kahan se aya?</p>
              <select name="cash_source" value={cashSource} onChange={(e) => setCashSource(e.target.value)} className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900 dark:text-white">
                <option value="office_cash">Office Cash</option>
                <option value="pos_golak">POS Golak</option>
                <option value="capital_investment">Capital / Investment</option>
              </select>
              {cashSource === "pos_golak" && posCounters.length > 0 && (
                <select name="pos_counter_id" className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900 dark:text-white">
                  <option value="">-- Counter chunein --</option>
                  {posCounters.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <input type="text" name="cash_source_note" placeholder="Short note — jaise: egg khareed, golak se" maxLength={120} className="w-full rounded-lg border border-surface-200 p-2 text-xs dark:border-surface-700 dark:bg-surface-900 dark:text-white" />
            </div>
          )}

          <textarea name="notes" rows={2} placeholder={t("c_notes", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white" />
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