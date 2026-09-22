import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { BillingClient } from "./billing-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function CompanyBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; branch_id?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;
  const year = params.year ? Number(params.year) : now.getFullYear();
  const branchFilter = params.branch_id ?? "";
  const lang = getLanguageFromCookies("rm");

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDateObj = new Date(year, month, 0);
  const endDate = endDateObj.toISOString().slice(0, 10);

  const supabase = createClient();

  const { data: branches } = await supabase.from("branches").select("id, name").order("is_main_branch", { ascending: false }).order("name");

  const { data: billingSettings } = await supabase.from("company_billing_settings").select("company_name, service_rate_per_liter").limit(1).single();
  const companyName = billingSettings?.company_name ?? "Wasela Pakistan";
  const serviceRate = Number(billingSettings?.service_rate_per_liter ?? 10);

  let milkQuery = supabase.from("milk_entries").select("adjusted_volume, quantity_liters").gte("entry_date", startDate).lte("entry_date", endDate);
  if (branchFilter) milkQuery = milkQuery.eq("branch_id", branchFilter);
  const { data: milkEntries } = await milkQuery;
  const totalAdjustedVolume = (milkEntries ?? []).reduce((sum, e) => sum + Number(e.adjusted_volume ?? e.quantity_liters ?? 0), 0);
  const grossIncome = totalAdjustedVolume * serviceRate;

  // Staff salaries aren't branch-scoped in salary_payments today, so
  // when a specific chiller is selected we skip this line (shown only
  // in the "All Chillers" combined view) rather than double-count it.
  let staffSalaries = 0;
  if (!branchFilter) {
    const { data: salaries } = await supabase.from("salary_payments").select("net_salary").eq("pay_month", month).eq("pay_year", year);
    staffSalaries = (salaries ?? []).reduce((sum, s) => sum + Number(s.net_salary ?? 0), 0);
  }

  let fuelQuery = supabase.from("fuel_logs").select("fuel_cost, vehicles(branch_id)").gte("log_date", startDate).lte("log_date", endDate);
  const { data: rawFuelLogs } = await fuelQuery;
  const fuelLogs = branchFilter
    ? (rawFuelLogs ?? []).filter((f: any) => (Array.isArray(f.vehicles) ? f.vehicles[0]?.branch_id : f.vehicles?.branch_id) === branchFilter)
    : rawFuelLogs ?? [];
  const petrolCost = fuelLogs.reduce((sum, f: any) => sum + Number(f.fuel_cost ?? 0), 0);

  let generatorQuery = supabase.from("generator_logs").select("diesel_cost").gte("log_date", startDate).lte("log_date", endDate);
  if (branchFilter) generatorQuery = generatorQuery.eq("branch_id", branchFilter);
  const { data: generatorLogs } = await generatorQuery;
  const dieselCost = (generatorLogs ?? []).reduce((sum, g) => sum + Number(g.diesel_cost ?? 0), 0);

  let maintenanceQuery = supabase.from("maintenance_logs").select("cost").gte("service_date", startDate).lte("service_date", endDate);
  if (branchFilter) maintenanceQuery = maintenanceQuery.eq("branch_id", branchFilter);
  const { data: maintenanceLogs } = await maintenanceQuery;
  const maintenanceCost = (maintenanceLogs ?? []).reduce((sum, m) => sum + Number(m.cost ?? 0), 0);

  let routeQuery = supabase.from("milk_route_collections").select("shortage_liters").gte("collection_date", startDate).lte("collection_date", endDate);
  if (branchFilter) routeQuery = routeQuery.eq("branch_id", branchFilter);
  const { data: routeCollections } = await routeQuery;
  const { data: rateSettings } = await supabase.from("milk_rate_settings").select("standard_rate").limit(1).single();
  const standardRate = Number(rateSettings?.standard_rate ?? 145);
  const totalShortageLiters = (routeCollections ?? []).reduce((sum, r) => sum + Math.max(0, Number(r.shortage_liters ?? 0)), 0);
  const shortageLoss = totalShortageLiters * standardRate;

  let expenseQuery = supabase.from("monthly_expenses").select("category, amount").eq("expense_month", month).eq("expense_year", year);
  if (branchFilter) expenseQuery = expenseQuery.eq("branch_id", branchFilter);
  const { data: monthlyExpenses } = await expenseQuery;
  const expenseMap = new Map((monthlyExpenses ?? []).map((e) => [e.category, Number(e.amount)]));
  const electricityCost = expenseMap.get("electricity") ?? 0;
  const chillerMaintenanceCost = expenseMap.get("chiller_maintenance") ?? 0;

  const totalDeductions = staffSalaries + petrolCost + dieselCost + electricityCost + chillerMaintenanceCost + maintenanceCost + shortageLoss;
  const netProfit = grossIncome - totalDeductions;

  const selectedBranchName = branchFilter ? (branches ?? []).find((b) => b.id === branchFilter)?.name ?? "" : "Sab Chillers (Combined)";

  return (
    <div>
      <PageHeader title={t("mc_billing_title", lang)} description="Auto-generated monthly invoice and live profit/loss breakdown" />
      <BillingClient
        month={month}
        year={year}
        months={MONTHS}
        branches={branches ?? []}
        branchFilter={branchFilter}
        selectedBranchName={selectedBranchName}
        companyName={companyName}
        serviceRate={serviceRate}
        totalAdjustedVolume={totalAdjustedVolume}
        grossIncome={grossIncome}
        deductions={{
          staffSalaries,
          petrolCost,
          dieselCost,
          electricityCost,
          chillerMaintenanceCost,
          maintenanceCost,
          shortageLoss,
        }}
        totalDeductions={totalDeductions}
        netProfit={netProfit}
      />
    </div>
  );
}