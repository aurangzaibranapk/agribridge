"use client";
import { Printer, MessageCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { GrainPaymentHistory, type GrainPaymentHistoryRow } from "@/components/grain/grain-payment-history";

const MAND_KG = 40;
const GRAIN_LABELS: Record<string, string> = { wheat: "Wheat (Gandum)", rice: "Rice (Munji/Chawal)", maize: "Maize (Makai)" };

export interface SaleBill {
  id: string;
  sale_number: string;
  sale_date: string;
  grain_type: string;
  quality_grade: string | null;
  quantity_kg: number;
  gross_weight_kg: number | null;
  cut_kg: number | null;
  rate_per_kg: number;
  total_amount: number;
  total_cogs: number;
  profit: number;
  amount_received: number;
  warehouse_name: string;
  buyer: { name: string; code: string | null; owner: string | null; phone: string | null; ntn: string | null; address: string | null };
  notes: string | null;
  /** Tay shuda deal (notes se). Mojood ho to bill par yehi figures dikhte hain. */
  deal?: { gross_kg: number; cut_per_60kg: number; rate_per_mand: number } | null;
}

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;
const kg = (n: number) => `${n.toLocaleString("en-PK", { maximumFractionDigits: 3 })} kg`;
const mand2 = (n: number) => `${(n / MAND_KG).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mand`;
const mand = (n: number) => `${(n / MAND_KG).toLocaleString("en-PK", { maximumFractionDigits: 2 })} mand`;

export function GrainSaleBillClient({ bill, payments, isAdmin }: { bill: SaleBill; payments: GrainPaymentHistoryRow[]; isAdmin: boolean }) {
  const lang = useLang();
  const balance = bill.total_amount - bill.amount_received;
  const ratePerMand = bill.rate_per_kg * MAND_KG;
  const deal = bill.deal ?? null;
  const dealCut = deal ? Math.round(deal.gross_kg * deal.cut_per_60kg / 60 * 1000) / 1000 : 0;
  const dealNet = deal ? deal.gross_kg - dealCut : 0;
  const shareText = `AgriBridge Grain Sale Bill ${bill.sale_number}\n${bill.buyer.name} - ${GRAIN_LABELS[bill.grain_type] ?? bill.grain_type}\nSaaf wazan: ${kg(bill.quantity_kg)} (${mand(bill.quantity_kg)})\nKul: ${rs(bill.total_amount)}\nWasool: ${rs(bill.amount_received)}\nBaqi: ${rs(balance)}`;

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/admin/grain-procurement/sell" className="flex items-center gap-1 text-sm text-surface-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" />{t("at_back", lang)}</Link>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            <Printer className="h-3.5 w-3.5" />Print</button>
          <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank")} className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">
            <MessageCircle className="h-3.5 w-3.5" />{t("at_whatsapp", lang)}</button>
        </div>
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-8 shadow-card print:border-0 print:p-0 print:shadow-none">
        <div className="mb-6 flex items-center justify-between border-b border-surface-200 pb-4">
          <div>
            <h1 className="font-display text-xl font-bold text-surface-900">{t("sh_company", lang)}</h1>
            <p className="text-sm text-surface-500">Grain Farokht Bill (Sale Bill)</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-semibold text-surface-700">{bill.sale_number}</p>
            <p className="text-xs text-surface-400">Tareekh: {bill.sale_date}</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Khareedar (Buyer)</p>
            <p className="font-medium text-surface-800">{bill.buyer.name}</p>
            {bill.buyer.code && <p className="text-xs text-surface-500">Code: {bill.buyer.code}</p>}
            {bill.buyer.owner && <p className="text-xs text-surface-500">Maalik: {bill.buyer.owner}</p>}
            {bill.buyer.phone && <p className="text-xs text-surface-500">Phone: {bill.buyer.phone}</p>}
            {bill.buyer.ntn && <p className="text-xs text-surface-500">NTN: {bill.buyer.ntn}</p>}
            {bill.buyer.address && <p className="text-xs text-surface-500">Pata: {bill.buyer.address}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Godam</p>
            <p className="font-medium text-surface-800">{bill.warehouse_name}</p>
            <p className="mt-2 text-xs text-surface-500">Jins: {GRAIN_LABELS[bill.grain_type] ?? bill.grain_type}</p>
            {bill.quality_grade && <p className="text-xs text-surface-500">Quality: {bill.quality_grade}</p>}
          </div>
        </div>

        {deal ? (
          <table className="mb-6 w-full text-sm">
            <tbody>
              <tr className="border-b border-surface-100"><td className="py-1.5 text-surface-600">Kul wazan (Gross)</td><td className="py-1.5 text-right">{kg(deal.gross_kg)} · {mand2(deal.gross_kg)}</td></tr>
              <tr className="border-b border-surface-100"><td className="py-1.5 text-surface-600">Katoti ({deal.cut_per_60kg} kg fi 60 kg)</td><td className="py-1.5 text-right text-red-600">-{kg(dealCut)} · {mand2(dealCut)}</td></tr>
              <tr className="border-b border-surface-100"><td className="py-1.5 font-medium text-surface-800">Saaf wazan</td><td className="py-1.5 text-right font-medium">{mand2(dealNet)} · {kg(dealNet)}</td></tr>
              <tr className="border-b border-surface-100"><td className="py-1.5 text-surface-600">Rate</td><td className="py-1.5 text-right">{rs(deal.rate_per_mand)} / mand</td></tr>
            </tbody>
          </table>
        ) : (
        <table className="mb-6 w-full text-sm">
          <tbody>
            {bill.gross_weight_kg != null && <tr className="border-b border-surface-100"><td className="py-1.5 text-surface-600">Kul wazan (Gross)</td><td className="py-1.5 text-right">{kg(bill.gross_weight_kg)} · {mand(bill.gross_weight_kg)}</td></tr>}
            {bill.cut_kg != null && <tr className="border-b border-surface-100"><td className="py-1.5 text-surface-600">Katoti</td><td className="py-1.5 text-right text-red-600">-{kg(bill.cut_kg)} · {mand(bill.cut_kg)}</td></tr>}
            <tr className="border-b border-surface-100"><td className="py-1.5 font-medium text-surface-800">Saaf wazan (bill ka)</td><td className="py-1.5 text-right font-medium">{kg(bill.quantity_kg)} · {mand(bill.quantity_kg)}</td></tr>
            <tr className="border-b border-surface-100"><td className="py-1.5 text-surface-600">Rate</td><td className="py-1.5 text-right">{rs(ratePerMand)} / mand · Rs {bill.rate_per_kg.toLocaleString("en-PK", { maximumFractionDigits: 3 })} / kg</td></tr>
          </tbody>
        </table>
        )}

        <div className="flex justify-end border-t border-surface-200 pt-4">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between font-semibold text-surface-900"><span>Kul raqam</span><span>{rs(bill.total_amount)}</span></div>
            <div className="flex justify-between text-green-700"><span>Wasool hua</span><span>- {rs(bill.amount_received)}</span></div>
            <div className="flex justify-between border-t border-surface-200 pt-1 font-bold text-surface-900"><span>Baqi raqam</span><span>{rs(balance)}</span></div>
          </div>
        </div>

        {isAdmin && (
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-surface-50 p-3 text-xs text-surface-600 print:hidden">
            <span><b>Lagat (cost):</b> {rs(bill.total_cogs)}</span>
            <span className="text-green-700"><b>Munafa:</b> {rs(bill.profit)}</span>
            {deal && <span className="col-span-2"><b>System note:</b> stock/ledger mein {kg(bill.quantity_kg)} ({mand(bill.quantity_kg)}) @ Rs {bill.rate_per_kg.toLocaleString("en-PK", { maximumFractionDigits: 3 })}/kg darj hai. Deal ka saaf wazan {kg(dealNet)}; farq {kg(dealNet - bill.quantity_kg)} katoti ka munafa.</span>}
          </div>
        )}

        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold text-surface-700">Wasooliyan (Payments received)</p>
          <GrainPaymentHistory rows={payments} emptyText="Is bill par abhi koi wasooli darj nahi hui." />
        </div>

        {bill.notes && (
          <div className="mt-4 border-t border-surface-100 pt-2 text-xs text-surface-500">
            <p className="font-medium">{t("ps_notes_label", lang)}</p>
            <p className="whitespace-pre-line">{bill.notes}</p>
          </div>
        )}

        <div className="mt-12 grid grid-cols-2 gap-10 text-center text-xs text-surface-500">
          <div className="border-t border-surface-300 pt-1">Dastakhat Khareedar</div>
          <div className="border-t border-surface-300 pt-1">Dastakhat / Mohar Al Rana Traders</div>
        </div>

        <p className="mt-8 text-center text-[10px] text-surface-300">{t("gb_computer_bill", lang)}</p>
      </div>
    </div>
  );
}
