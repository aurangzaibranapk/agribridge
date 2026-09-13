import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/ui/layout-primitives";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { BranchFilter } from "@/components/dashboard/branch-filter";
import { isDateRangeKey, getDateRange, type DateRangeKey } from "@/lib/utils/dashboard-filters";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { aggregateShiftCash } from "@/lib/pos/shift-cash";
import { Receipt, Wallet, Smartphone, HandCoins, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

function rs(n: number): string {
  return `Rs ${Math.round(n).toLocaleString()}`;
}

/**
 * POS Shift Report -- Phase 13. Malik: "kis shift mein kitna tha, kitna
 * paid off, kitna aaya, kitna gaya, kitna outstanding bana."
 *
 * Branch → Shop → Counter → Shift → Staff -- har qatar ek shift, aur us
 * ka poora hisaab: Total Sale, Cash, Digital, Khata (Outstanding),
 * Returns, Opening/Expected/Counted/Difference.
 *
 * Band shift ke Counted/Expected/Difference DATABASE se (jo close ke
 * waqt likhe gaye) -- dobara ginte nahi, taake report aur asal band
 * karte waqt ka adad kabhi alag na ho. Khule shift ke liye "abhi tak"
 * ka live hisaab isi module (`aggregateShiftCash`) se, jo Close Shift
 * bhi istemal karta hai.
 */
export default async function PosShiftReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; branch?: string }>;
}) {
  const params = await searchParams;
  const range: DateRangeKey = isDateRangeKey(params.range) ? params.range : "week";
  const { start, end } = getDateRange(range);
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role, branch_id").eq("id", user?.id ?? "").maybeSingle();
  const sabKuchWala = UNRESTRICTED_ROLES.includes(String(me?.role ?? ""));
  const meriBranch = !sabKuchWala ? ((me?.branch_id as string | null) ?? null) : null;
  const branchId = meriBranch ?? params.branch ?? "";

  const service = createServiceClient();
  const { data: branches } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");

  let shiftsQuery = service
    .from("pos_shifts")
    .select(
      "id, shift_number, status, opened_at, closed_at, opening_cash, counted_cash, expected_cash, difference, staff_id, counter_id, pos_counters(name, branch_id, shop_id, branches(name), shops(name))"
    )
    .gte("opened_at", start.toISOString())
    .lte("opened_at", end.toISOString())
    .order("opened_at", { ascending: false })
    .limit(200);
  const { data: shiftsRaw } = await shiftsQuery;

  const allShifts = (shiftsRaw ?? []) as any[];
  const shifts = branchId ? allShifts.filter((s) => s.pos_counters?.branch_id === branchId) : allShifts;

  const staffIds = [...new Set(shifts.map((s) => s.staff_id).filter(Boolean))];
  const { data: staffRows } = staffIds.length
    ? await service.from("profiles").select("id, full_name").in("id", staffIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const staffName = new Map((staffRows ?? []).map((p) => [p.id, p.full_name ?? "—"]));

  // Sab shifts ki sales ek sath -- N alag calls ke bajaye ek batch.
  const shiftIds = shifts.map((s) => s.id);
  const { data: allSales } = shiftIds.length
    ? await service.from("pos_sales").select("id, shift_id, total_amount, khata_amount").in("shift_id", shiftIds)
    : { data: [] as { id: string; shift_id: string; total_amount: number; khata_amount: number }[] };
  const saleIds = (allSales ?? []).map((s) => s.id);
  // Return `sale_id` se nahi, `shift_id` se jama hota hai (380) -- aaj ki
  // shift mein kal ki bikri ka cash refund bhi golak se nikalta hai.
  // `sale_id` wala purana jorr aisi wapsiyan asal bikri wali (purani)
  // shift mein daal deta, jo ke ghalat hai jab wapsi kisi baad ki shift
  // mein hui ho.
  const [{ data: allPayments }, { data: allReturns }] = await Promise.all([
    saleIds.length
      ? service.from("pos_sale_payment_details").select("sale_id, payment_method, amount").in("sale_id", saleIds)
      : Promise.resolve({ data: [] as { sale_id: string; payment_method: string; amount: number }[] }),
    shiftIds.length
      ? service.from("pos_returns").select("shift_id, total_amount, refund_method").in("shift_id", shiftIds).eq("refund_method", "cash")
      : Promise.resolve({ data: [] as { shift_id: string | null; total_amount: number; refund_method: string }[] }),
  ]);

  const salesByShift = new Map<string, typeof allSales>();
  (allSales ?? []).forEach((s) => {
    if (!s.shift_id) return;
    const arr = salesByShift.get(s.shift_id) ?? [];
    arr.push(s);
    salesByShift.set(s.shift_id, arr as any);
  });
  const paymentsBySale = new Map<string, { payment_method: string; amount: number }[]>();
  (allPayments ?? []).forEach((p) => {
    const arr = paymentsBySale.get(p.sale_id) ?? [];
    arr.push(p);
    paymentsBySale.set(p.sale_id, arr);
  });
  const returnsByShift = new Map<string, { total_amount: number }[]>();
  (allReturns ?? []).forEach((r) => {
    if (!r.shift_id) return;
    const arr = returnsByShift.get(r.shift_id) ?? [];
    arr.push(r);
    returnsByShift.set(r.shift_id, arr);
  });

  const rows = shifts.map((s) => {
    const counter = Array.isArray(s.pos_counters) ? s.pos_counters[0] : s.pos_counters;
    const branch = Array.isArray(counter?.branches) ? counter.branches[0] : counter?.branches;
    const shop = Array.isArray(counter?.shops) ? counter.shops[0] : counter?.shops;
    const mySales = (salesByShift.get(s.id) ?? []) as { id: string; total_amount: number; khata_amount: number }[];
    const myPayments = mySales.flatMap((sale) => paymentsBySale.get(sale.id) ?? []);
    const myReturns = returnsByShift.get(s.id) ?? [];
    const live = aggregateShiftCash(Number(s.opening_cash), mySales, myPayments, myReturns);

    const isClosed = s.status === "closed";
    return {
      id: s.id as string,
      shiftNumber: s.shift_number as string,
      status: s.status as string,
      branchName: (branch?.name as string | undefined) ?? "—",
      shopName: (shop?.name as string | undefined) ?? "—",
      counterName: (counter?.name as string | undefined) ?? "—",
      staffName: staffName.get(s.staff_id) ?? "—",
      openedAt: s.opened_at as string,
      closedAt: s.closed_at as string | null,
      totalSales: live.totalSales,
      cashSalesTotal: live.cashSalesTotal,
      digitalTotal: live.digitalTotal,
      khataTotal: live.khataTotal,
      cashReturnsTotal: live.cashReturnsTotal,
      openingCash: Number(s.opening_cash),
      // Band shift: database mein jo likha gaya wohi asal hai. Khula
      // shift: abhi tak ka live hisaab.
      expectedCash: isClosed ? Number(s.expected_cash ?? live.expectedCash) : live.expectedCash,
      countedCash: isClosed ? (s.counted_cash != null ? Number(s.counted_cash) : null) : null,
      difference: isClosed ? (s.difference != null ? Number(s.difference) : null) : null,
    };
  });

  const kulSale = rows.reduce((sum, r) => sum + r.totalSales, 0);
  const kulCash = rows.reduce((sum, r) => sum + r.cashSalesTotal, 0);
  const kulKhata = rows.reduce((sum, r) => sum + r.khataTotal, 0);
  const farqWaliShifts = rows.filter((r) => r.difference != null && Math.abs(r.difference) > 0.5).length;

  return (
    <div>
      <PageHeader
        title="POS Shift Report"
        description="Branch → Shop → Counter → Shift → Staff — har shift ka poora hisaab: kitna aaya, kis tareeqe se, kitna udhaar bana."
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <DateRangeFilter current={range} />
        {!meriBranch && <BranchFilter branches={branches ?? []} current={branchId} />}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Kul Sale" value={rs(kulSale)} icon={Receipt} tone="brand" />
        <StatCard label="Cash" value={rs(kulCash)} icon={Wallet} tone="green" />
        <StatCard label="Khata (Outstanding)" value={rs(kulKhata)} icon={HandCoins} tone="orange" />
        <StatCard label="Farq wali Shifts" value={String(farqWaliShifts)} icon={AlertTriangle} tone={farqWaliShifts > 0 ? "red" : "blue"} />
      </div>

      <div className="mt-6 overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-surface-400">Is arse mein koi shift nahi mili.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-xs text-surface-500 dark:border-surface-800">
                  <th className="py-2 pl-4 pr-3">Shift</th>
                  <th className="py-2 pr-3">Branch → Shop → Counter</th>
                  <th className="py-2 pr-3">Staff</th>
                  <th className="py-2 pr-3">Khula / Band</th>
                  <th className="py-2 pr-3 text-right">Total Sale</th>
                  <th className="py-2 pr-3 text-right">Cash</th>
                  <th className="py-2 pr-3 text-right">Digital</th>
                  <th className="py-2 pr-3 text-right">Khata</th>
                  <th className="py-2 pr-3 text-right">Opening</th>
                  <th className="py-2 pr-3 text-right">Expected</th>
                  <th className="py-2 pr-3 text-right">Counted</th>
                  <th className="py-2 pr-4 text-right">Farq</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-surface-50 last:border-0 dark:border-surface-800">
                    <td className="py-2 pl-4 pr-3">
                      <span className="font-mono text-xs text-surface-500">{r.shiftNumber}</span>
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          r.status === "open"
                            ? "bg-amber-100 text-amber-800 dark:bg-surface-800 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-surface-800 dark:text-emerald-300"
                        }`}
                      >
                        {r.status === "open" ? "Khula" : "Band"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">
                      {r.branchName} → {r.shopName} → {r.counterName}
                    </td>
                    <td className="py-2 pr-3 text-surface-700 dark:text-surface-300">{r.staffName}</td>
                    <td className="py-2 pr-3 text-xs text-surface-500">
                      {new Date(r.openedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {r.closedAt && (
                        <>
                          {" "}
                          →{" "}
                          {new Date(r.closedAt).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium tabular-nums text-surface-900 dark:text-white">{rs(r.totalSales)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-surface-700 dark:text-surface-300">{rs(r.cashSalesTotal)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-surface-700 dark:text-surface-300">
                      {r.digitalTotal > 0 ? rs(r.digitalTotal) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-amber-700 dark:text-amber-400">
                      {r.khataTotal > 0 ? rs(r.khataTotal) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-surface-500">{rs(r.openingCash)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-surface-700 dark:text-surface-300">{rs(r.expectedCash)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-surface-700 dark:text-surface-300">
                      {r.countedCash != null ? rs(r.countedCash) : "—"}
                    </td>
                    <td
                      className={`py-2 pr-4 text-right font-medium tabular-nums ${
                        r.difference == null
                          ? "text-surface-400"
                          : Math.abs(r.difference) < 0.5
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-red-700 dark:text-red-400"
                      }`}
                    >
                      {r.difference != null ? rs(r.difference) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-3 flex items-start gap-1.5 px-1 text-xs text-surface-400">
        <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        "Cash Recovery" aur doosri chhoti cash harkatein abhi is hisaab mein shamil nahi — POS unhen alag se track nahi karta, is liye "Rs 0" ki jagah khali chhoda gaya hai.
      </p>
    </div>
  );
}
