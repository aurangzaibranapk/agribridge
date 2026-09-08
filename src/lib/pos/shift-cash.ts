import { createServiceClient } from "@/lib/supabase/service";

export interface ShiftCashSummary {
  saleCount: number;
  cashSalesTotal: number;
  cashReturnsTotal: number;
  /** opening_cash + cashSalesTotal − cashReturnsTotal. */
  expectedCash: number;
}

/**
 * Shift ka cash hisaab -- Close Shift (action) aur "abhi tak kitni sale
 * hui" wala live preview (UI), DONO isi se chalte hain. Ek jagah, taake
 * dikhaya gaya adad aur asal band karte waqt ginta gaya adad kabhi alag
 * na ho.
 *
 * Cash Recovery aur "other valid movement" abhi shamil NAHI -- POS abhi
 * unhen alag se track nahi karta. Jo track nahi hota us ko "Rs 0" nahi
 * likha jata, bas is hisaab mein shamil nahi kiya jata.
 */
export async function computeShiftCash(shiftId: string, openingCash: number): Promise<ShiftCashSummary> {
  const service = createServiceClient();
  const { data: shiftSales } = await service.from("pos_sales").select("id, cash_paid").eq("shift_id", shiftId);
  const rows = shiftSales ?? [];
  const cashSalesTotal = rows.reduce((s, r) => s + Number(r.cash_paid ?? 0), 0);
  const saleIds = rows.map((r) => r.id);

  let cashReturnsTotal = 0;
  if (saleIds.length > 0) {
    const { data: returns } = await service
      .from("pos_returns")
      .select("total_amount, refund_method")
      .in("sale_id", saleIds)
      .eq("refund_method", "cash");
    cashReturnsTotal = (returns ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  }

  return {
    saleCount: rows.length,
    cashSalesTotal,
    cashReturnsTotal,
    expectedCash: Number(openingCash) + cashSalesTotal - cashReturnsTotal,
  };
}
