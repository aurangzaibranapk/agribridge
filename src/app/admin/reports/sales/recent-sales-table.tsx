"use client";
import { useState } from "react";
import { t, type Lang } from "@/lib/i18n/translations";
import { ReceiptModal } from "@/components/pos/receipt-modal";

/** Rs likhne ka ek hi tareeqa -- poore safhe par. */
function rs(n: number) {
  return `Rs. ${Math.round(n).toLocaleString()}`;
}

interface Row {
  id: string;
  date: string;
  location: string;
  cashier: string;
  paymentMode: string;
  amount: number;
  customer: string | null;
}

/**
 * "Kaun le gaya, kya le gaya" -- malik (16 September): reports ke
 * "Recent Sales" mein sirf raqam/waqt tha, customer ka naam nahi, aur
 * qatar par click kuch nahi karta tha. Poori tafseel (items, payment
 * breakdown, "Wasol kiya") pehle se `ReceiptModal` jaanta hai (POS
 * checkout ke baad wahi khulta hai) -- yahan bhi wohi, dobara nahi
 * likha.
 */
export function RecentSalesTable({ rows, lang }: { rows: Row[]; lang: Lang }) {
  const [openSaleId, setOpenSaleId] = useState<string | null>(null);

  if (rows.length === 0) {
    return <p className="text-sm text-surface-400">{t("rs_no_sales_period", lang)}</p>;
  }

  return (
    <>
      {openSaleId && <ReceiptModal saleId={openSaleId} onClose={() => setOpenSaleId(null)} lang={lang} />}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-surface-100 text-xs text-surface-500">
              <th className="py-2 pr-3">{t("c_date", lang)}</th>
              <th className="py-2 pr-3">{t("c_location", lang)}</th>
              <th className="py-2 pr-3">{t("pos_customer", lang)}</th>
              <th className="py-2 pr-3">{t("rs_cashier", lang)}</th>
              <th className="py-2 pr-3">{t("c_payment_mode", lang)}</th>
              <th className="py-2 pr-3">{t("c_amount", lang)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => setOpenSaleId(r.id)}
                className="cursor-pointer border-b border-surface-50 last:border-0 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800/60"
              >
                <td className="py-2 pr-3 text-surface-500">{new Date(r.date).toLocaleString()}</td>
                <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">{r.location}</td>
                <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">{r.customer ?? "Walk-in"}</td>
                <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">{r.cashier}</td>
                <td className="py-2 pr-3 capitalize text-surface-600 dark:text-surface-400">{r.paymentMode.replace("_", " ")}</td>
                <td className="py-2 pr-3 font-medium text-surface-900 dark:text-surface-100">{rs(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-surface-400">
        Kisi bhi qatar par click karein -- kya kya liya, kaun le gaya, poori tafseel khulegi.
      </p>
    </>
  );
}
