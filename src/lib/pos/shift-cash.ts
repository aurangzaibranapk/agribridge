import { createServiceClient } from "@/lib/supabase/service";

export interface ShiftCashSummary {
  saleCount: number;
  /** pos_sales.total_amount ka jama -- poori bikri, tareeqa chahe koi ho. */
  totalSales: number;
  /** Sirf CASH tareeqe se aaya paisa (pos_sale_payment_details, method='cash'). */
  cashSalesTotal: number;
  /** Udhaar (Khata) par gaya hissa. */
  khataTotal: number;
  /** Bank/card/Easypaisa/JazzCash/QR -- na cash na khata. */
  digitalTotal: number;
  cashReturnsTotal: number;
  /** opening_cash + cashSalesTotal − cashReturnsTotal. */
  expectedCash: number;
}

/**
 * Khaali jama -- opening_cash rakhne ke ilawa sab sifar. Ye khud kisi
 * ka jhoota "sab theek hai" nahi -- caller ko pata hai ke is shift mein
 * abhi tak koi sale/return record nahi mila.
 */
function emptySummary(openingCash: number): ShiftCashSummary {
  return { saleCount: 0, totalSales: 0, cashSalesTotal: 0, khataTotal: 0, digitalTotal: 0, cashReturnsTotal: 0, expectedCash: openingCash };
}

/**
 * Asal hisaab -- ek shift ki (pehle se fetch ki hui) sales/payments/
 * returns ki qatarein le kar jama karta hai. `computeShiftCash` (ek
 * shift, khud fetch karta hai) aur report page (kai shift, ek sath bulk
 * fetch kar ke ye function har shift ke liye alag se bulati hai) DONO
 * yehi istemal karte hain -- taake formula ek hi jagah rahe.
 *
 * `pos_sales.cash_paid` ka naam gumraah karta hai -- ismein cash + bank +
 * digital, TEENON shamil hain (sirf khata alag hai; dekhein pos-client.tsx
 * ka `cashCollected = deyRaqam - khataTotal`). Golak mein asal mein kitna
 * paisa hona chahiye, is ka jawab sirf `pos_sale_payment_details` se milta
 * hai, jahan har tareeqa (cash/bank/jazzcash/...) apni ALAG qatar mein hai.
 */
export function aggregateShiftCash(
  openingCash: number,
  sales: { total_amount: number | string | null; khata_amount: number | string | null }[],
  payments: { payment_method: string | null; amount: number | string | null }[],
  returns: { total_amount: number | string | null }[]
): ShiftCashSummary {
  const totalSales = sales.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  const khataTotal = sales.reduce((s, r) => s + Number(r.khata_amount ?? 0), 0);

  let cashSalesTotal = 0;
  let digitalTotal = 0;
  for (const p of payments) {
    const amt = Number(p.amount ?? 0);
    if (p.payment_method === "cash") cashSalesTotal += amt;
    else digitalTotal += amt;
  }

  const cashReturnsTotal = returns.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

  return {
    saleCount: sales.length,
    totalSales,
    cashSalesTotal,
    khataTotal,
    digitalTotal,
    cashReturnsTotal,
    expectedCash: Number(openingCash) + cashSalesTotal - cashReturnsTotal,
  };
}

/**
 * EK shift ka cash hisaab, khud fetch kar ke. Close Shift (action) aur
 * "abhi tak kitni sale hui" wala live preview (UI), DONO isi se chalte
 * hain -- taake dikhaya gaya adad aur asal band karte waqt ginta gaya
 * adad kabhi alag na ho.
 *
 * Cash Recovery aur "other valid movement" abhi shamil NAHI -- POS abhi
 * unhen alag se track nahi karta. Jo track nahi hota us ko "Rs 0" nahi
 * likha jata, bas is hisaab mein shamil nahi kiya jata.
 */
export async function computeShiftCash(shiftId: string, openingCash: number): Promise<ShiftCashSummary> {
  const service = createServiceClient();
  const { data: shiftSales } = await service.from("pos_sales").select("id, total_amount, khata_amount").eq("shift_id", shiftId);
  const rows = shiftSales ?? [];
  if (rows.length === 0) return emptySummary(openingCash);

  const saleIds = rows.map((r) => r.id);
  const [{ data: payments }, { data: returns }] = await Promise.all([
    service.from("pos_sale_payment_details").select("payment_method, amount").in("sale_id", saleIds),
    service.from("pos_returns").select("total_amount, refund_method").in("sale_id", saleIds).eq("refund_method", "cash"),
  ]);

  return aggregateShiftCash(openingCash, rows, payments ?? [], returns ?? []);
}
