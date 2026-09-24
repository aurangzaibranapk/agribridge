"use client";

import { Download, Mail, MessageCircle, Printer } from "lucide-react";

interface ExportRow {
  date: string;
  customer: string | null;
  location: string;
  cashier: string;
  paymentMode: string;
  amount: number;
}

interface Props {
  paymentLabel: string;
  dateLabel: string;
  totalAmount: number;
  totalCount: number;
  rows: ExportRow[];
}

function rs(n: number) {
  return `Rs. ${Math.round(n).toLocaleString()}`;
}

function buildText(props: Props): string {
  const { paymentLabel, dateLabel, totalAmount, totalCount, rows } = props;
  const lines: string[] = [
    `*AgriBridge — ${paymentLabel} Statement*`,
    `Arse: ${dateLabel}`,
    `Transactions: ${totalCount}`,
    `Kul: ${rs(totalAmount)}`,
    ``,
    ...rows.slice(0, 50).map((r, i) => {
      const d = new Date(r.date).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
      const cust = r.customer ?? "Walk-in";
      return `${i + 1}. ${d} | ${cust} | ${rs(r.amount)}`;
    }),
  ];
  if (rows.length > 50) lines.push(`... aur ${rows.length - 50} transactions`);
  return lines.join("\n");
}

export function StatementExportBar(props: Props) {
  const text = buildText(props);
  const encoded = encodeURIComponent(text);

  const handlePrint = () => window.print();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Statement copy ho gayi!");
    } catch {
      // fallback: select text from a hidden textarea
    }
  };

  return (
    <div className="no-print mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-surface-500">Export:</span>

      <button
        onClick={handlePrint}
        className="flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-semibold text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200 dark:hover:bg-surface-800"
      >
        <Printer className="h-3.5 w-3.5" /> Print / PDF
      </button>

      <a
        href={`https://wa.me/?text=${encoded}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-400"
      >
        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
      </a>

      <a
        href={`mailto:?subject=${encodeURIComponent(`AgriBridge — ${props.paymentLabel} Statement`)}&body=${encoded}`}
        className="flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-400"
      >
        <Mail className="h-3.5 w-3.5" /> Email
      </a>

      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-semibold text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200 dark:hover:bg-surface-800"
      >
        <Download className="h-3.5 w-3.5" /> Copy Text
      </button>
    </div>
  );
}
