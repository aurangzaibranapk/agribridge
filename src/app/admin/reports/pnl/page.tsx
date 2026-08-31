import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { ArrowLeft, TrendingUp, TrendingDown, Store, Package } from "lucide-react";
import { PnlCharts } from "./pnl-charts";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  karyana: "Karyana",
  agri_inputs: "Agri Inputs",
  grain_procurement: "Grain",
  dairy: "Dairy",
  machinery_fleet: "Machinery",
};

const CATEGORY_LABELS: Record<string, string> = {
  inventory_purchase: "Inventory Purchase",
  rent: "Rent",
  salary: "Salary",
  utility_bill: "Utility Bill",
  supplier_payment: "Supplier Payment",
  maintenance: "Maintenance",
  other: "Other",
};

interface ExpenseTotals {
  rent: number;
  salary: number;
  utility_bill: number;
  maintenance: number;
  supplier_payment: number;
  inventory_purchase: number;
  other: number;
  total: number;
}

function emptyExpenseTotals(): ExpenseTotals {
  return { rent: 0, salary: 0, utility_bill: 0, maintenance: 0, supplier_payment: 0, inventory_purchase: 0, other: 0, total: 0 };
}

async function getExpenseTotals(supabase: ReturnType<typeof createClient>, filter: { branch_id: string; shop_id?: string }, from: string, to: string): Promise<ExpenseTotals> {
  let query = supabase
    .from("company_expense_requests")
    .select("category, amount")
    .eq("branch_id", filter.branch_id)
    .eq("status", "approved")
    .gte("approved_at", from)
    .lte("approved_at", to + "T23:59:59");
  query = filter.shop_id ? query.eq("shop_id", filter.shop_id) : query.is("shop_id", null);
  const { data } = await query;
  const totals = emptyExpenseTotals();
  (data ?? []).forEach((e: any) => {
    const cat = e.category as keyof ExpenseTotals;
    if (cat in totals) totals[cat] += Number(e.amount);
    totals.total += Number(e.amount);
  });
  return totals;
}

