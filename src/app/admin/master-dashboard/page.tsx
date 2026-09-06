import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { MasterDashboardActions } from "./master-dashboard-actions";
import { ClickableCards } from "./clickable-cards";
import { getBusinessContext, BUSINESS_LABELS } from "@/lib/utils/get-business-context";
import { position } from "@/lib/ledger/reports";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function MasterDashboardPage() {
  const supabase = createClient();
  const businessContext = await getBusinessContext();
  const lang = getLanguageFromCookies("rm");
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthStart = new Date(year, month - 1, 1).toISOString().slice(0, 10);
  const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10);

  const showDairy = businessContext === "master" || businessContext === "dairy";
  const showAgri = businessContext === "master" || businessContext === "karyana" || businessContext === "agri_inputs";
  const showCompanyWideFinancials = businessContext === "master";

  // ===== Paisa, lena, dena -- teenon ledger se =====
  //
  // Ye teenon adad pehle yahin, alag alag jagah se, apne taur par gine
  // jate the -- aur teenon GHALAT the:
  //
  //   BANK/CASH  finance_accounts mein se sirf account_type='bank'.
  //              Cash in Hand aur CBA wallet us shart se bahar the:
  //              screen par Rs 9,545, asal Rs 44,066.
  //   TO RECEIVE sirf branch_credit_transactions. Kisan ka lena
  //              (khata 1150) us table mein hota hi nahi: screen par
  //              SIFAR, asal Rs 80,450. Aur sifar jhoot bolta hai --
  //              wo kehta hai "dekh liya, kuch nahi".
  //   TO PAY     suppliers.current_payable, jab ke ledger kuch aur
  //              kehta tha. Do adad, dono theek lagte the.
  //
  // Ab teenon ek hi jagah se aate hain: trial balance. Wahi jagah jahan
  // POS, kharid, machinery aur doodh pehle se likhte hain.
  const haalat = await position(new Date().toISOString().slice(0, 10));
  const ledgerNaKhula = Boolean(haalat.error);

  const totalBankBalance = haalat.naqdi;
  const bankBreakdown = haalat.naqdiRows.map((r) => ({ name: r.name, value: r.amount }));
  const totalReceivables = haalat.lena;
  const receivablesBreakdown = haalat.lenaRows.map((r) => ({ name: r.name, value: r.amount }));
  const totalPayables = haalat.dena === null ? null : Math.abs(haalat.dena);
  const payablesBreakdown = haalat.denaRows.map((r) => ({ name: r.name, value: Math.abs(r.amount) }));

  // Inventory breakdown (per category)
  const { data: inventoryRows } = await supabase.from("inventory").select("quantity_on_hand, products(purchase_price, categories(name))");
  let totalInventoryValue = 0;
  const inventoryByCategory: Record<string, number> = {};
  (inventoryRows ?? []).forEach((r: any) => {
    const product = Array.isArray(r.products) ? r.products[0] : r.products;
    const price = Number(product?.purchase_price ?? 0);
    const value = Number(r.quantity_on_hand) * price;
    totalInventoryValue += value;
    const category = Array.isArray(product?.categories) ? product?.categories[0]?.name : product?.categories?.name;
    const catName = category ?? "Uncategorized";
    inventoryByCategory[catName] = (inventoryByCategory[catName] ?? 0) + value;
  });
  const inventoryBreakdown = Object.entries(inventoryByCategory).map(([name, value]) => ({ name, value }));

  // Stock ke DO adad -- jaan boojh kar dono.
  //
  // Malik ka usool (6 September): *"supplier se stock aaye ya hum
  // individual transfer karein, wo hamesha TRADE RATE ke hisaab se count
  // ho... jab sale karenge to profit aayega."* Is liye godam ki ginti
  // yahan kharid (trade) rate par lagti hai, sale rate par nahi.
  //
  // Doosra adad ledger ka khata 1200 hai. Aaj dono barabar NAHI hain,
  // kyunki kharid ki journal entry banti hi nahi thi. Wo ab banti hai --
  // magar purani kharid ledger mein abhi nahi gayi.
  //
  // Farq chhupaya nahi jata. Ek adad dekh kar ye nahi kaha ja sakta ke
  // wo durust hai; do sath hon to ghalati khud nazar aati hai.
  const stockLedger = haalat.stock;
  const stockFarq = stockLedger === null ? null : Math.round((totalInventoryValue - stockLedger) * 100) / 100;

  // AgriBridge Ordering revenue (this month, completed orders)
  const { data: completedOrders } = await supabase
    .from("agri_orders")
    .select("grand_total")
    .eq("status", "completed")
    .gte("created_at", monthStart)
    .lte("created_at", monthEnd + "T23:59:59");
  const agriRevenue = (completedOrders ?? []).reduce((s, o) => s + Number(o.grand_total), 0);

  // Company Expenses (this month, approved), by category
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

  // ===== Milk Collection P&L (this month, all chillers combined) =====
  const { data: billingSettings } = await supabase.from("company_billing_settings").select("service_rate_per_liter").limit(1).single();
  const serviceRate = Number(billingSettings?.service_rate_per_liter ?? 10);

  const { data: milkEntries } = await supabase.from("milk_entries").select("adjusted_volume, quantity_liters").gte("entry_date", monthStart).lte("entry_date", monthEnd);
  const totalAdjustedVolume = (milkEntries ?? []).reduce((s, e) => s + Number(e.adjusted_volume ?? e.quantity_liters ?? 0), 0);
  const milkGrossIncome = totalAdjustedVolume * serviceRate;

  // Ye sawal toota hua tha: `amount` aur `payment_date` naam ke khane
  // salary_payments mein hain hi nahi (wo net_salary aur paid_date hain).
  // Sawal chup chaap nakaam hota tha aur is dashboard par tankhwah ka
  // adad HAR MAHINE sifar aata tha.
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

  // ===== Capital Sources =====
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

  const totalRevenue = (showAgri ? agriRevenue : 0) + (showDairy ? milkGrossIncome : 0);
  const totalAllExpenses = (showAgri ? totalExpenses : 0) + (showDairy ? milkTotalDeductions : 0);
  const netProfit = totalRevenue - totalAllExpenses;
  // Position bhi ledger se. Jawab na mile to NULL -- sifar nahi.
  const currentPosition = haalat.position;

  const noDataYetBusinesses = ["grain_procurement", "machinery_fleet"];

  return (
    <div>
      <PageHeader
        title={t("md_title", lang)}
        description={
          businessContext === "master"
            ? "Poora business ek nazar mein - box par click karein, neeche graph khulega"
            : `${BUSINESS_LABELS[businessContext]} - box par click karein, neeche graph khulega`
        }
      />

      {noDataYetBusinesses.includes(businessContext) && (
        <div className="mb-6 rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400">
          {BUSINESS_LABELS[businessContext]} ke liye dedicated P&L abhi nahi bana (roadmap ke Phase 13/14 mein banega). Neeche company-wide numbers dikh rahe hain.
        </div>
      )}

      <MasterDashboardActions />

      {ledgerNaKhula && (
        <div className="mb-6 rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <p className="font-semibold">Ledger ka jawab nahi mila — paisa, lena, dena aur position khali hain.</p>
          <p className="mt-1 text-xs">
            Ye adad SIFAR nahi hain, gine hi nahi ja sake: {haalat.error}
          </p>
        </div>
      )}

      {stockFarq !== null && Math.abs(stockFarq) > 1 && (
        <div className="mb-6 rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          <p className="font-semibold">Stock ke do adad abhi barabar nahi.</p>
          <p className="mt-1 text-xs leading-relaxed">
            Godam ki ginti (trade rate par): <strong>Rs {Math.round(totalInventoryValue).toLocaleString()}</strong> ·
            Ledger ka khata 1200: <strong>Rs {Math.round(stockLedger ?? 0).toLocaleString()}</strong> ·
            Farq: <strong>Rs {Math.round(stockFarq).toLocaleString()}</strong>
          </p>
          <p className="mt-1 text-xs leading-relaxed">
            Wajah: kharid receive hone par ledger mein entry banti hi nahi thi. Ab banti hai — magar jo kharid
            us se pehle ho chuki, wo ledger mein abhi nahi gayi. Upar likha POSITION ledger se banta hai, is liye
            us mein stock abhi poora shamil nahi.
          </p>
        </div>
      )}

      <ClickableCards
        totalCapitalInvested={totalCapitalInvested}
        capitalBreakdown={capitalBreakdown}
        currentPosition={currentPosition}
        totalBankBalance={totalBankBalance}
        bankBreakdown={bankBreakdown}
        totalInventoryValue={totalInventoryValue}
        inventoryBreakdown={inventoryBreakdown}
        totalReceivables={totalReceivables}
        receivablesBreakdown={receivablesBreakdown}
        totalPayables={totalPayables}
        payablesBreakdown={payablesBreakdown}
      />

      {!showCompanyWideFinancials && (
        <p className="mb-4 text-xs text-surface-400">{t("at_note_split", lang)}</p>
      )}

      {(showAgri || showDairy) && (
        <div className="mb-6 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">
            Is Mahine Ka P&L {businessContext === "master" ? "(AgriBridge + Milk Collection)" : `(${BUSINESS_LABELS[businessContext]})`}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-surface-50 p-3 text-center dark:bg-surface-800">
              <p className="text-xs text-surface-400">{t("md_total_revenue", lang)}</p>
              <p className="font-display text-lg font-semibold text-green-600">Rs {totalRevenue.toLocaleString()}</p>
              <p className="mt-1 text-[10px] text-surface-400">
                {showAgri && `AgriBridge: Rs ${agriRevenue.toLocaleString()}`}
                {showAgri && showDairy && " | "}
                {showDairy && `Milk: Rs ${milkGrossIncome.toLocaleString()}`}
              </p>
            </div>
            <div className="rounded-lg bg-surface-50 p-3 text-center dark:bg-surface-800">
              <p className="text-xs text-surface-400">{t("md_total_expenses", lang)}</p>
              <p className="font-display text-lg font-semibold text-red-600">Rs {totalAllExpenses.toLocaleString()}</p>
              <p className="mt-1 text-[10px] text-surface-400">
                {showAgri && `Company: Rs ${totalExpenses.toLocaleString()}`}
                {showAgri && showDairy && " | "}
                {showDairy && `Milk: Rs ${milkTotalDeductions.toLocaleString()}`}
              </p>
            </div>
            <div className={`rounded-lg p-3 text-center ${netProfit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
              <p className="text-xs text-surface-400">{t("md_net_pl", lang)}</p>
              <p className={`font-display text-lg font-bold ${netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>Rs {netProfit.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      <ClickableCards
        variant="pl"
        expenseBreakdown={showAgri ? expenseBreakdown : []}
        milkBreakdown={showDairy ? milkBreakdown : []}
        totalExpenses={showAgri ? totalExpenses : 0}
        milkTotalDeductions={showDairy ? milkTotalDeductions : 0}
      />

      {showDairy && (
        <p className="text-xs text-surface-400">
          Note: Milk numbers sab chillers (combined) ke liye hain. Chiller-wise breakdown ke liye
          Milk Collection → Company Billing &amp; P&amp;L page dekhein.
        </p>
      )}
    </div>
  );
}