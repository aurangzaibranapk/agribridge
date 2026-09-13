import { redirect } from "next/navigation";
import { ReportsClient } from "@/components/reports/reports-client";
import { ExecutiveReportsDashboard } from "@/components/reports/executive-reports-dashboard";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { conclude, deptTotals, loadDeptKpis, loadMoneyToday } from "@/lib/command-center";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

type SearchParams = { range?: string; branch?: string; shop?: string };
type SaleRow = { total_amount: number | null; total_cogs: number | null; profit: number | null; created_at: string; branch_id: string | null; shop_id: string | null };

function rangeStart(range: string) {
  const now = new Date();
  if (range === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "week") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return start;
  }
  if (range === "quarter") return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function monthKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ReportsPage({ searchParams }: { searchParams?: SearchParams }) {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: dealer } = await supabase.from("dealers").select("id, business_name").eq("user_id", user.id).maybeSingle();
  if (dealer) {
    const [{ data: summary }, { data: aging }] = await Promise.all([
      supabase.rpc("get_daily_sales_summary"),
      supabase.rpc("get_khata_aging"),
    ]);
    return <ReportsClient dealerName={dealer.business_name} summary={summary?.[0] ?? null} aging={aging ?? []} />;
  }

  const requestedRange = searchParams?.range ?? "";
  const range = ["today", "week", "month", "quarter"].includes(requestedRange) ? requestedRange : "month";
  const branch = searchParams?.branch ?? "";
  const shop = searchParams?.shop ?? "";
  const from = rangeStart(range);
  const trendFrom = new Date();
  trendFrom.setDate(1);
  trendFrom.setMonth(trendFrom.getMonth() - 5);
  trendFrom.setHours(0, 0, 0, 0);

  const service = createServiceClient();
  let salesQuery = service.from("pos_sales").select("total_amount,total_cogs,profit,created_at,branch_id,shop_id").gte("created_at", trendFrom.toISOString());
  if (branch) salesQuery = salesQuery.eq("branch_id", branch);
  if (shop) salesQuery = salesQuery.eq("shop_id", shop);

  const [
    { data: branches },
    { data: shops },
    { data: sales },
    { data: expenses },
    { data: grainSales },
    moneyToday,
    departments,
  ] = await Promise.all([
    service.from("branches").select("id,name").eq("is_active", true).order("name"),
    service.from("shops").select("id,name,branch_id").eq("is_active", true).order("name"),
    salesQuery,
    service.from("company_expense_requests").select("amount,created_at,branch_id,shop_id").eq("status", "approved").gte("created_at", trendFrom.toISOString()),
    service.from("grain_sales").select("total_amount,total_cogs,profit,sale_date").gte("sale_date", trendFrom.toISOString().slice(0, 10)),
    loadMoneyToday(),
    loadDeptKpis(lang),
  ]);

  const saleRows = (sales ?? []) as SaleRow[];
  const visibleExpenses = (expenses ?? []).filter((row) => (!branch || row.branch_id === branch) && (!shop || row.shop_id === shop));
  const labels = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(trendFrom.getFullYear(), trendFrom.getMonth() + index, 1);
    return { key: monthKey(date), label: date.toLocaleString("en", { month: "short" }), revenue: 0, expenses: 0 };
  });
  const trendMap = new Map(labels.map((row) => [row.key, row]));
  saleRows.forEach((row) => {
    const target = trendMap.get(monthKey(row.created_at));
    if (target) {
      target.revenue += Number(row.total_amount ?? 0);
      target.expenses += Number(row.total_cogs ?? 0);
    }
  });
  visibleExpenses.forEach((row) => {
    const target = trendMap.get(monthKey(row.created_at));
    if (target) target.expenses += Number(row.amount ?? 0);
  });
  if (!branch && !shop) {
    (grainSales ?? []).forEach((row) => {
      const target = trendMap.get(monthKey(row.sale_date));
      if (target) {
        target.revenue += Number(row.total_amount ?? 0);
        target.expenses += Number(row.total_cogs ?? 0);
      }
    });
  }

  const selectedSales = saleRows.filter((row) => new Date(row.created_at) >= from);
  const branchNames = new Map((branches ?? []).map((row) => [row.id, row.name]));
  const branchMap = new Map<string, { name: string; revenue: number; cost: number; profit: number }>();
  selectedSales.forEach((row) => {
    const key = row.branch_id ?? "unassigned";
    const current = branchMap.get(key) ?? { name: branchNames.get(key) ?? "Unassigned", revenue: 0, cost: 0, profit: 0 };
    current.revenue += Number(row.total_amount ?? 0);
    current.cost += Number(row.total_cogs ?? 0);
    current.profit += Number(row.profit ?? 0);
    branchMap.set(key, current);
  });

  const totals = deptTotals(departments);
  const complete = departments.filter((d) => d.state === "ok");
  const directCost = complete.reduce((sum, d) => sum + Number(d.directCost ?? 0), 0);
  const otherExpenses = complete.reduce((sum, d) => sum + Number(d.otherExpense ?? 0), 0);

  return (
    <ExecutiveReportsDashboard
      filters={{ range, branch, shop, branches: branches ?? [], shops: shops ?? [] }}
      kpis={{ revenue: totals.revenue, directCost, otherExpenses, net: totals.net, receivables: moneyToday.receivable, payables: moneyToday.payable }}
      trend={labels.map(({ label, revenue, expenses }) => ({ label, revenue, expenses }))}
      branchRows={[...branchMap.values()].sort((a, b) => b.revenue - a.revenue)}
      departments={departments.map((d) => ({ name: d.label, revenue: d.revenue, cost: d.directCost == null && d.otherExpense == null ? null : Number(d.directCost ?? 0) + Number(d.otherExpense ?? 0), profit: d.profit, margin: d.margin, state: d.state, href: d.href }))}
      insights={conclude(departments, lang)}
    />
  );
}
