import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { aajKaKhana } from "@/lib/utils/format";
import { shopPaymentMethodBreakdown } from "@/lib/pos/shop-payment-methods";
import { shopStockPosition } from "@/lib/pos/shop-360";
import { ShopOverviewClient } from "./shop-overview-client";
type DeskTask = { key: string; label: string; count: number | null; href: string; tone: "red" | "amber" | "blue" | "gray"; area: string };

/** Caller supplies only the authenticated profile's assigned shop. */
export async function ShopOverview({ shopId, branchId, userId, attentionItems, kpis = [] }: { shopId: string; branchId: string | null; userId: string; attentionItems: DeskTask[]; kpis?: { key: string; label: string; value: number | null }[] }) {
  const today = aajKaKhana();
  const todayDate = new Date(`${today}T12:00:00Z`);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(todayDate);
    date.setUTCDate(date.getUTCDate() - (6 - i));
    return date.toISOString().slice(0, 10);
  });
  const service = createServiceClient();
  try {
    const [methods, stock, salesTrend, customerRows] = await Promise.all([
      shopPaymentMethodBreakdown(shopId, today, today, { strict: true }),
      shopStockPosition(shopId, today, today, { strict: true }),
      service.from("pos_sales").select("total_amount,created_at").eq("shop_id", shopId)
        .gte("created_at", `${days[0]}T00:00:00+05:00`).lte("created_at", `${today}T23:59:59.999+05:00`),
      service.from("customers").select("id,farmer_id,created_at").eq("shop_id", shopId).eq("is_active", true).eq("is_deleted", false).order("created_at", { ascending: false }),
    ]);
    if (salesTrend.error) throw new Error("Shop sales trend could not be loaded.");
    const trendByDay = new Map(days.map(day => [day, 0]));
    for (const sale of (salesTrend.data ?? []) as { total_amount: number | string | null; created_at: string }[]) {
      const localDate = new Date(new Date(sale.created_at).getTime() + 5 * 60 * 60 * 1000);
      const day = localDate.toISOString().slice(0, 10);
      if (trendByDay.has(day)) trendByDay.set(day, (trendByDay.get(day) ?? 0) + Number(sale.total_amount ?? 0));
    }
    const trend = days.map(day => ({ day, sales: Math.round((trendByDay.get(day) ?? 0) * 100) / 100 }));
    const activeCustomers = (customerRows.data ?? []) as { id: string; farmer_id: string | null; created_at: string }[];
    const customerIds = activeCustomers.map(row => row.id);
    const newCustomersThisWeek = activeCustomers.filter(row => row.created_at >= `${days[0]}T00:00:00+05:00`).length;
    const farmerIds = [...new Set(activeCustomers.map(row => row.farmer_id).filter((id): id is string => Boolean(id)))];
    const farmersResult = farmerIds.length
      ? await service.from("farmers").select("id,full_name,farmer_code,phone_number,milk_liters_per_day").in("id", farmerIds).eq("is_deleted", false)
      : { data: [], error: null };
    const customerLedger = customerIds.length
      ? await service.from("journal_lines").select("party_id,debit,credit").eq("account_code", "1100").eq("party_type", "customer").in("party_id", customerIds)
      : { data: [], error: null };
    const balanceByCustomer = new Map<string, number>();
    for (const line of (customerLedger.data ?? []) as { party_id: string; debit: number | null; credit: number | null }[]) {
      balanceByCustomer.set(line.party_id, (balanceByCustomer.get(line.party_id) ?? 0) + Number(line.debit ?? 0) - Number(line.credit ?? 0));
    }
    const dueCustomers = [...balanceByCustomer.values()].filter(value => value > 0.005).length;
    const khataDue = customerLedger.error ? null : [...balanceByCustomer.values()].reduce((sum, value) => sum + Math.max(0, value), 0);
    const orderRows: { id: string; status: string }[] = [];
    let orderError = Boolean(customerRows.error);
    for (let offset = 0; offset < customerIds.length; offset += 100) {
      const result = await service.from("agri_orders").select("id,status").in("customer_id", customerIds.slice(offset, offset + 100));
      if (result.error) { orderError = true; break; }
      orderRows.push(...(result.data ?? []));
    }
    const orderResult = { data: orderRows, error: orderError };
    const orderCounts = orderResult.error ? null : {
      awaiting: (orderResult.data ?? []).filter(row => ["draft", "pending", "submitted"].includes(row.status)).length,
      processing: (orderResult.data ?? []).filter(row => ["sales_verified", "finance_verified", "approved", "dispatched", "in_transit"].includes(row.status)).length,
      completed: (orderResult.data ?? []).filter(row => row.status === "delivered" || row.status === "closed").length,
      approvals: (orderResult.data ?? []).filter(row => ["submitted", "sales_verified", "finance_verified"].includes(row.status)).length,
    };
    const nonCredit = methods.filter(m => !["khata","credit","customer_credit","udhaar"].includes(m.method));
    const credit = methods.filter(m => ["khata","credit","customer_credit","udhaar"].includes(m.method)).reduce((s,r)=>s+r.sales,0);
    const cash = methods.find(m => m.method === "cash")?.sales ?? 0;
    const digital = nonCredit.filter(m => m.method !== "cash").reduce((sum, row) => sum + row.sales, 0);
    // Load transactions in this schema are branch-tagged, not shop-tagged.
    // Do not silently fold other shops' activity into this shop dashboard.
    const orderApproval = attentionItems.find(item => item.key === "shop_orders_approval");
    const approvals = orderApproval ? [{ label: "Order approvals", count: orderApproval.count, href: orderApproval.href }] : [];
    const todaySale = nonCredit.reduce((s, r) => s + r.sales, 0) + credit;
    const liveKpis = [
      { key: "today_sales", label: "Aaj ki sale", value: todaySale },
      { key: "stock_value", label: "Stock value", value: stock.stockValueFifo },
      { key: "khata_due", label: "Khata due", value: khataDue },
      { key: "active_customers", label: "Active customers", value: customerRows.error ? null : activeCustomers.length },
      { key: "customers_with_due", label: "Due customers", value: customerLedger.error ? null : dueCustomers },
      { key: "new_customers", label: "Naye · 7 din", value: customerRows.error ? null : newCustomersThisWeek },
    ];
    return <ShopOverviewClient methods={methods} trend={trend} stock={stock.stockValueFifo} credit={credit} cash={cash} digital={digital} received={nonCredit.reduce((s,r)=>s+r.sales,0)} branchAvailable={Boolean(branchId)} customerHealth={{ total: customerRows.error ? null : activeCustomers.length, withBalance: customerLedger.error ? null : khataDue, newThisWeek: customerRows.error ? null : newCustomersThisWeek }} farmers={farmersResult.error ? null : farmersResult.data || []} approvals={approvals} orders={orderCounts} tasks={attentionItems.map(item => ({ key: item.key, label: item.label, count: item.count, tone: item.tone, href: item.href }))} userId={userId} kpis={[...liveKpis, ...kpis]}/>;
  } catch {
    return <div className="desk-card"><p>Shop ka financial data load nahi hua. Refresh karein; missing amounts ko zero nahi dikhaya gaya.</p><Link href="/admin/kharche" className="text-brand-700">Paisa & Khata kholein</Link></div>;
  }
}
