"use client";
import { Printer, Download, Mail, MessageCircle } from "lucide-react";

interface Transaction {
  id: string;
  /** Karobar ki tareekh (transaction_date), na ke jab entry likhi gayi. */
  date: string;
  description: string;
  amount: number;
  /** Khate mein paisa aaya (income ya transfer_in), warna gaya. */
  isCredit: boolean;
  runningBalance: number;
}

interface Props {
  bankName: string;
  accountNumber: string | null;
  startDate: string;
  endDate: string;
  openingBalance: number;
  transactions: Transaction[];
  totalCredit: number;
  totalDebit: number;
  closingBalance: number;
}

export function StatementClient(props: Props) {
  function statementText() {
    const lines = [
      `${props.bankName} - Bank Statement`,
      props.accountNumber ? `Account: ${props.accountNumber}` : "",
      `Period: ${props.startDate} to ${props.endDate}`,
      "",
      `Opening Balance: Rs ${props.openingBalance.toLocaleString()}`,
      "",
      ...props.transactions.map(
        (t) =>
          `${t.date} | ${t.description} | ${t.isCredit ? "+" : "-"}Rs ${t.amount.toLocaleString()} | Balance: Rs ${t.runningBalance.toLocaleString()}`
      ),
      "",
      `Total Credit: Rs ${props.totalCredit.toLocaleString()}`,
      `Total Debit: Rs ${props.totalDebit.toLocaleString()}`,
      `Closing Balance: Rs ${props.closingBalance.toLocaleString()}`,
    ];
    return lines.filter(Boolean).join("\n");
  }

  function handlePrint() {
    window.print();
  }
  function handleDownload() {
    const blob = new Blob([statementText()], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${props.bankName.replace(/\s+/g, "-")}-statement-${props.startDate}-to-${props.endDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(statementText())}`, "_blank");
  }
  function handleEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent(`${props.bankName} Statement`)}&body=${encodeURIComponent(statementText())}`;
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
          <button onClick={handlePrint} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Printer className="h-4 w-4" /></button>
          <button onClick={handleDownload} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Download className="h-4 w-4" /></button>
          <button onClick={handleWhatsApp} className="rounded-lg border border-green-200 bg-green-50 p-2 text-green-700 hover:bg-green-100"><MessageCircle className="h-4 w-4" /></button>
          <button onClick={handleEmail} className="rounded-lg border border-surface-200 p-2 text-surface-600 hover:bg-surface-50"><Mail className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="mb-4 border-b border-surface-100 pb-3 dark:border-surface-800">
          <h2 className="font-display text-lg font-semibold text-surface-900 dark:text-white">{props.bankName}</h2>
          {props.accountNumber && <p className="text-sm text-surface-500">Account: {props.accountNumber}</p>}
          <p className="text-sm text-surface-500">{props.startDate} to {props.endDate}</p>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
            <p className="text-xs text-surface-400">Total Credit</p>
            <p className="font-semibold text-green-600">Rs {props.totalCredit.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
            <p className="text-xs text-surface-400">Total Debit</p>
            <p className="font-semibold text-red-600">Rs {props.totalDebit.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-brand-50 p-3 dark:bg-brand-900/20">
            <p className="text-xs text-brand-500">Closing Balance</p>
            <p className="font-semibold text-brand-700 dark:text-brand-300">Rs {props.closingBalance.toLocaleString()}</p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 text-left dark:border-surface-800">
              <th className="px-2 py-2 font-medium text-surface-500">Date</th>
              <th className="px-2 py-2 font-medium text-surface-500">Description</th>
              <th className="px-2 py-2 text-right font-medium text-surface-500">Amount</th>
              <th className="px-2 py-2 text-right font-medium text-surface-500">Balance</th>
            </tr>
          </thead>
          <tbody>
            {props.transactions.map((t) => (
              <tr key={t.id} className="border-b border-surface-50 last:border-0 dark:border-surface-800">
                <td className="px-2 py-1.5 text-surface-500">{t.date}</td>
                <td className="px-2 py-1.5 text-surface-700 dark:text-surface-300">{t.description}</td>
                <td className={`px-2 py-1.5 text-right font-medium ${t.isCredit ? "text-green-600" : "text-red-600"}`}>
                  {t.isCredit ? "+" : "-"}Rs {t.amount.toLocaleString()}
                </td>
                <td className="px-2 py-1.5 text-right text-surface-600 dark:text-surface-400">Rs {t.runningBalance.toLocaleString()}</td>
              </tr>
            ))}
            {props.transactions.length === 0 && (
              <tr><td colSpan={4} className="px-2 py-8 text-center text-surface-400">Is period mein koi transaction nahi hai.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}