import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { aajKaKhana } from "@/lib/utils/format";
import { shopPaymentMethodBreakdown } from "@/lib/pos/shop-payment-methods";
import { shopStockPosition } from "@/lib/pos/shop-360";
import { ShopOverviewClient } from "./shop-overview-client";
type DeskTask = { key: string; label: string; count: number | null; href: string; tone: "red" | "amber" | "blue" | "gray"; area: string };

/** Caller supplies only the authenticated profile's assigned shop. */
export async function ShopOverview({ shopId, branchId, userId, links, attentionItems }: { shopId: string; branchId: string | null; userId: string; links: { href: string; label: string }[]; attentionItems: DeskTask[] }) {
  const today = aajKaKhana();
  const todayDate = new Date(`${today}T12:00:00Z`);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(todayDate);
    date.setUTCDate(date.getUTCDate() - (6 - i));
    return date.toISOString().slice(0, 10);
  });
  const service = createServiceClient();
  try {
    const [methods, stock, salesTrend, customers, newCustomers, linkedFarmers] = await Promise.all([
      shopPaymentMethodBreakdown(shopId, today, today, { strict: true }),
      shopStockPosition(shopId, today, today, { strict: true }),
      service.from("pos_sales").select("total_amount,created_at").eq("shop_id", shopId)
        .gte("created_at", `${days[0]}T00:00:00+05:00`).lte("created_at", `${today}T23:59:59.999+05:00`),
      service.from("customers").select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("is_active", true).eq("is_deleted", false),
      service.from("customers").select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("is_active", true).eq("is_deleted", false).gte("created_at", `${days[0]}T00:00:00+05:00`),
      service.from("customers").select("farmer_id").eq("shop_id", shopId).eq("is_active", true).eq("is_deleted", false).not("farmer_id", "is", null).order("created_at", { ascending: false }).limit(5),
    ]);
    if (salesTrend.error) throw new Error("Shop sales trend could not be loaded.");
    const trendByDay = new Map(days.map(day => [day, 0]));
    for (const sale of (salesTrend.data ?? []) as { total_amount: number | string | null; created_at: string }[]) {
      const localDate = new Date(new Date(sale.created_at).getTime() + 5 * 60 * 60 * 1000);
      const day = localDate.toISOString().slice(0, 10);
      if (trendByDay.has(day)) trendByDay.set(day, (trendByDay.get(day) ?? 0) + Number(sale.total_amount ?? 0));
    }
    const trend = days.map(day => ({ day, sales: Math.round((trendByDay.get(day) ?? 0) * 100) / 100 }));
    const farmerIds = [...new Set((linkedFarmers.data ?? []).map(row => row.farmer_id).filter((id): id is string => Boolean(id)))];
    const farmersResult = farmerIds.length
      ? await service.from("farmers").select("id,full_name,farmer_code,phone_number,milk_liters_per_day").in("id", farmerIds).eq("is_deleted", false)
      : { data: [], error: null };
    const customerIds: string[] = [];
    let customerIdsError = false;
    for (let offset = 0; ; offset += 500) {
      const batch = await service.from("customers").select("id").eq("shop_id", shopId).eq("is_active", true).eq("is_deleted", false).order("id").range(offset, offset + 499);
      if (batch.error) { customerIdsError = true; break; }
      customerIds.push(...(batch.data ?? []).map(row => row.id));
      if ((batch.data ?? []).length < 500) break;
    }
    const orderRows: { id: string; status: string }[] = [];
    let orderError = customerIdsError;
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
    return <ShopOverviewClient methods={methods} trend={trend} stock={stock.stockValueFifo} credit={credit} cash={cash} digital={digital} received={nonCredit.reduce((s,r)=>s+r.sales,0)} links={links} branchAvailable={Boolean(branchId)} customerHealth={{ total: customers.error ? null : customers.count ?? 0, withBalance: null, newThisWeek: newCustomers.error ? null : newCustomers.count ?? 0 }} farmers={farmersResult.error ? null : farmersResult.data || []} approvals={approvals} orders={orderCounts} tasks={attentionItems.map(item => ({ key: item.key, label: item.label, count: item.count, tone: item.tone, href: item.href }))} userId={userId}/>;
  } catch {
    return <div className="desk-card"><p>Shop ka financial data load nahi hua. Refresh karein; missing amounts ko zero nahi dikhaya gaya.</p><Link href="/admin/kharche" className="text-brand-700">Paisa & Khata kholein</Link></div>;
  }
}
