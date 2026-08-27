import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { Card } from "@/components/ui/layout-primitives";
import { TrendingUp, ShoppingCart, Wallet, CreditCard, Droplet, Boxes, DollarSign } from "lucide-react";
import { SalesTrendChart } from "@/app/admin/business-dashboard/business-charts";
import { BranchFilter } from "@/components/dashboard/branch-filter";
import { StatCard } from "@/components/dashboard/stat-card";

export const dynamic = "force-dynamic";

export default async function BusinessDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const params = await searchParams;
  const branchId = params.branch || "";
  const supabase = createClient();

  const now = new Date();
  const monthStartIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthStartDate = monthStartIso.slice(0, 10);
  const sevenDaysAgoIso = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  let salesQuery = supabase
    .from("pos_sales")
    .select("total_amount, cash_paid, khata_amount, created_at, branch_id")
    .not("branch_id", "is", null)
    .gte("created_at", monthStartIso);
  if (branchId) salesQuery = salesQuery.eq("branch_id", branchId);

  let trendQuery = supabase
    .from("pos_sales")
    .select("total_amount, created_at, branch_id")
    .not("branch_id", "is", null)
    .gte("created_at", sevenDaysAgoIso);
  if (branchId) trendQuery = trendQuery.eq("branch_id", branchId);

  let khataQuery = supabase
    .from("khata_accounts")
    .select("current_balance, branch_id")
    .not("branch_id", "is", null);
  if (branchId) khataQuery = khataQuery.eq("branch_id", branchId);

  let profitQuery = supabase
    .from("pos_sales")
    .select("branch_id, created_at, pos_sale_items(quantity, unit_price, products(purchase_price))")
    .not("branch_id", "is", null)
    .gte("created_at", monthStartIso);
  if (branchId) profitQuery = profitQuery.eq("branch_id", branchId);

  let purchasesQuery = supabase.from("purchases").select("total_amount, purchase_date").gte("purchase_date", monthStartDate);
  if (branchId) purchasesQuery = purchasesQuery.eq("branch_id", branchId);

  const [
    { data: salesThisMonth },
    { data: recentSales },
    { data: khataRows },
    { data: profitRows },
    { data: purchasesThisMonth },
    { data: milkBalances },
    { data: milkThisMonth },
    { data: rawInventory },
  ] = await Promise.all([
    salesQuery,
    trendQuery,
    khataQuery,
    profitQuery,
    purchasesQuery,
    supabase.from("milk_farmer_balances").select("balance_due"),
    supabase.from("milk_entries").select("quantity_liters, total_amount, entry_date").gte("entry_date", monthStartDate),
    supabase.from("inventory").select("quantity_on_hand, products(purchase_price)"),
  ]);

  const totalSales = (salesThisMonth ?? []).reduce((sum, s) => sum + Number(s.total_amount ?? 0), 0);
  const totalCashReceived = (salesThisMonth ?? []).reduce((sum, s) => sum + Number(s.cash_paid ?? 0), 0);
  const totalKhataOutstanding = (khataRows ?? []).reduce((sum, k) => sum + Number(k.current_balance ?? 0), 0);

  let totalProfit = 0;
  (profitRows ?? []).forEach((sale: any) => {
    (sale.pos_sale_items ?? []).forEach((item: any) => {
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      const purchasePrice = Number(product?.purchase_price ?? 0);
      totalProfit += (Number(item.unit_price ?? 0) - purchasePrice) * Number(item.quantity ?? 0);
    });
  });

  const totalPurchases = (purchasesThisMonth ?? []).reduce((sum, p) => sum + Number(p.total_amount), 0);
  const totalMilkOwed = (milkBalances ?? []).reduce((sum, m) => sum + Number(m.balance_due), 0);
  const milkLitersThisMonth = (milkThisMonth ?? []).reduce((sum, m) => sum + Number(m.quantity_liters), 0);
  const milkAmountThisMonth = (milkThisMonth ?? []).reduce((sum, m) => sum + Number(m.total_amount), 0);

  const stockValue = (rawInventory ?? []).reduce((sum: number, row: any) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    return sum + Number(row.quantity_on_hand) * Number(product?.purchase_price ?? 0);
  }, 0);

  const dayLabels: string[] = [];
  const trendMap: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { weekday: "short" });
    dayLabels.push(label);
    trendMap[key] = 0;
  }
  (recentSales ?? []).forEach((s: any) => {
    const key = String(s.created_at).slice(0, 10);
    if (trendMap[key] !== undefined) {
      trendMap[key] += Number(s.total_amount ?? 0);
    }
  });
  const trendData = Object.keys(trendMap).map((key, idx) => ({
    day: dayLabels[idx],
    sales: trendMap[key],
  }));

  return (
    <div>
      <PageHeader
        title="Business Dashboard"
        description="Overall business snapshot - Sales, Purchases, Cash, Khata, Milk, Stock, and Profit"
      />

      <div className="mt-4">
        <BranchFilter branches={branches ?? []} current={branchId} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Sales (This Month)" value={`Rs ${totalSales.toLocaleString()}`} tone="brand" />
        <StatCard icon={ShoppingCart} label="Purchases (This Month)" value={`Rs ${totalPurchases.toLocaleString()}`} tone="orange" />
        <StatCard icon={Wallet} label="Cash Received (This Month)" value={`Rs ${totalCashReceived.toLocaleString()}`} tone="green" />
        <StatCard icon={CreditCard} label="Khata Outstanding" value={`Rs ${totalKhataOutstanding.toLocaleString()}`} tone="red" />
        <StatCard
          icon={Droplet}
          label="Milk Collection (This Month)"
          value={`${milkLitersThisMonth.toFixed(0)} L / Rs ${milkAmountThisMonth.toLocaleString()}`}
          tone="blue"
        />
        <StatCard icon={Wallet} label="Owed to Milk Farmers" value={`Rs ${totalMilkOwed.toLocaleString()}`} tone="red" />
        <StatCard icon={Boxes} label="Total Stock Value" value={`Rs ${stockValue.toLocaleString()}`} tone="purple" />
        <StatCard
          icon={DollarSign}
          label="Profit (This Month, Est.)"
          value={`Rs ${totalProfit.toLocaleString()}`}
          tone={totalProfit >= 0 ? "green" : "red"}
        />
      </div>

      <div className="mt-6">
        <Card>
          <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            Sales Trend (Last 7 Days)
          </h2>
          <SalesTrendChart data={trendData} />
        </Card>
      </div>
    </div>
  );
}