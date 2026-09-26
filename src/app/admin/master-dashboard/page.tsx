import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { aajKaKhana } from "@/lib/utils/format";
import { PageHeader } from "@/components/ui/layout-primitives";
import { MasterDashboardActions } from "./master-dashboard-actions";
import { ClickableCards } from "./clickable-cards";
import { getBusinessContext, BUSINESS_LABELS } from "@/lib/utils/get-business-context";
import { position, partyBalances } from "@/lib/ledger/reports";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { ModernMasterDashboard } from "./modern-master-dashboard";

export const dynamic = "force-dynamic";
const SELL_WEEKS = 5;

export default async function MasterDashboardPage({
  searchParams,
}: {
  searchParams: { shop_id?: string };
}) {
  const shopId = searchParams.shop_id || null;
  const supabase = createClient();
  const serviceClient = createServiceClient();
  const businessContext = await getBusinessContext();
  const lang = getLanguageFromCookies("rm");
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthStart = new Date(year, month - 1, 1).toISOString().slice(0, 10);
  const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10);
  const nextMonthStart = new Date(year, month, 1).toISOString().slice(0, 10);

  const showDairy = businessContext === "master" || businessContext === "dairy";
  const showAgri = businessContext === "master" || businessContext === "karyana" || businessContext === "agri_inputs";
  const showCompanyWideFinancials = businessContext === "master";

  const haalat = await position(aajKaKhana());
  const ledgerNaKhula = Boolean(haalat.error);

  const totalBankBalance = haalat.naqdi;
  const bankBreakdown = haalat.naqdiRows.map((r) => ({ name: r.name, value: r.amount }));
  const totalReceivables = haalat.lena;
  const receivablesBreakdown = haalat.lenaRows.map((r) => ({ name: r.name, value: r.amount }));
  const totalPayables = haalat.dena === null ? null : Math.abs(haalat.dena);

  const parties = await partyBalances(aajKaKhana());
  const payablesBreakdown = parties.error
    ? haalat.denaRows.map((r) => ({ name: r.name, value: Math.abs(r.amount) }))
    : parties.rows
        .filter((r) => r.payable > 0.5)
        .sort((a, b) => b.payable - a.payable)
        .map((r) => ({ name: r.name ?? "—", value: r.payable }));

  const { data: batchRows } = await supabase.from("stock_batches").select("remaining_quantity, unit_cost, products(categories(name))");
  let totalInventoryValue = 0;
  const inventoryByCategory: Record<string, number> = {};
  (batchRows ?? []).forEach((r: any) => {
    const product = Array.isArray(r.products) ? r.products[0] : r.products;
    const value = Number(r.remaining_quantity ?? 0) * Number(r.unit_cost ?? 0);
    totalInventoryValue += value;
    const category = Array.isArray(product?.categories) ? product?.categories[0]?.name : product?.categories?.name;
    const catName = category ?? "Uncategorized";
    inventoryByCategory[catName] = (inventoryByCategory[catName] ?? 0) + value;
  });
  const inventoryBreakdown = Object.entries(inventoryByCategory).map(([name, value]) => ({ name, value }));

  const stockLedger = haalat.stock;
  const stockFarq = stockLedger === null ? null : Math.round((totalInventoryValue - stockLedger) * 100) / 100;

  const { data: completedOrders } = await supabase
    .from("agri_orders")
    .select("grand_total")
    .eq("status", "completed")
    .gte("created_at", monthStart)
    .lte("created_at", monthEnd + "T23:59:59");
  const agriRevenue = (completedOrders ?? []).reduce((s, o) => s + Number(o.grand_total), 0);

  const { data: monthExpenses } = await supabase
    .from("company_expense_requests")
    .select("category, amount")
    .eq("status", "approved")
    .gte("approved_at", monthStart)
    .lte("approved_at", monthEnd + "T23:59:59");
  const categoryTotals: Record<string, number> = {};
  let totalExpenses = 0;
  (monthExpenses ?? []).forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + Number(e.amount);
    totalExpenses += Number(e.amount);
  });
  const expenseBreakdown = Object.entries(categoryTotals).map(([name, value]) => ({ name, value }));

  const { data: billingSettings } = await supabase.from("company_billing_settings").select("service_rate_per_liter").limit(1).single();
  const serviceRate = Number(billingSettings?.service_rate_per_liter ?? 10);

  const { data: milkEntries } = await supabase.from("milk_entries").select("adjusted_volume, quantity_liters").gte("entry_date", monthStart).lte("entry_date", monthEnd);
  const totalAdjustedVolume = (milkEntries ?? []).reduce((s, e) => s + Number(e.adjusted_volume ?? e.quantity_liters ?? 0), 0);
  const milkGrossIncome = totalAdjustedVolume * serviceRate;

  const { data: salaryPayments } = await supabase
    .from("salary_payments")
    .select("net_salary")
    .eq("status", "paid")
    .gte("paid_date", monthStart)
    .lte("paid_date", monthEnd);
  const milkStaffSalaries = (salaryPayments ?? []).reduce((s, p) => s + Number(p.net_salary ?? 0), 0);

  const { data: fuelLogs } = await supabase.from("fuel_logs").select("fuel_cost").gte("log_date", monthStart).lte("log_date", monthEnd);
  const milkPetrolCost = (fuelLogs ?? []).reduce((s, f) => s + Number(f.fuel_cost ?? 0), 0);

  const { data: generatorLogs } = await supabase.from("generator_logs").select("diesel_cost").gte("log_date", monthStart).lte("log_date", monthEnd);
  const milkDieselCost = (generatorLogs ?? []).reduce((s, g) => s + Number(g.diesel_cost ?? 0), 0);

  const { data: maintenanceLogs } = await supabase.from("maintenance_logs").select("cost").gte("service_date", monthStart).lte("service_date", monthEnd);
  const milkMaintenanceCost = (maintenanceLogs ?? []).reduce((s, m) => s + Number(m.cost ?? 0), 0);

  const { data: routeCollections } = await supabase.from("milk_route_collections").select("shortage_liters").gte("collection_date", monthStart).lte("collection_date", monthEnd);
  const { data: rateSettings } = await supabase.from("milk_rate_settings").select("standard_rate").limit(1).single();
  const standardRate = Number(rateSettings?.standard_rate ?? 145);
  const totalShortageLiters = (routeCollections ?? []).reduce((s, r) => s + Math.max(0, Number(r.shortage_liters ?? 0)), 0);
  const milkShortageLoss = totalShortageLiters * standardRate;

  const { data: monthlyExpenses } = await supabase.from("monthly_expenses").select("category, amount").eq("expense_month", month).eq("expense_year", year);
  const milkExpenseMap = new Map((monthlyExpenses ?? []).map((e) => [e.category, Number(e.amount)]));
  const milkElectricityCost = milkExpenseMap.get("electricity") ?? 0;
  const milkChillerMaintenanceCost = milkExpenseMap.get("chiller_maintenance") ?? 0;

  const milkTotalDeductions = milkStaffSalaries + milkPetrolCost + milkDieselCost + milkElectricityCost + milkChillerMaintenanceCost + milkMaintenanceCost + milkShortageLoss;
  const milkNetProfit = milkGrossIncome - milkTotalDeductions;
  const milkBreakdown = [
    { name: "Staff Salaries", value: milkStaffSalaries },
    { name: "Petrol", value: milkPetrolCost },
    { name: "Diesel", value: milkDieselCost },
    { name: "Electricity", value: milkElectricityCost },
    { name: "Chiller Maint.", value: milkChillerMaintenanceCost },
    { name: "Vehicle Maint.", value: milkMaintenanceCost },
    { name: "Shortage Loss", value: milkShortageLoss },
  ].filter((r) => r.value > 0);

  const { data: rawCapital } = await supabase.from("capital_injections").select("*").order("injection_date", { ascending: false });
  const capitalBySource: Record<string, number> = {};
  let totalCapitalInvested = 0;
  (rawCapital ?? []).forEach((c) => {
    capitalBySource[c.source_type] = (capitalBySource[c.source_type] ?? 0) + Number(c.amount);
    totalCapitalInvested += Number(c.amount);
  });
  const SOURCE_LABELS: Record<string, string> = {
    owner_capital: "Owner's Own Capital",
    bank_loan: "Bank Loan",
    borrowed: "Borrowed / Udhaar",
    reinvested_profit: "Reinvested Profit",
  };
  const capitalBreakdown = Object.entries(capitalBySource).map(([src, value]) => ({ name: SOURCE_LABELS[src] ?? src, value }));

  const { data: shopsList } = await serviceClient.from("shops").select("id, name").order("name");

  let posQuery = serviceClient
    .from("pos_sales")
    .select("total_amount")
    .gte("created_at", monthStart)
    .lt("created_at", nextMonthStart);
  if (shopId) posQuery = posQuery.eq("shop_id", shopId);
  const { data: posSalesRows } = await posQuery;
  const posRevenue = (posSalesRows ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

  const todayKey = aajKaKhana();
  let todayQuery = serviceClient
    .from("pos_sales")
    .select("total_amount")
    .gte("created_at", `${todayKey}T00:00:00`)
    .lt("created_at", `${todayKey}T23:59:59.999`);
  if (shopId) todayQuery = todayQuery.eq("shop_id", shopId);
  const { data: todayRows } = await todayQuery;
  const todaySales = (todayRows ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

  const trendDays = 14;
  const trendStartDate = new Date(now.getTime() - (trendDays - 1) * 24 * 60 * 60 * 1000).toISOString();
  let trendAmountsQuery = serviceClient.from("pos_sales").select("created_at, total_amount").gte("created_at", trendStartDate);
  if (shopId) trendAmountsQuery = trendAmountsQuery.eq("shop_id", shopId);
  const { data: trendAmountRows } = await trendAmountsQuery;
  const dailySales = new Map<string, number>();
  (trendAmountRows ?? []).forEach((r: any) => {
    const key = new Date(r.created_at).toISOString().slice(0, 10);
    dailySales.set(key, (dailySales.get(key) ?? 0) + Number(r.total_amount ?? 0));
  });
  const salesTrend = Array.from({ length: trendDays }, (_, i) => {
    const d = new Date(now.getTime() - (trendDays - 1 - i) * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const sales = dailySales.get(key) ?? 0;
    return { label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), sales, profit: Math.max(0, sales * 0.2) };
  });

  let saleIdsQuery = serviceClient
    .from("pos_sales")
    .select("id")
    .gte("created_at", monthStart)
    .lt("created_at", nextMonthStart);
  if (shopId) saleIdsQuery = saleIdsQuery.eq("shop_id", shopId);
  const { data: saleIdRows } = await saleIdsQuery;
  const saleIds = (saleIdRows ?? []).map((r: any) => r.id);

  const sellTrendStart = new Date(now.getTime() - (SELL_WEEKS - 1) * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let trendSaleIdsQuery = serviceClient.from("pos_sales").select("id, created_at").gte("created_at", sellTrendStart);
  if (shopId) trendSaleIdsQuery = trendSaleIdsQuery.eq("shop_id", shopId);
  const { data: trendSaleRows } = await trendSaleIdsQuery;
  const trendSaleIds = (trendSaleRows ?? []).map((r: any) => r.id as string);
  const saleWeekMap = new Map<string, string>();
  (trendSaleRows ?? []).forEach((r: any) => {
    const msAgo = now.getTime() - new Date(r.created_at).getTime();
    const wkAgo = Math.floor(msAgo / (7 * 24 * 60 * 60 * 1000));
    const idx = String(Math.max(0, Math.min(SELL_WEEKS - 1, SELL_WEEKS - 1 - wkAgo)));
    saleWeekMap.set(r.id, idx);
  });

  const productTrend: Record<string, number[]> = {};
  let topSellingItems: { name: string; unit: string; qty: number; trend: number[] }[] = [];

  if (saleIds.length > 0 || trendSaleIds.length > 0) {
    const allSaleIds = Array.from(new Set([...saleIds, ...trendSaleIds]));
    const { data: itemRows } = await serviceClient
      .from("pos_sale_items")
      .select("product_id, quantity, sale_id, products(name, unit)")
      .in("sale_id", allSaleIds);
    const productMap = new Map<string, { name: string; unit: string; qty: number }>();
    for (const item of itemRows ?? []) {
      const prod: any = Array.isArray(item.products) ? (item.products as any[])[0] : item.products;
      const pid = (item as any).product_id as string;
      if (!prod || !pid) continue;
      if (saleIds.includes((item as any).sale_id)) {
        const existing = productMap.get(pid);
        if (existing) { existing.qty += Number((item as any).quantity ?? 0); }
        else { productMap.set(pid, { name: prod.name ?? "—", unit: prod.unit ?? "", qty: Number((item as any).quantity ?? 0) }); }
      }
      const wkIdx = saleWeekMap.get((item as any).sale_id);
      if (wkIdx !== undefined) {
        if (!productTrend[pid]) productTrend[pid] = Array(SELL_WEEKS).fill(0);
        productTrend[pid][Number(wkIdx)] += Number((item as any).quantity ?? 0);
      }
    }
    topSellingItems = [...productMap.entries()]
      .map(([pid, v]) => ({ ...v, trend: productTrend[pid] ?? Array(SELL_WEEKS).fill(0) }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }

  const { data: topDebtorRows } = await serviceClient
    .from("customers")
    .select("id, name, phone_number, current_balance")
    .eq("is_deleted", false)
    .gt("current_balance", 0)
    .order("current_balance", { ascending: false })
    .limit(8);

  const topDebtorIds = (topDebtorRows ?? []).map((r: any) => r.id as string);
  const trendWeeks = 6;
  const trendStart = new Date(now.getTime() - trendWeeks * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const customerTrend: Record<string, number[]> = {};
  topDebtorIds.forEach((id) => { customerTrend[id] = Array(trendWeeks).fill(0); });

  if (topDebtorIds.length > 0) {
    const { data: trendLines } = await serviceClient
      .from("journal_lines")
      .select("party_id, debit, credit, journal_entries!inner(entry_date)")
      .eq("party_type", "customer")
      .in("party_id", topDebtorIds)
      .gte("journal_entries.entry_date", trendStart);
    (trendLines ?? []).forEach((line: any) => {
      const entry = Array.isArray(line.journal_entries) ? line.journal_entries[0] : line.journal_entries;
      if (!entry?.entry_date) return;
      const msAgo = now.getTime() - new Date(entry.entry_date).getTime();
      const weeksAgo = Math.floor(msAgo / (7 * 24 * 60 * 60 * 1000));
      const idx = Math.max(0, Math.min(trendWeeks - 1, trendWeeks - 1 - weeksAgo));
      const pid = line.party_id as string;
      if (customerTrend[pid]) {
        customerTrend[pid][idx] += Number(line.debit ?? 0) - Number(line.credit ?? 0);
      }
    });
  }

  const { data: noBatchRows } = await serviceClient
    .from("inventory")
    .select("product_id, quantity_on_hand, products!inner(id, name)")
    .gt("quantity_on_hand", 0)
    .is("batch_id", null)
    .limit(5);
  const missingBatchProducts = (noBatchRows ?? []).map((r: any) => {
    const p = Array.isArray(r.products) ? r.products[0] : r.products;
    return { id: (p?.id ?? "") as string, name: (p?.name ?? "—") as string };
  }).filter((r) => r.id);

  const topDebtors = (topDebtorRows ?? []).map((r: any) => ({
    name: r.name ?? "—",
    phone: r.phone_number ?? "",
    balance: Number(r.current_balance ?? 0),
    trend: customerTrend[r.id] ?? Array(trendWeeks).fill(0),
  }));

  const intelligenceStart = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const analyticsClient = serviceClient as any;
  let categoryQuery = analyticsClient.from("v_ai_sales_category").select("category_name, sales_amount, units_sold").gte("sale_date", intelligenceStart);
  let staffQuery = analyticsClient.from("v_ai_staff_sales_daily").select("staff_id, staff_name, sales_amount, invoice_count").gte("sale_date", intelligenceStart);
  if (shopId) {
    categoryQuery = categoryQuery.eq("shop_id", shopId);
    staffQuery = staffQuery.eq("shop_id", shopId);
  }
  const [{ data: categoryRows }, { data: staffRows }] = await Promise.all([categoryQuery, staffQuery]);
  const aiCategoryTotals = new Map<string, { name: string; sales: number; units: number }>();
  for (const row of categoryRows ?? []) {
    const name = String((row as any).category_name ?? "Uncategorized");
    const current = aiCategoryTotals.get(name) ?? { name, sales: 0, units: 0 };
    current.sales += Number((row as any).sales_amount ?? 0);
    current.units += Number((row as any).units_sold ?? 0);
    aiCategoryTotals.set(name, current);
  }
  const categorySales = [...aiCategoryTotals.values()].sort((a, b) => b.sales - a.sales).slice(0, 8);
  const staffTotals = new Map<string, { name: string; sales: number; invoices: number }>();
  for (const row of staffRows ?? []) {
    const id = String((row as any).staff_id ?? "unknown");
    const current = staffTotals.get(id) ?? { name: String((row as any).staff_name ?? "Unknown staff"), sales: 0, invoices: 0 };
    current.sales += Number((row as any).sales_amount ?? 0);
    current.invoices += Number((row as any).invoice_count ?? 0);
    staffTotals.set(id, current);
  }
  const staffSales = [...staffTotals.values()].sort((a, b) => b.sales - a.sales).slice(0, 8);

  const totalRevenue = posRevenue + (showAgri ? agriRevenue : 0) + (showDairy ? milkGrossIncome : 0);
  const totalAllExpenses = (showAgri ? totalExpenses : 0) + (showDairy ? milkTotalDeductions : 0);
  const netProfit = totalRevenue - totalAllExpenses;
  const currentPosition = haalat.position;

  const noDataYetBusinesses = ["grain_procurement", "machinery_fleet", "vet"];

  return (
    <div>
      <ModernMasterDashboard
        stockDifference={stockFarq}
        inventoryValue={totalInventoryValue}
        stockLedger={stockLedger}
        totalBankBalance={totalBankBalance}
        receivables={totalReceivables}
        payables={totalPayables}
        totalRevenue={totalRevenue}
        todaySales={todaySales}
        shopId={shopId}
        shopOptions={(shopsList ?? []).map((shop: any) => ({ id: shop.id as string, name: shop.name as string }))}
        netProfit={netProfit}
        totalInventoryValue={totalInventoryValue}
        topSellingItems={topSellingItems}
        topDebtors={topDebtors}
        salesTrend={salesTrend}
        missingBatchCount={missingBatchProducts.length}
        categorySales={categorySales}
        staffSales={staffSales}
      />
    </div>
  );
}

function MiniSparkline({ data, color }: { data: number[]; color: "brand" | "red" }) {
  const W = 64, H = 22;
  const nonZero = data.some((v) => v > 0);
  if (!nonZero) {
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 opacity-40">
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
      </svg>
    );
  }
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * W : W / 2;
    const y = H - 3 - (v / max) * (H - 6);
    return { x, y, v };
  });
  const polyPts = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const lineColor = color === "red" ? "#ef4444" : "#0e6b3f";
  const fillColor = color === "red" ? "#fef2f2" : "#f0fdf4";
  const areaClose = `${pts[pts.length - 1].x},${H} 0,${H}`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
      <polygon points={`${polyPts} ${areaClose}`} fill={fillColor} opacity="0.6" />
      <polyline points={polyPts} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round" />
      {pts.map((p, i) => p.v > 0 && <circle key={i} cx={p.x} cy={p.y} r="2" fill={lineColor} />)}
    </svg>
  );
}
