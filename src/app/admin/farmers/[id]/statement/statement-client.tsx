"use client";
import { Printer, Download, Mail, MessageCircle } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface Entry {
  date: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface Props {
  farmerName: string;
  farmerCode: string | null;
  startDate: string;
  endDate: string;
  entries: Entry[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

export function FarmerStatementClient(props: Props) {
  const lang = useLang();
  function statementText() {
    const lines = [
      `${props.farmerName}${props.farmerCode ? ` (${props.farmerCode})` : ""} - Statement`,
      `Period: ${props.startDate} to ${props.endDate}`,
      "",
      ...props.entries.map(
        (e) => `${e.date} | ${e.description} | ${e.debit ? `Debit: Rs ${e.debit.toLocaleString()}` : `Credit: Rs ${e.credit.toLocaleString()}`} | Balance: Rs ${e.runningBalance.toLocaleString()}`
      ),
      "",
      `Total Debit: Rs ${props.totalDebit.toLocaleString()}`,
      `Total Credit: Rs ${props.totalCredit.toLocaleString()}`,
      `Closing Balance: Rs ${props.closingBalance.toLocaleString()}`,
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
    a.download = `${props.farmerName.replace(/\s+/g, "-")}-statement-${props.startDate}-to-${props.endDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(statementText())}`, "_blank");
  }
  function handleEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent(`${props.farmerName} Statement`)}&body=${encodeURIComponent(statementText())}`;
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
          <button onClick={handlePrint} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Printer className="h-4 w-4" /></button>
          <button onClick={handleDownload} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Download className="h-4 w-4" /></button>
          <button onClick={handleWhatsApp} className="rounded-lg border border-green-200 bg-green-50 p-2 text-green-700 hover:bg-green-100"><MessageCircle className="h-4 w-4" /></button>
          <button onClick={handleEmail} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Mail className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="mb-4 border-b border-surface-100 pb-3 dark:border-surface-800">
          <h2 className="font-display text-lg font-semibold text-surface-900 dark:text-white">{props.farmerName} {props.farmerCode ? `(${props.farmerCode})` : ""}</h2>
          <p className="text-sm text-surface-500">{props.startDate} to {props.endDate}</p>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
            <p className="text-xs text-surface-400">{t("c_total_debit", lang)}</p>
            <p className="font-semibold text-red-600">Rs {props.totalDebit.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
            <p className="text-xs text-surface-400">{t("c_total_credit", lang)}</p>
            <p className="font-semibold text-green-600">Rs {props.totalCredit.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <p className="text-xs text-amber-500">{t("c_closing_balance", lang)}</p>
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
            </tr>
          </thead>
          <tbody>
            {props.entries.map((e, i) => (
              <tr key={i} className="border-b border-surface-50 last:border-0 dark:border-surface-800">
                <td className="px-2 py-1.5 text-surface-500">{e.date}</td>
                <td className="px-2 py-1.5 capitalize text-surface-700 dark:text-surface-300">{e.description}</td>
                <td className="px-2 py-1.5 text-right text-red-600">{e.debit ? `Rs ${e.debit.toLocaleString()}` : "-"}</td>
                <td className="px-2 py-1.5 text-right text-green-600">{e.credit ? `Rs ${e.credit.toLocaleString()}` : "-"}</td>
                <td className="px-2 py-1.5 text-right text-surface-600 dark:text-surface-400">Rs {e.runningBalance.toLocaleString()}</td>
              </tr>
            ))}
            {props.entries.length === 0 && (
              <tr><td colSpan={5} className="px-2 py-8 text-center text-surface-400">{t("c_no_tx_period", lang)}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}