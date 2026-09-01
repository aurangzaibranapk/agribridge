import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { SellGrainClient } from "./sell-grain-client";

export const dynamic = "force-dynamic";

export default async function SellGrainPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const [{ data: buyers }, { data: warehouses }, { data: financeAccounts }, { data: rawSales }, { data: rawStock }] = await Promise.all([
    supabase.from("buyers").select("id, business_name, contact_person, phone_number").eq("is_active", true).order("business_name"),
    supabase.from("warehouses").select("id, name").eq("is_active", true).order("name"),
    supabase.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("account_type"),
    supabase
      .from("grain_sales")
      .select("*, buyers(business_name), warehouses(name)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("grain_type_products").select("grain_type, product_id"),
  ]);

  const productIds = (rawStock ?? []).map((r) => r.product_id);
  const { data: invRows } = productIds.length > 0
    ? await supabase.from("inventory").select("warehouse_id, product_id, quantity_on_hand").in("product_id", productIds)
    : { data: [] as any[] };

  const stockByWarehouseAndType: Record<string, Record<string, number>> = {};
  (invRows ?? []).forEach((r: any) => {
    const grainType = (rawStock ?? []).find((g) => g.product_id === r.product_id)?.grain_type;
    if (!grainType) return;
    if (!stockByWarehouseAndType[r.warehouse_id]) stockByWarehouseAndType[r.warehouse_id] = {};
    stockByWarehouseAndType[r.warehouse_id][grainType] = Number(r.quantity_on_hand);
  });

  const sales = (rawSales ?? []).map((s: any) => {
    const buyer = Array.isArray(s.buyers) ? s.buyers[0] : s.buyers;
    const warehouse = Array.isArray(s.warehouses) ? s.warehouses[0] : s.warehouses;
    return {
      id: s.id,
      sale_number: s.sale_number,
      buyer_name: buyer?.business_name ?? "-",
      warehouse_name: warehouse?.name ?? "-",
      grain_type: s.grain_type,
      quantity_kg: Number(s.quantity_kg),
      rate_per_kg: Number(s.rate_per_kg),
      total_amount: Number(s.total_amount),
      total_cogs: Number(s.total_cogs),
      profit: Number(s.profit),
      amount_received: Number(s.amount_received),
      sale_date: s.sale_date,
    };
  });

  const totalRevenue = sales.reduce((s, r) => s + r.total_amount, 0);
  const totalCogs = sales.reduce((s, r) => s + r.total_cogs, 0);
  const totalProfit = sales.reduce((s, r) => s + r.profit, 0);
  const totalReceived = sales.reduce((s, r) => s + r.amount_received, 0);
  const totalReceivable = totalRevenue - totalReceived;

  return (
    <div>
      <PageHeader title={t("gr_sell_title", lang)} description={t("gr_sell_subtitle", lang)} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("at_total_revenue", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">Rs {totalRevenue.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("at_total_cost", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">Rs {totalCogs.toLocaleString()}</p>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-green-600">{t("at_total_profit", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-green-700">Rs {totalProfit.toLocaleString()}</p>
        </Card>
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-600">{t("at_receivable", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-amber-700">Rs {totalReceivable.toLocaleString()}</p>
        </Card>
      </div>

      <SellGrainClient
        buyers={buyers ?? []}
        warehouses={warehouses ?? []}
        financeAccounts={financeAccounts ?? []}
        sales={sales}
        stockByWarehouseAndType={stockByWarehouseAndType}
      />
    </div>
  );
}