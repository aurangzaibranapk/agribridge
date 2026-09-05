"use client";
import Link from "next/link";
import { Printer, MessageCircle, Mail, ArrowLeft } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface LedgerRow {
  id: string;
  date: string;
  kind: "entry" | "payment";
  amount: number;
  balance_after: number;
  grain_type?: string;
  weight_kg?: number;
  rate_per_kg?: number;
  payment_method?: string | null;
  notes?: string | null;
}
interface GrainTypeStat {
  grain_type: string;
  label: string;
  totalKg: number;
  totalValue: number;
}

const GRAIN_LABELS: Record<string, string> = { wheat: "Wheat (Gandum)", rice: "Rice (Chawal)", maize: "Maize (Makai)" };

export function GrainStatementClient({
  sellerName,
  sellerType,
  sellerCode,
  sellerPhone,
  ledger,
  totalSupplied,
  totalPaid,
  balanceDue,
  byGrainType,
}: {
  sellerName: string;
  sellerType: string;
  sellerCode: string | null;
  sellerPhone: string | null;
  ledger: LedgerRow[];
  totalSupplied: number;
  totalPaid: number;
  balanceDue: number;
  byGrainType: GrainTypeStat[];
}) {
  const shareText = `AgriBridge Grain Statement\n${sellerName}\nTotal Supply: Rs ${totalSupplied.toLocaleString()}\nTotal Paid: Rs ${totalPaid.toLocaleString()}\nBaaqi: Rs ${balanceDue.toLocaleString()}\n\nDekhein: ${typeof window !== "undefined" ? window.location.href : ""}`;

  const lang = useLang();

  function handlePrint() {
    window.print();
  }
  function handleWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  }
  function handleEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent(`AgriBridge Statement - ${sellerName}`)}&body=${encodeURIComponent(shareText)}`;
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/admin/grain-procurement" className="flex items-center gap-1 text-sm text-surface-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" />{t("at_back", lang)}</Link>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            <Printer className="h-3.5 w-3.5" />{t("at_print_pdf", lang)}</button>
          <button onClick={handleWhatsApp} className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">
            <MessageCircle className="h-3.5 w-3.5" />{t("at_whatsapp", lang)}</button>
          <button onClick={handleEmail} className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
            <Mail className="h-3.5 w-3.5" />{t("at_email", lang)}</button>
        </div>
      </div>

      <div className="rounded-card border border-surface-200 bg-white p-8 shadow-card print:border-0 print:shadow-none">
        <div className="mb-6 border-b border-surface-200 pb-4">
          <h1 className="font-display text-xl font-bold text-surface-900">{t("at_alrana_agribridge", lang)}</h1>
          <p className="text-sm text-surface-500">{t("gst_title", lang)}</p>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-surface-400">{sellerType === "farmer" ? "Farmer" : "Party"}</p>
            <p className="font-display text-lg font-semibold text-surface-900">{sellerName}</p>
            {sellerCode && <p className="text-xs text-surface-500">Code: {sellerCode}</p>}
            {sellerPhone && <p className="text-xs text-surface-500">Phone: {sellerPhone}</p>}
          </div>
          <div className="text-right text-xs text-surface-400">Statement Date: {new Date().toLocaleDateString()}</div>
        </div>

        {byGrainType.length > 0 && (
          <div className="mb-6 grid grid-cols-3 gap-3">
            {byGrainType.map((g) => (
              <div key={g.grain_type} className="rounded-lg bg-surface-50 p-2 text-center">
                <p className="text-xs text-surface-500">{g.label}</p>
                <p className="text-sm font-semibold text-surface-800">{g.totalKg.toLocaleString()} kg</p>
                <p className="text-xs text-surface-400">Rs {g.totalValue.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        <table className="mb-6 w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 text-left">
              <th className="pb-2 font-medium text-surface-500">{t("c_date", lang)}</th>
              <th className="pb-2 font-medium text-surface-500">{t("c_detail", lang)}</th>
              <th className="pb-2 text-right font-medium text-surface-500">{t("gst_supply_plus", lang)}</th>
              <th className="pb-2 text-right font-medium text-surface-500">{t("gst_payment_minus", lang)}</th>
              <th className="pb-2 text-right font-medium text-surface-500">{t("c_balance", lang)}</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((row) => (
              <tr key={row.id} className="border-b border-surface-100">
                <td className="py-1.5 text-surface-600">{new Date(row.date).toLocaleDateString()}</td>
                <td className="py-1.5 text-surface-700">
                  {row.kind === "entry" ? (
                    <span>{GRAIN_LABELS[row.grain_type ?? ""]} - {row.weight_kg} kg @ Rs {row.rate_per_kg}</span>
                  ) : (
                    <span>Payment ({row.payment_method ?? "cash"}){row.notes ? ` - ${row.notes}` : ""}</span>
                  )}
                </td>
                <td className="py-1.5 text-right text-surface-700">{row.kind === "entry" ? `Rs ${row.amount.toLocaleString()}` : "-"}</td>
                <td className="py-1.5 text-right text-green-600">{row.kind === "payment" ? `Rs ${row.amount.toLocaleString()}` : "-"}</td>
                <td className="py-1.5 text-right font-medium text-surface-900">Rs {row.balance_after.toLocaleString()}</td>
              </tr>
            ))}
            {ledger.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-surface-400">{t("c_no_records", lang)}</td></tr>
            )}
          </tbody>
        </table>

        <div className="flex justify-end border-t border-surface-200 pt-4">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-surface-500">{t("gst_total_supply_value", lang)}</span><span>Rs {totalSupplied.toLocaleString()}</span></div>
            <div className="flex justify-between text-green-600"><span>{t("c_total_paid", lang)}</span><span>- Rs {totalPaid.toLocaleString()}</span></div>
            <div className="flex justify-between border-t border-surface-200 pt-1 font-bold text-surface-900">
              <span>{balanceDue >= 0 ? "Baaqi (Payable)" : "Zyada Diya Gaya"}</span>
              <span>Rs {Math.abs(balanceDue).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-[10px] text-surface-300">{t("gst_computer_statement", lang)}</p>
      </div>
    </div>
  );
}