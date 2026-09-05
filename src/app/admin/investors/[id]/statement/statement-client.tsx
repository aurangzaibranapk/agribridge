"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Printer, Download, Mail, MessageCircle, X, Plus, TrendingUp } from "lucide-react";
import { recordInvestorInvestment, recordInvestorReturn, type ActionState } from "@/actions/investor-transactions";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

interface Entry {
  date: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface Props {
  investorId: string;
  investorName: string;
  totalInvestedOverall: number;
  startDate: string;
  endDate: string;
  entries: Entry[];
  totalInvested: number;
  totalReturned: number;
  closingBalance: number;
}

export function InvestorStatementClient(props: Props) {
  const [showInvestment, setShowInvestment] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const lang = useLang();

  function statementText() {
    const lines = [
      `${props.investorName} - Statement`,
      `Period: ${props.startDate} to ${props.endDate}`,
      "",
      ...props.entries.map(
        (e) => `${e.date} | ${e.description} | ${e.credit ? `Investment: Rs ${e.credit.toLocaleString()}` : `Return: Rs ${e.debit.toLocaleString()}`} | Balance: Rs ${e.runningBalance.toLocaleString()}`
      ),
      "",
      `Total Investment (Is Period): Rs ${props.totalInvested.toLocaleString()}`,
      `Total Returns Paid: Rs ${props.totalReturned.toLocaleString()}`,
      `Closing Balance (Outstanding): Rs ${props.closingBalance.toLocaleString()}`,
      `Overall Total Invested (All Time): Rs ${props.totalInvestedOverall.toLocaleString()}`,
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
    a.download = `${props.investorName.replace(/\s+/g, "-")}-statement-${props.startDate}-to-${props.endDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(statementText())}`, "_blank");
  }
  function handleEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent(`${props.investorName} Statement`)}&body=${encodeURIComponent(statementText())}`;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <form className="flex items-center gap-2">
          <input type="date" name="start" defaultValue={props.startDate} className="rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="date" name="end" defaultValue={props.endDate} className="rounded-lg border border-surface-200 p-2 text-sm" />
          <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">{t("c_view", lang)}</button>
        </form>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowInvestment(true)} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" />{t("st_add_investment", lang)}</button>
          <button onClick={() => setShowReturn(true)} className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">
            <TrendingUp className="h-4 w-4" />{t("st_record_return", lang)}</button>
          <button onClick={handlePrint} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Printer className="h-4 w-4" /></button>
          <button onClick={handleDownload} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Download className="h-4 w-4" /></button>
          <button onClick={handleWhatsApp} className="rounded-lg border border-green-200 bg-green-50 p-2 text-green-700 hover:bg-green-100"><MessageCircle className="h-4 w-4" /></button>
          <button onClick={handleEmail} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Mail className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="mb-4 border-b border-surface-100 pb-3 dark:border-surface-800">
          <h2 className="font-display text-lg font-semibold text-surface-900 dark:text-white">{props.investorName}</h2>
          <p className="text-sm text-surface-500">{props.startDate} to {props.endDate}</p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <div className="rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
            <p className="text-xs text-surface-400">{t("st_investment_period", lang)}</p>
            <p className="font-semibold text-brand-700">Rs {props.totalInvested.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
            <p className="text-xs text-surface-400">{t("st_returns_paid", lang)}</p>
            <p className="font-semibold text-green-600">Rs {props.totalReturned.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <p className="text-xs text-amber-500">{t("c_closing_balance", lang)}</p>
            <p className="font-semibold text-amber-700">Rs {props.closingBalance.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-brand-50 p-3 dark:bg-brand-900/20">
            <p className="text-xs text-brand-500">{t("st_overall_invested", lang)}</p>
            <p className="font-semibold text-brand-700">Rs {props.totalInvestedOverall.toLocaleString()}</p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 text-left dark:border-surface-800">
              <th className="px-2 py-2 font-medium text-surface-500">{t("c_date", lang)}</th>
              <th className="px-2 py-2 font-medium text-surface-500">{t("c_description", lang)}</th>
              <th className="px-2 py-2 text-right font-medium text-surface-500">{t("st_investment", lang)}</th>
              <th className="px-2 py-2 text-right font-medium text-surface-500">{t("st_return_paid", lang)}</th>
              <th className="px-2 py-2 text-right font-medium text-surface-500">{t("c_balance", lang)}</th>
            </tr>
          </thead>
          <tbody>
            {props.entries.map((e, i) => (
              <tr key={i} className="border-b border-surface-50 last:border-0 dark:border-surface-800">
                <td className="px-2 py-1.5 text-surface-500">{e.date}</td>
                <td className="px-2 py-1.5 text-surface-700 dark:text-surface-300">{e.description}</td>
                <td className="px-2 py-1.5 text-right text-brand-700">{e.credit ? `Rs ${e.credit.toLocaleString()}` : "-"}</td>
                <td className="px-2 py-1.5 text-right text-green-600">{e.debit ? `Rs ${e.debit.toLocaleString()}` : "-"}</td>
                <td className="px-2 py-1.5 text-right text-surface-600 dark:text-surface-400">Rs {e.runningBalance.toLocaleString()}</td>
              </tr>
            ))}
            {props.entries.length === 0 && (
              <tr><td colSpan={5} className="px-2 py-8 text-center text-surface-400">{t("c_no_tx_period", lang)}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showInvestment && <InvestmentModal investorId={props.investorId} onClose={() => setShowInvestment(false)} />}
      {showReturn && <ReturnModal investorId={props.investorId} onClose={() => setShowReturn(false)} />}
    </div>
  );
}

function InvestmentModal({ investorId, onClose }: { investorId: string; onClose: () => void }) {
  const [state, formAction] = useFormState(recordInvestorInvestment, initialState);
  const lang = useLang();
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("st_add_investment", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="investor_id" value={investorId} />
          <input type="date" name="investment_date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="number" step="0.01" name="amount" required placeholder={t("c_amount_rs", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <textarea name="notes" rows={2} placeholder={t("c_notes_optional", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton label={t("st_save_investment", lang)} />
        </form>
      </div>
    </div>
  );
}

function ReturnModal({ investorId, onClose }: { investorId: string; onClose: () => void }) {
  const [state, formAction] = useFormState(recordInvestorReturn, initialState);
  const lang = useLang();
  if (state.success) setTimeout(onClose, 800);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900">{t("st_record_return", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="investor_id" value={investorId} />
          <input type="date" name="return_date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <input type="number" step="0.01" name="amount" required placeholder={t("c_amount_rs", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <textarea name="notes" rows={2} placeholder={t("c_notes_optional", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm" />
          <SubmitButton label={t("st_save_return", lang)} />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "..." : label}</button>;
}