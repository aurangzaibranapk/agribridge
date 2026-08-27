"use client";
import { Printer, Download, MessageCircle, Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Bill {
  id: string;
  entry_date: string;
  grain_type: string;
  gross_weight_kg: number;
  cut_percentage: number;
  cut_kg: number;
  weight_kg: number;
  moisture_percentage: number | null;
  quality_grade: string | null;
  rate_per_kg: number;
  total_amount: number;
  warehouse_name: string;
  seller_name: string;
  seller_code: string | null;
  seller_phone: string | null;
  seller_type: string;
  notes: string | null;
}

const GRAIN_LABELS: Record<string, string> = { wheat: "Wheat (Gandum)", rice: "Rice (Chawal)", maize: "Maize (Makai)" };

export function GrainBillClient({ bill }: { bill: Bill }) {
  const billNumber = `GRN-BILL-${bill.id.slice(0, 8).toUpperCase()}`;
  const shareText = `AgriBridge Grain Bill ${billNumber}\n${bill.seller_name} - ${GRAIN_LABELS[bill.grain_type]}\nNet Weight: ${bill.weight_kg} kg @ Rs ${bill.rate_per_kg}/kg\nTotal: Rs ${bill.total_amount.toLocaleString()}\n\nDekhein: ${typeof window !== "undefined" ? window.location.href : ""}`;

  function handlePrint() {
    window.print();
  }
  function handleWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank");
  }
  function handleEmail() {
    const subject = encodeURIComponent(`AgriBridge Grain Bill - ${billNumber}`);
    const body = encodeURIComponent(shareText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/admin/grain-procurement" className="flex items-center gap-1 text-sm text-surface-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Wapas
        </Link>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            <Printer className="h-3.5 w-3.5" /> Print / PDF
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 rounded-lg bg-surface-100 px-3 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-200">
            <Download className="h-3.5 w-3.5" /> Download
          </button>
          <button onClick={handleWhatsApp} className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </button>
          <button onClick={handleEmail} className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
            <Mail className="h-3.5 w-3.5" /> Email
          </button>
        </div>
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-8 shadow-card print:border-0 print:shadow-none">
        <div className="mb-6 flex items-center justify-between border-b border-surface-200 pb-4">
          <div>
            <h1 className="font-display text-xl font-bold text-surface-900">Al Rana Traders</h1>
            <p className="text-sm text-surface-500">AgriBridge - Grain Procurement Bill</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-semibold text-surface-700">{billNumber}</p>
            <p className="text-xs text-surface-400">{bill.entry_date}</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-surface-400">{bill.seller_type}</p>
            <p className="font-medium text-surface-800">{bill.seller_name}</p>
            {bill.seller_code && <p className="text-xs text-surface-500">Code: {bill.seller_code}</p>}
            {bill.seller_phone && <p className="text-xs text-surface-500">Phone: {bill.seller_phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Warehouse</p>
            <p className="font-medium text-surface-800">{bill.warehouse_name}</p>
          </div>
        </div>

        <table className="mb-6 w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 text-left">
              <th className="pb-2 font-medium text-surface-500">Grain Type</th>
              <th className="pb-2 text-right font-medium text-surface-500">Gross Weight</th>
              <th className="pb-2 text-right font-medium text-surface-500">Cut</th>
              <th className="pb-2 text-right font-medium text-surface-500">Net Weight</th>
              <th className="pb-2 text-right font-medium text-surface-500">Rate/kg</th>
              <th className="pb-2 text-right font-medium text-surface-500">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-surface-100">
              <td className="py-2 font-medium text-surface-800">{GRAIN_LABELS[bill.grain_type]}</td>
              <td className="py-2 text-right text-surface-600">{bill.gross_weight_kg} kg</td>
              <td className="py-2 text-right text-red-600">-{bill.cut_kg.toFixed(1)} kg ({bill.cut_percentage}%)</td>
              <td className="py-2 text-right font-medium text-surface-800">{bill.weight_kg.toFixed(1)} kg</td>
              <td className="py-2 text-right text-surface-600">Rs {bill.rate_per_kg}</td>
              <td className="py-2 text-right font-semibold text-surface-900">Rs {bill.total_amount.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        {(bill.moisture_percentage || bill.quality_grade) && (
          <div className="mb-4 flex gap-6 text-xs text-surface-500">
            {bill.moisture_percentage && <span>Moisture: {bill.moisture_percentage}%</span>}
            {bill.quality_grade && <span>Quality Grade: {bill.quality_grade}</span>}
          </div>
        )}

        <div className="flex justify-end border-t border-surface-200 pt-4">
          <div className="w-56 space-y-1 text-sm">
            <div className="flex justify-between font-bold text-surface-900">
              <span>Total Payable</span>
              <span>Rs {bill.total_amount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {bill.notes && (
          <div className="mt-4 border-t border-surface-100 pt-2 text-xs text-surface-500">
            <p className="font-medium">Notes:</p>
            <p>{bill.notes}</p>
          </div>
        )}

        <p className="mt-8 text-center text-[10px] text-surface-300">Ye computer-generated bill hai - AgriBridge system se bana hai.</p>
      </div>
    </div>
  );
}