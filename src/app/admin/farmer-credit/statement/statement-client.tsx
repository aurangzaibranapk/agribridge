"use client";
import Link from "next/link";
import { Printer, MessageCircle, Mail, ArrowLeft } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface LedgerRow {
  id: string;
  date: string;
  source_label: string;
  ledger_type: string;
  amount: number;
  collected_by: string | null;
  notes: string | null;
  balance_after: number;
}
interface SourceStat { label: string; amount: number; }

export function FarmerCreditStatementClient({
  farmerName,
  farmerCode,
  farmerPhone,
  creditLimit,
  ledger,
  totalDebit,
  totalCredit,
  balanceDue,
  bySource,
}: {
  farmerName: string;
  farmerCode: string;
  farmerPhone: string | null;
  creditLimit: number | null;
  ledger: LedgerRow[];
  totalDebit: number;
  totalCredit: number;
  balanceDue: number;
  bySource: SourceStat[];
}) {
  const shareText = `Al Rana Traders - Farmer Credit Statement\n${farmerName} (${farmerCode})\nTotal Issued: Rs ${totalDebit.toLocaleString()}\nTotal Paid: Rs ${totalCredit.toLocaleString()}\nBaaqi: Rs ${balanceDue.toLocaleString()}\n\nDekhein: ${typeof window !== "undefined" ? window.location.href : ""}`;

  const lang = useLang();

  function handlePrint() {
    window.print();
  }
  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/admin/farmer-credit" className="flex items-center gap-1 text-sm text-surface-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Wapas
        </Link>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            <Printer className="h-3.5 w-3.5" /> Print / PDF
          </button>
          <button onClick={handleWhatsApp} className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </button>
        </div>
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-8 shadow-card print:border-0 print:shadow-none">
        <div className="mb-6 border-b border-surface-200 pb-4">
          <h1 className="font-display text-xl font-bold text-surface-900">Al Rana Traders - AgriBridge</h1>
          <p className="text-sm text-surface-500">{t("fcl_statement_title", lang)}</p>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-surface-400">{t("c_farmer", lang)}</p>
            <p className="font-display text-lg font-semibold text-surface-900">{farmerName}</p>
            <p className="text-xs text-surface-500">Code: {farmerCode}</p>
            {farmerPhone && <p className="text-xs text-surface-500">Phone: {farmerPhone}</p>}
          </div>
          <div className="text-right text-xs text-surface-400">
            <p>Statement Date: {new Date().toLocaleDateString()}</p>
            {creditLimit && <p>Credit Limit: Rs {creditLimit.toLocaleString()}</p>}
          </div>
        </div>

        {bySource.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {bySource.map((s) => (
              <div key={s.label} className="rounded-lg bg-surface-50 p-2 text-center">
                <p className="text-xs text-surface-500">{s.label}</p>
                <p className="text-sm font-semibold text-surface-800">Rs {s.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        <table className="mb-6 w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 text-left">
              <th className="pb-2 font-medium text-surface-500">{t("c_date", lang)}</th>
              <th className="pb-2 font-medium text-surface-500">{t("c_detail", lang)}</th>
              <th className="pb-2 font-medium text-surface-500">{t("fc_taken_by", lang)}</th>
              <th className="pb-2 text-right font-medium text-surface-500">{t("fcl_issued_plus", lang)}</th>
              <th className="pb-2 text-right font-medium text-surface-500">{t("fcl_paid_minus", lang)}</th>
              <th className="pb-2 text-right font-medium text-surface-500">{t("c_balance", lang)}</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((r) => (
              <tr key={r.id} className="border-b border-surface-100">
                <td className="py-1.5 text-surface-600">{new Date(r.date).toLocaleDateString()}</td>
                <td className="py-1.5 text-surface-700">
                  {r.ledger_type === "debit" ? r.source_label : "Payment/Repayment"}
                  {r.notes && <p className="text-[10px] text-surface-400">{r.notes}</p>}
                </td>
                <td className="py-1.5 text-xs text-surface-500">{r.collected_by ?? "-"}</td>
                <td className="py-1.5 text-right text-surface-700">{r.ledger_type === "debit" ? `Rs ${r.amount.toLocaleString()}` : "-"}</td>
                <td className="py-1.5 text-right text-green-600">{r.ledger_type === "credit" ? `Rs ${r.amount.toLocaleString()}` : "-"}</td>
                <td className="py-1.5 text-right font-medium text-surface-900">Rs {r.balance_after.toLocaleString()}</td>
              </tr>
            ))}
            {ledger.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-surface-400">{t("c_no_records", lang)}</td></tr>
            )}
          </tbody>
        </table>

        <div className="flex justify-end border-t border-surface-200 pt-4">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-surface-500">{t("fcl_total_issued", lang)}</span><span>Rs {totalDebit.toLocaleString()}</span></div>
            <div className="flex justify-between text-green-600"><span>{t("c_total_paid", lang)}</span><span>- Rs {totalCredit.toLocaleString()}</span></div>
            <div className="flex justify-between border-t border-surface-200 pt-1 font-bold text-surface-900">
              <span>{balanceDue >= 0 ? "Baaqi (Farmer Ka Udhaar)" : "Company Farmer Ka De"}</span>
              <span>Rs {Math.abs(balanceDue).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-surface-100 pt-3">
          <p className="text-center text-[10px] text-surface-300">{t("fcl_computer_statement", lang)}</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-surface-400">Software by ZR Technologies</p>
            <p className="text-xs text-surface-400">0312-6513294</p>
          </div>
        </div>
      </div>
    </div>
  );
}