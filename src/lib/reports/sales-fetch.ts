/**
 * pos_sales aur un ki payment details -- request karne wale ke apne
 * Supabase client se, is liye RLS aur scope (dukan/branch) wahi lagte hain
 * jo sales report par. Card (PR #98) wala hi source: koi void/return filter nahi.
 */
export type SalesScope = { meriDukan: string | null; shopId: string; branchId: string };
const PAGE = 1000;

export async function salesIn(supabase: any, scope: SalesScope, from: Date, to: Date) {
  const rows: { id: string; total_amount: number; created_at: string }[] = [];
  for (let off = 0; off < 200000; off += PAGE) {
    let q = supabase.from("pos_sales").select("id, total_amount, created_at")
      .gte("created_at", from.toISOString()).lt("created_at", to.toISOString())
      .order("created_at").range(off, off + PAGE - 1);
    if (scope.meriDukan) q = q.eq("shop_id", scope.meriDukan);
    else if (scope.shopId) q = q.eq("shop_id", scope.shopId);
    else if (scope.branchId) q = q.eq("branch_id", scope.branchId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export async function paymentsFor(supabase: any, saleIds: string[]) {
  const out: { sale_id: string; payment_method: string; amount: number }[] = [];
  for (let i = 0; i < saleIds.length; i += 300) {
    const { data } = await supabase.from("pos_sale_payment_details").select("sale_id, payment_method, amount").in("sale_id", saleIds.slice(i, i + 300));
    out.push(...((data ?? []) as any[]));
  }
  return out;
}
