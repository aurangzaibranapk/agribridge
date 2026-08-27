"use client";
import { Printer, Download, MessageCircle, Mail } from "lucide-react";

interface ReportSummary {
  farmerName: string;
  periodLabel: string;
  totalLiters: number;
  totalAmount: number;
  entries: { entry_date: string; quantity_liters: number; total_amount: number }[];
}

export function ReportActions({ summary }: { summary: ReportSummary }) {
  function handlePrint() {
    window.print();
  }

  function handleDownloadCsv() {
    const header = "Date,Litres,Amount\n";
    const rows = summary.entries.map((e) => `${e.entry_date},${e.quantity_liters},${e.total_amount}`).join("\n");
    const csv = header + rows + `\n\nTotal,${summary.totalLiters},${summary.totalAmount}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `milk-report-${summary.farmerName.replace(/\s+/g, "-")}-${summary.periodLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function buildSummaryText() {
    return `Milk Report - ${summary.farmerName}\nPeriod: ${summary.periodLabel}\nTotal Litres: ${summary.totalLiters.toFixed(1)}L\nTotal Amount: Rs. ${summary.totalAmount.toLocaleString()}`;
  }

  function handleWhatsApp() {
    const text = encodeURIComponent(buildSummaryText());
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  function handleEmail() {
    const subject = encodeURIComponent(`Milk Report - ${summary.farmerName}`);
    const body = encodeURIComponent(buildSummaryText());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button onClick={handlePrint} className="flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50">
        <Printer className="h-3.5 w-3.5" /> Print
      </button>
      <button onClick={handleDownloadCsv} className="flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50">
        <Download className="h-3.5 w-3.5" /> Download CSV
      </button>
      <button onClick={handleWhatsApp} className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">
        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
      </button>
      <button onClick={handleEmail} className="flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50">
        <Mail className="h-3.5 w-3.5" /> Email
      </button>
    </div>
  );
}