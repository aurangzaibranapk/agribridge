import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/ui/layout-primitives";
import { BillingClient } from "./billing-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { karachiParts, rpcError } from "@/lib/dairy/rules";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function CompanyBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; branch_id?: string }>;
}) {
  const params = await searchParams;
  const today = karachiParts();
  const month = params.month ? Number(params.month) : Number(today.month);
  const year = params.year ? Number(params.year) : today.year;
  const branchFilter = params.branch_id ?? "";
  const lang = getLanguageFromCookies("rm");

  const supabase = createClient();
  const service = createServiceClient();

  const { data: branches } = await supabase.from("branches").select("id, name").order("is_main_branch", { ascending: false }).order("name");

  // Kamai company ke mane hue litre par hai (dispatch raseed), SQL mein
  // jama — rejected/pending aur 1000 qataron ki hadd dono bahar.
  const pnl = await (service as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: Record<string, number | string> | null; error: { message: string } | null }>;
  }).rpc("fn_dairy_month_pnl", {
    p_year: year,
    p_month: month,
    p_branch: branchFilter || null,
  });
  if (pnl.error || !pnl.data) {
    return (
      <div>
        <PageHeader title={t("mc_billing_title", lang)} description="Auto-generated monthly invoice and live profit/loss breakdown" />
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{pnl.error ? rpcError(pnl.error.message) : "Bill nahi bana."}</p>
      </div>
    );
  }
  const row = pnl.data;
  const companyName = String(row.company_name ?? "");
  const serviceRate = Number(row.service_rate);
  const totalAdjustedVolume = Number(row.accepted_liters);
  const grossIncome = Number(row.gross_income);
  const staffSalaries = Number(row.staff_salaries);
  const petrolCost = Number(row.petrol_cost);
  const dieselCost = Number(row.diesel_cost);
  const maintenanceCost = Number(row.maintenance_cost);
  const shortageLoss = Number(row.shortage_loss);
  const electricityCost = Number(row.electricity);
  const chillerMaintenanceCost = Number(row.chiller_maintenance);

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