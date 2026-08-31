import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import Link from "next/link";
import { TrendingUp, TrendingDown, Fuel } from "lucide-react";
import { GrainExpenseForm } from "./grain-expense-form";

export const dynamic = "force-dynamic";

const GRAIN_LABELS: Record<string, string> = { wheat: "Wheat (Gandum)", rice: "Rice (Chawal)", maize: "Maize (Makai)" };
const CATEGORY_LABELS: Record<string, string> = {
  diesel_fuel: "Diesel/Fuel",
  labor_mazdoori: "Labor/Mazdoori",
  bardana: "Bardana",
  tractor_trolley_rent: "Tractor/Trolley Rent",
  other: "Other",
};

export default async function GrainDashboardPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const [
    { data: rawEntries },
    { data: sales },
    { data: expenses },
    { data: financeAccounts },
  ] = await Promise.all([
    supabase
      .from("grain_procurement_entries")
      .select("id, entry_date, total_amount, weight_kg, grain_type, farmer_id, party_id, farmers(full_name), grain_parties(party_name)")
      .order("entry_date", { ascending: false })
      .limit(300),
    supabase.from("grain_sales").select("total_amount, total_cogs, profit, quantity_kg, grain_type, amount_received"),
    supabase.from("grain_expenses").select("*").order("expense_date", { ascending: false }).limit(200),
    supabase.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("account_type"),
  ]);

  const entries = (rawEntries ?? []).map((e: any) => {
    const farmer = Array.isArray(e.farmers) ? e.farmers[0] : e.farmers;
    const party = Array.isArray(e.grain_parties) ? e.grain_parties[0] : e.grain_parties;
    return {
      id: e.id,
      entry_date: e.entry_date,
      total_amount: Number(e.total_amount),
      weight_kg: Number(e.weight_kg),
      grain_type: e.grain_type,
      seller_name: farmer?.full_name ?? party?.party_name ?? "-",
    };
  });

  const totalProcuredKg = entries.reduce((s, e) => s + e.weight_kg, 0);
  const totalProcuredValue = entries.reduce((s, e) => s + e.total_amount, 0);

  const totalSoldKg = (sales ?? []).reduce((s, r) => s + Number(r.quantity_kg), 0);
  const totalSalesRevenue = (sales ?? []).reduce((s, r) => s + Number(r.total_amount), 0);
  const totalSalesCogs = (sales ?? []).reduce((s, r) => s + Number(r.total_cogs), 0);
  const totalSalesGrossProfit = (sales ?? []).reduce((s, r) => s + Number(r.profit), 0);

  const totalExpenses = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const expensesByCategory: Record<string, number> = {};
  (expenses ?? []).forEach((e: any) => {
    expensesByCategory[e.category] = (expensesByCategory[e.category] ?? 0) + Number(e.amount);
  });

  const netBusinessProfit = totalSalesGrossProfit - totalExpenses;
  const currentStockKg = totalProcuredKg - totalSoldKg;

  const byGrainType = ["wheat", "rice", "maize"].map((type) => {
    const procured = entries.filter((e) => e.grain_type === type).reduce((s, e) => s + e.weight_kg, 0);
    const sold = (sales ?? []).filter((s) => s.grain_type === type).reduce((s, r) => s + Number(r.quantity_kg), 0);
    return { grain_type: type, procured, sold, stock: procured - sold };
  });

  const expensesByEntry: Record<string, { total: number; byCategory: Record<string, number> }> = {};
  (expenses ?? []).forEach((e: any) => {
    if (!e.entry_id) return;
    if (!expensesByEntry[e.entry_id]) expensesByEntry[e.entry_id] = { total: 0, byCategory: {} };
    expensesByEntry[e.entry_id].total += Number(e.amount);
    expensesByEntry[e.entry_id].byCategory[e.category] = (expensesByEntry[e.entry_id].byCategory[e.category] ?? 0) + Number(e.amount);
  });

  const entryCostRows = entries
    .map((e) => {
      const linkedExpenses = expensesByEntry[e.id];
      const expenseTotal = linkedExpenses?.total ?? 0;
      return {
        ...e,
        diesel: linkedExpenses?.byCategory.diesel_fuel ?? 0,
        labor: linkedExpenses?.byCategory.labor_mazdoori ?? 0,
        bardana: linkedExpenses?.byCategory.bardana ?? 0,
        rent: linkedExpenses?.byCategory.tractor_trolley_rent ?? 0,
        other: linkedExpenses?.byCategory.other ?? 0,
        expenseTotal,
        trueCost: e.total_amount + expenseTotal,
      };
    })
    .filter((e) => e.expenseTotal > 0)
    .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());

  const generalExpenses = (expenses ?? []).filter((e: any) => !e.entry_id);

  return (
    <div>
      <PageHeader title={t("gr_dashboard_title", lang)} description={t("gr_dashboard_subtitle", lang)} />

      <div className="mb-4 flex gap-2">
        <Link href="/admin/grain-procurement" className="rounded-lg bg-surface-100 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300">{t("gd_procurement_page", lang)}</Link>
        <Link href="/admin/grain-procurement/sell" className="rounded-lg bg-surface-100 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300">{t("gd_sell_page", lang)}</Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("gd_total_bought", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">{totalProcuredKg.toLocaleString()} kg</p>
          <p className="text-xs text-surface-400">Rs {totalProcuredValue.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("gd_total_sold", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">{totalSoldKg.toLocaleString()} kg</p>
          <p className="text-xs text-surface-400">Rs {totalSalesRevenue.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("gd_in_stock_now", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">{currentStockKg.toLocaleString()} kg</p>
        </Card>
        <Card className={netBusinessProfit >= 0 ? "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/30" : "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30"}>
          <p className={`text-xs font-medium uppercase tracking-wide ${netBusinessProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{t("gd_net_business_profit", lang)}</p>
          <p className={`mt-2 font-display text-xl font-semibold ${netBusinessProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
            {netBusinessProfit >= 0 ? <TrendingUp className="mr-1 inline h-4 w-4" /> : <TrendingDown className="mr-1 inline h-4 w-4" />}
            Rs {netBusinessProfit.toLocaleString()}
          </p>
        </Card>
      </div>

      <div className="mb-6 rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">{t("gd_full_profit_calc", lang)}</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-surface-500">{t("gd_sales_revenue", lang)}</span><span className="font-medium">Rs {totalSalesRevenue.toLocaleString()}</span></div>
          <div className="flex justify-between text-red-600"><span>{t("gd_cogs_fifo", lang)}</span><span>- Rs {totalSalesCogs.toLocaleString()}</span></div>
          <div className="flex justify-between border-t border-surface-100 pt-1 font-medium dark:border-surface-800"><span>{t("gd_gross_profit_sale", lang)}</span><span>Rs {totalSalesGrossProfit.toLocaleString()}</span></div>
          <div className="flex justify-between text-red-600"><span>{t("gd_operational_expenses", lang)}</span><span>- Rs {totalExpenses.toLocaleString()}</span></div>
          <div className={`flex justify-between border-t border-surface-200 pt-1 text-base font-bold dark:border-surface-700 ${netBusinessProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
            <span>{t("gd_net_business_profit", lang)}</span><span>Rs {netBusinessProfit.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {byGrainType.map((g) => (
          <div key={g.grain_type} className="rounded-card border border-surface-200 bg-white p-3 shadow-card dark:border-surface-800 dark:bg-surface-900">
            <p className="text-xs font-medium text-surface-500">{GRAIN_LABELS[g.grain_type]}</p>
            <div className="mt-1 space-y-0.5 text-xs">
              <div className="flex justify-between"><span className="text-surface-400">{t("gd_bought", lang)}</span><span>{g.procured.toLocaleString()} kg</span></div>
              <div className="flex justify-between"><span className="text-surface-400">{t("gd_sold", lang)}</span><span>{g.sold.toLocaleString()} kg</span></div>
              <div className="flex justify-between font-semibold"><span>{t("gd_in_stock", lang)}</span><span>{g.stock.toLocaleString()} kg</span></div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">{t("gd_full_cost_each_entry", lang)}</h3>
        <div className="overflow-x-auto rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium text-surface-500">{t("c_date", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("gd_farmer_party", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("gs_grain", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gd_grain_cost", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gd_diesel", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gd_labour", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gd_sacks", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("gd_rent", lang)}</th>
                <th className="px-3 py-2 text-right font-semibold text-surface-700">{t("gd_total_true_cost", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {entryCostRows.map((e) => (
                <tr key={e.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{e.entry_date}</td>
                  <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{e.seller_name}</td>
                  <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{GRAIN_LABELS[e.grain_type]}</td>
                  <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">Rs {e.total_amount.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-surface-500">{e.diesel > 0 ? `Rs ${e.diesel.toLocaleString()}` : "-"}</td>
                  <td className="px-3 py-2 text-right text-surface-500">{e.labor > 0 ? `Rs ${e.labor.toLocaleString()}` : "-"}</td>
                  <td className="px-3 py-2 text-right text-surface-500">{e.bardana > 0 ? `Rs ${e.bardana.toLocaleString()}` : "-"}</td>
                  <td className="px-3 py-2 text-right text-surface-500">{e.rent > 0 ? `Rs ${e.rent.toLocaleString()}` : "-"}</td>
                  <td className="px-3 py-2 text-right font-bold text-surface-900 dark:text-white">Rs {e.trueCost.toLocaleString()}</td>
                </tr>
              ))}
              {entryCostRows.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-surface-400">{t("gd_no_linked_expense", lang)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <GrainExpenseForm financeAccounts={financeAccounts ?? []} entries={entries} />
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
            <Fuel className="h-4 w-4" />{t("gd_expense_breakdown", lang)}</h3>
          <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
            {Object.entries(expensesByCategory).map(([cat, amt]) => (
              <div key={cat} className="flex justify-between border-b border-surface-50 py-1.5 text-sm last:border-0 dark:border-surface-800">
                <span className="text-surface-600 dark:text-surface-400">{CATEGORY_LABELS[cat] ?? cat}</span>
                <span className="font-medium text-surface-900 dark:text-white">Rs {amt.toLocaleString()}</span>
              </div>
            ))}
            {Object.keys(expensesByCategory).length === 0 && <p className="text-center text-sm text-surface-400">{t("gd_no_expense", lang)}</p>}
            <div className="mt-2 flex justify-between border-t border-surface-200 pt-2 font-bold text-surface-900 dark:border-surface-700 dark:text-white">
              <span>{t("c_total", lang)}</span><span>Rs {totalExpenses.toLocaleString()}</span>
            </div>
          </div>

          <h3 className="mb-2 mt-4 text-sm font-semibold text-surface-900 dark:text-white">{t("gd_general_expenses", lang)}</h3>
          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">{t("c_date", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("c_category", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("c_detail", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_amount", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {generalExpenses.slice(0, 10).map((e: any) => (
                  <tr key={e.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{e.expense_date}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{CATEGORY_LABELS[e.category] ?? e.category}</td>
                    <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{e.description}</td>
                    <td className="px-3 py-2 text-right font-medium text-red-600">Rs {Number(e.amount).toLocaleString()}</td>
                  </tr>
                ))}
                {generalExpenses.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-surface-400">{t("gd_no_general_expense", lang)}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}