export default async function PnlPage({
  searchParams,
}: {
  searchParams: Promise<{ branch_id?: string; shop_id?: string; from?: string; to?: string }>;
}) {
  const lang = getLanguageFromCookies("rm");
  const params = await searchParams;
  const supabase = createClient();

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = now.toISOString().slice(0, 10);
  const from = params.from ?? defaultFrom;
  const to = params.to ?? defaultTo;

  if (params.shop_id) {
    const { data: shop } = await supabase.from("shops").select("id, name, business_type, branch_id, branches(name)").eq("id", params.shop_id).maybeSingle();
    const branchName = shop ? (Array.isArray((shop as any).branches) ? (shop as any).branches[0]?.name : (shop as any).branches?.name) : null;

    const { data: saleRows } = await supabase
      .from("pos_sales")
      .select("id, pos_sale_items(product_id, quantity, subtotal, line_cogs, products(name))")
      .eq("shop_id", params.shop_id)
      .gte("created_at", from)
      .lte("created_at", to + "T23:59:59");

    const productMap: Record<string, { name: string; qty: number; revenue: number; cogs: number }> = {};
    (saleRows ?? []).forEach((s: any) => {
      (s.pos_sale_items ?? []).forEach((item: any) => {
        const product = Array.isArray(item.products) ? item.products[0] : item.products;
        const name = product?.name ?? "Unknown";
        if (!productMap[item.product_id]) productMap[item.product_id] = { name, qty: 0, revenue: 0, cogs: 0 };
        productMap[item.product_id].qty += Number(item.quantity);
        productMap[item.product_id].revenue += Number(item.subtotal);
        productMap[item.product_id].cogs += Number(item.line_cogs ?? 0);
      });
    });
    const products = Object.values(productMap)
      .map((p) => ({ ...p, profit: p.revenue - p.cogs }))
      .sort((a, b) => b.profit - a.profit);

    return (
      <div>
        <Link href={`/admin/reports/pnl?branch_id=${shop?.branch_id ?? ""}&from=${from}&to=${to}`} className="mb-3 flex items-center gap-1 text-sm text-surface-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> {branchName ?? "Branch"} ki Shops par wapas
        </Link>
        <PageHeader
          title={`${shop?.name ?? "Shop"} - Product Profitability`}
          description={`${BUSINESS_TYPE_LABELS[shop?.business_type ?? ""] ?? shop?.business_type} - ${from} se ${to} tak`}
        />
        <DateRangeForm branchId={shop?.branch_id} shopId={params.shop_id} from={from} to={to} />
        <div className="mt-4 overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_product", lang)}</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">{t("rp_qty_sold", lang)}</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">{t("rp_revenue", lang)}</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">{t("rp_cogs", lang)}</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">{t("c_profit", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.name} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-4 py-2.5 font-medium text-surface-800 dark:text-surface-200">{p.name}</td>
                  <td className="px-4 py-2.5 text-right text-surface-600 dark:text-surface-400">{p.qty}</td>
                  <td className="px-4 py-2.5 text-right text-surface-600 dark:text-surface-400">Rs {p.revenue.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-surface-600 dark:text-surface-400">Rs {p.cogs.toLocaleString()}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${p.profit >= 0 ? "text-green-600" : "text-red-600"}`}>Rs {p.profit.toLocaleString()}</td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-surface-400">{t("rp_no_sale_range", lang)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (params.branch_id) {
    const { data: branch } = await supabase.from("branches").select("id, name").eq("id", params.branch_id).maybeSingle();
    const { data: shops } = await supabase.from("shops").select("id, name, business_type").eq("branch_id", params.branch_id).eq("is_active", true);

    const shopRows = await Promise.all(
      (shops ?? []).map(async (shop) => {
        const { data: sales } = await supabase
          .from("pos_sales")
          .select("total_amount, total_cogs, profit")
          .eq("shop_id", shop.id)
          .gte("created_at", from)
          .lte("created_at", to + "T23:59:59");
        const revenue = (sales ?? []).reduce((s, r) => s + Number(r.total_amount), 0);
        const cogs = (sales ?? []).reduce((s, r) => s + Number(r.total_cogs ?? 0), 0);
        const grossProfit = (sales ?? []).reduce((s, r) => s + Number(r.profit ?? 0), 0);

        const { data: warehouse } = await supabase.from("warehouses").select("id").eq("shop_id", shop.id).maybeSingle();
        let stockValue = 0;
        let stockUnits = 0;
        let stockInValue = 0;
        if (warehouse) {
          const { data: invRows } = await supabase
            .from("inventory")
            .select("quantity_on_hand, products(purchase_price)")
            .eq("warehouse_id", warehouse.id);
          (invRows ?? []).forEach((r: any) => {
            const product = Array.isArray(r.products) ? r.products[0] : r.products;
            const price = Number(product?.purchase_price ?? 0);
            stockValue += Number(r.quantity_on_hand) * price;
            stockUnits += Number(r.quantity_on_hand);
          });

          const { data: invIds } = await supabase.from("inventory").select("id").eq("warehouse_id", warehouse.id);
          const inventoryIds = (invIds ?? []).map((r) => r.id);
          if (inventoryIds.length > 0) {
            const { data: movementRows } = await supabase
              .from("stock_movements")
              .select("quantity, inventory_id")
              .in("inventory_id", inventoryIds)
              .in("movement_type", ["purchase_in", "transfer_in"])
              .gte("created_at", from)
              .lte("created_at", to + "T23:59:59");
            const { data: invWithPrice } = await supabase.from("inventory").select("id, product_id, products(purchase_price)").eq("warehouse_id", warehouse.id);
            const priceByInvId: Record<string, number> = {};
            (invWithPrice ?? []).forEach((r: any) => {
              const product = Array.isArray(r.products) ? r.products[0] : r.products;
              priceByInvId[r.id] = Number(product?.purchase_price ?? 0);
            });
            (movementRows ?? []).forEach((m: any) => {
              stockInValue += Number(m.quantity) * (priceByInvId[m.inventory_id] ?? 0);
            });
          }
        }

        const expenses = await getExpenseTotals(supabase, { branch_id: params.branch_id!, shop_id: shop.id }, from, to);
        const netProfit = grossProfit - expenses.total;

        return {
          id: shop.id,
          name: shop.name,
          business_type: shop.business_type,
          revenue,
          cogs,
          grossProfit,
          saleCount: (sales ?? []).length,
          stockValue,
          stockUnits,
          stockInValue,
          expenses,
          netProfit,
        };
      })
    );

    const branchWideExpenses = await getExpenseTotals(supabase, { branch_id: params.branch_id }, from, to);

    const totalGrossProfit = shopRows.reduce((s, r) => s + r.grossProfit, 0);
    const totalStockValue = shopRows.reduce((s, r) => s + r.stockValue, 0);
    const totalShopExpenses = shopRows.reduce((s, r) => s + r.expenses.total, 0);
    const totalExpenses = totalShopExpenses + branchWideExpenses.total;
    const netProfit = totalGrossProfit - totalExpenses;

    return (
      <div>
        <Link href="/admin/reports/pnl" className="mb-3 flex items-center gap-1 text-sm text-surface-500 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Sab Branches par wapas
        </Link>
        <PageHeader title={`${branch?.name ?? "Branch"} - Har Shop Ka Poora Hisaab`} description={`${from} se ${to} tak`} />
        <DateRangeForm branchId={params.branch_id} shopId={params.shop_id} from={from} to={to} shopOptions={(shops ?? []).map((s) => ({ id: s.id, name: s.name }))} />

        <PnlCharts
          shops={shopRows.map((s) => ({ name: s.name, revenue: s.revenue, cogs: s.cogs, expenses: s.expenses.total, netProfit: s.netProfit }))}
          expenseBreakdown={[
            { name: "Salary", value: shopRows.reduce((s, r) => s + r.expenses.salary, 0) + branchWideExpenses.salary },
            { name: "Rent", value: shopRows.reduce((s, r) => s + r.expenses.rent, 0) + branchWideExpenses.rent },
            { name: "Utility Bill", value: shopRows.reduce((s, r) => s + r.expenses.utility_bill, 0) + branchWideExpenses.utility_bill },
            { name: "Maintenance", value: shopRows.reduce((s, r) => s + r.expenses.maintenance, 0) + branchWideExpenses.maintenance },
            { name: "Supplier Payment", value: shopRows.reduce((s, r) => s + r.expenses.supplier_payment, 0) + branchWideExpenses.supplier_payment },
            { name: "Inventory Purchase", value: shopRows.reduce((s, r) => s + r.expenses.inventory_purchase, 0) + branchWideExpenses.inventory_purchase },
            { name: "Other", value: shopRows.reduce((s, r) => s + r.expenses.other, 0) + branchWideExpenses.other },
          ].filter((c) => c.value > 0)}
        />

        <h3 className="mb-2 mt-6 text-sm font-semibold text-surface-900 dark:text-white">{t("rp_each_shop", lang)}</h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {shopRows.map((s) => (
            <div key={s.id} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Store className="h-4 w-4 text-brand-600" />
                  <span className="font-medium text-surface-900 dark:text-white">{s.name}</span>
                </div>
                <Link href={`/admin/reports/pnl?branch_id=${params.branch_id}&shop_id=${s.id}&from=${from}&to=${to}`} className="text-xs font-medium text-brand-600 hover:underline">
                  Products Dekhein →
                </Link>
              </div>
              <p className="mb-2 text-xs text-surface-400">{BUSINESS_TYPE_LABELS[s.business_type] ?? s.business_type} - {s.saleCount} sales</p>

              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-surface-500"><Package className="h-3.5 w-3.5" />{t("c_stock", lang)}</div>
                <div className="flex justify-between pl-5 text-xs"><span className="text-surface-400">{t("rp_stock_in_period", lang)}</span><span>Rs {s.stockInValue.toLocaleString()}</span></div>
                <div className="flex justify-between pl-5 text-xs"><span className="text-surface-400">{t("rp_stock_now", lang)}</span><span>{s.stockUnits} units - Rs {s.stockValue.toLocaleString()}</span></div>

                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-surface-500">{t("rp_sales", lang)}</div>
                <div className="flex justify-between pl-5 text-xs"><span className="text-surface-400">{t("rp_sales_revenue", lang)}</span><span>Rs {s.revenue.toLocaleString()}</span></div>
                <div className="flex justify-between pl-5 text-xs"><span className="text-surface-400">{t("rp_cogs_full", lang)}</span><span>Rs {s.cogs.toLocaleString()}</span></div>
                <div className="flex justify-between pl-5 text-xs font-semibold"><span>{t("rp_gross_profit", lang)}</span><span className={s.grossProfit >= 0 ? "text-green-600" : "text-red-600"}>Rs {s.grossProfit.toLocaleString()}</span></div>

                <div className="mt-2 text-xs font-semibold text-surface-500">{t("rp_expenses", lang)}</div>
                {(Object.keys(CATEGORY_LABELS) as (keyof ExpenseTotals)[]).filter((k) => k !== "total").map((cat) =>
                  s.expenses[cat] > 0 ? (
                    <div key={cat} className="flex justify-between pl-5 text-xs text-red-600">
                      <span>{CATEGORY_LABELS[cat]}</span><span>- Rs {s.expenses[cat].toLocaleString()}</span>
                    </div>
                  ) : null
                )}
                {s.expenses.total === 0 && <p className="pl-5 text-xs text-surface-400">{t("rp_no_expense", lang)}</p>}

                <div className="mt-2 flex justify-between border-t border-surface-100 pt-1 font-bold dark:border-surface-800">
                  <span>{t("rp_net_profit", lang)}</span>
                  <span className={s.netProfit >= 0 ? "text-green-700" : "text-red-700"}>Rs {s.netProfit.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
          {shopRows.length === 0 && <p className="col-span-full py-6 text-center text-sm text-surface-400">{t("rp_no_active_shop", lang)}</p>}
        </div>

        <div className="mt-6 rounded-card border-2 border-brand-200 bg-brand-50 p-4 shadow-card dark:border-brand-900/40 dark:bg-brand-950/20">
          <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">{t("rp_branch_combined", lang)}</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-surface-500">{t("rp_total_gross_shops", lang)}</span><span className="font-medium">Rs {totalGrossProfit.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-surface-500">{t("rp_total_stock_shops", lang)}</span><span className="font-medium">Rs {totalStockValue.toLocaleString()}</span></div>
            <div className="flex justify-between text-red-600"><span>{t("rp_shop_expenses", lang)}</span><span>- Rs {totalShopExpenses.toLocaleString()}</span></div>
            {branchWideExpenses.total > 0 && (
              <div className="flex justify-between text-red-600"><span>{t("rp_branchwide_expenses", lang)}</span><span>- Rs {branchWideExpenses.total.toLocaleString()}</span></div>
            )}
            <div className={`flex justify-between border-t border-brand-200 pt-1 text-base font-bold dark:border-brand-800 ${netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
              <span>{t("rp_net_branch", lang)}</span><span>Rs {netProfit.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { data: branches } = await supabase.from("branches").select("id, name").eq("is_active", true).eq("is_distribution_center", false).order("name");

  const branchRows = await Promise.all(
    (branches ?? []).map(async (branch) => {
      const { data: shops } = await supabase.from("shops").select("id").eq("branch_id", branch.id).eq("is_active", true);
      const shopIds = (shops ?? []).map((s) => s.id);
      let grossProfit = 0;
      if (shopIds.length > 0) {
        const { data: sales } = await supabase
          .from("pos_sales")
          .select("profit")
          .in("shop_id", shopIds)
          .gte("created_at", from)
          .lte("created_at", to + "T23:59:59");
        grossProfit = (sales ?? []).reduce((s, r) => s + Number(r.profit ?? 0), 0);
      }
      const { data: expenseRows } = await supabase
        .from("company_expense_requests")
        .select("amount")
        .eq("branch_id", branch.id)
        .eq("status", "approved")
        .gte("approved_at", from)
        .lte("approved_at", to + "T23:59:59");
      const totalExpenses = (expenseRows ?? []).reduce((s, e) => s + Number(e.amount), 0);
      return { id: branch.id, name: branch.name, shopCount: shopIds.length, grossProfit, totalExpenses, netProfit: grossProfit - totalExpenses };
    })
  );

  const masterTotalGrossProfit = branchRows.reduce((s, b) => s + b.grossProfit, 0);
  const masterTotalExpenses = branchRows.reduce((s, b) => s + b.totalExpenses, 0);
  const masterNetProfit = masterTotalGrossProfit - masterTotalExpenses;

  return (
    <div>
      <PageHeader title={t("rp_title", lang)} description={t("rp_subtitle", lang)} />
      <DateRangeForm from={from} to={to} branchOptions={(branches ?? []).map((b) => ({ id: b.id, name: b.name }))} />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <p className="text-xs text-surface-400">{t("rp_total_gross_branches", lang)}</p>
          <p className="mt-1 font-display text-xl font-bold text-green-600">Rs {masterTotalGrossProfit.toLocaleString()}</p>
        </div>
        <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <p className="text-xs text-surface-400">{t("rp_total_expenses_branches", lang)}</p>
          <p className="mt-1 font-display text-xl font-bold text-red-600">Rs {masterTotalExpenses.toLocaleString()}</p>
        </div>
        <div className={`rounded-card border-2 p-4 shadow-card ${masterNetProfit >= 0 ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
          <p className="text-xs text-surface-500">{t("rp_net_business", lang)}</p>
          <p className={`mt-1 font-display text-xl font-bold ${masterNetProfit >= 0 ? "text-green-700" : "text-red-700"}`}>Rs {masterNetProfit.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-4 py-3 font-medium text-surface-500">{t("c_branch", lang)}</th>
              <th className="px-4 py-3 text-center font-medium text-surface-500">{t("c_shops", lang)}</th>
              <th className="px-4 py-3 text-right font-medium text-surface-500">{t("rp_gross_profit", lang)}</th>
              <th className="px-4 py-3 text-right font-medium text-surface-500">{t("rp_expenses", lang)}</th>
              <th className="px-4 py-3 text-right font-medium text-surface-500">{t("rp_net_profit", lang)}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {branchRows.map((b) => (
              <tr key={b.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-4 py-3 font-medium text-surface-800 dark:text-surface-200">{b.name}</td>
                <td className="px-4 py-3 text-center text-surface-500">{b.shopCount}</td>
                <td className="px-4 py-3 text-right text-surface-600 dark:text-surface-400">Rs {b.grossProfit.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-red-600">Rs {b.totalExpenses.toLocaleString()}</td>
                <td className={`px-4 py-3 text-right font-semibold ${b.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {b.netProfit >= 0 ? <TrendingUp className="mr-1 inline h-3.5 w-3.5" /> : <TrendingDown className="mr-1 inline h-3.5 w-3.5" />}
                  Rs {b.netProfit.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/reports/pnl?branch_id=${b.id}&from=${from}&to=${to}`} className="text-xs font-medium text-brand-600 hover:underline">
                    Poora Hisaab Dekhein →
                  </Link>
                </td>
              </tr>
            ))}
            {branchRows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-surface-400">{t("rp_no_branch", lang)}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-surface-400">
        Note: Sirf POS Sales (Karyana/Agri Inputs shops) Gross Profit mein shamil hain. Milk/Dairy ki P&L alag se Master Dashboard par dekhein.
      </p>
    </div>
  );
}

function DateRangeForm({
  branchId,
  shopId,
  from,
  to,
  branchOptions,
  shopOptions,
}: {
  branchId?: string;
  shopId?: string;
  from: string;
  to: string;
  branchOptions?: { id: string; name: string }[];
  shopOptions?: { id: string; name: string }[];
}) {
  const lang = getLanguageFromCookies("rm");
  return (
    <form className="flex flex-wrap items-end gap-2 rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
      {branchOptions && (
        <div>
          <label className="text-xs text-surface-500">{t("c_branch", lang)}</label>
          <select name="branch_id" defaultValue={branchId ?? ""} className="mt-1 block rounded-lg border border-surface-200 p-1.5 text-sm">
            <option value="">{t("rp_all_branches", lang)}</option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}
      {shopOptions && (
        <>
          <input type="hidden" name="branch_id" value={branchId} />
          <div>
            <label className="text-xs text-surface-500">{t("c_shop", lang)}</label>
            <select name="shop_id" defaultValue={shopId ?? ""} className="mt-1 block rounded-lg border border-surface-200 p-1.5 text-sm">
              <option value="">{t("rp_whole_branch", lang)}</option>
              {shopOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </>
      )}
      {!branchOptions && !shopOptions && branchId && <input type="hidden" name="branch_id" value={branchId} />}
      {!shopOptions && shopId && <input type="hidden" name="shop_id" value={shopId} />}
      <div>
        <label className="text-xs text-surface-500">{t("rp_from", lang)}</label>
        <input type="date" name="from" defaultValue={from} className="mt-1 block rounded-lg border border-surface-200 p-1.5 text-sm" />
      </div>
      <div>
        <label className="text-xs text-surface-500">{t("rp_to", lang)}</label>
        <input type="date" name="to" defaultValue={to} className="mt-1 block rounded-lg border border-surface-200 p-1.5 text-sm" />
      </div>
      <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">{t("c_filter", lang)}</button>
    </form>
  );
}