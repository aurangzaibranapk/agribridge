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
  const haalat = await position(aajKaKhana());
  const ledgerNaKhula = Boolean(haalat.error);

  const totalBankBalance = haalat.naqdi;
  const bankBreakdown = haalat.naqdiRows.map((r) => ({ name: r.name, value: r.amount }));
  const totalReceivables = haalat.lena;
  const receivablesBreakdown = haalat.lenaRows.map((r) => ({ name: r.name, value: r.amount }));
  const totalPayables = haalat.dena === null ? null : Math.abs(haalat.dena);

  // TO PAY ka breakdown khate ke naam se nahi, BANDE ke naam se -- malik
  // ka kehna: "alag alag payments aayein naam ke sath, ek total nahi."
  // Khata ("Supplier ko dena") sab suppliers ko ek jagah mila deta tha;
  // partyBalances() har supplier/vendor ko alag qatar deta hai.
  const parties = await partyBalances(aajKaKhana());
  const payablesBreakdown = parties.error
    ? haalat.denaRows.map((r) => ({ name: r.name, value: Math.abs(r.amount) }))
    : parties.rows
        .filter((r) => r.payable > 0.5)
        .sort((a, b) => b.payable - a.payable)
        .map((r) => ({ name: r.name ?? "—", value: r.payable }));

  // Inventory breakdown (per category) -- BATCH KI ASAL KHAREED QEEMAT PAR.
  //
  // Pehle products.purchase_price (CURRENT/aaj ki rate) se ginte the.
  // Rate waqt ke sath badalti hai -- is liye purani khareedi hui qatarein
  // NAYI rate par gin jati thin, aur ledger ka khata 1200 (jo har batch ki
  // ASAL khareed qeemat par bana hai) se hamesha Rs 3,442 tak ka farq
  // dikhata tha, bhale stock ki ginti (quantity) barabar ho. Ab har batch
  // ki apni `unit_cost` istemal hoti hai -- yehi wo qeemat hai jo waqai
  // ledger mein gayi thi, is liye dono adad ab milte hain.
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

  // ===== Shops list (filter ke liye) =====
  const { data: shopsList } = await serviceClient.from("shops").select("id, name").order("name");

  // ===== POS Sales revenue (is mahine, shop filter ke sath) =====
  let posQuery = serviceClient
    .from("pos_sales")
    .select("total_amount")
    .gte("created_at", monthStart)
    .lt("created_at", nextMonthStart);
  if (shopId) posQuery = posQuery.eq("shop_id", shopId);
  const { data: posSalesRows } = await posQuery;
  const posRevenue = (posSalesRows ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

  // ===== Top Selling Items (is mahine, shop filter ke sath) =====
  let saleIdsQuery = serviceClient
    .from("pos_sales")
    .select("id")
    .gte("created_at", monthStart)
    .lt("created_at", nextMonthStart);
  if (shopId) saleIdsQuery = saleIdsQuery.eq("shop_id", shopId);
  const { data: saleIdRows } = await saleIdsQuery;
  const saleIds = (saleIdRows ?? []).map((r: any) => r.id);

  // Last 5 weeks ka sale data -- month ke andar aur 4 weeks pehle ka bhi
  const SELL_WEEKS = 5;
  const sellTrendStart = new Date(now.getTime() - (SELL_WEEKS - 1) * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let trendSaleIdsQuery = serviceClient.from("pos_sales").select("id, created_at").gte("created_at", sellTrendStart);
  if (shopId) trendSaleIdsQuery = trendSaleIdsQuery.eq("shop_id", shopId);
  const { data: trendSaleRows } = await trendSaleIdsQuery;
  const trendSaleIds = (trendSaleRows ?? []).map((r: any) => r.id as string);
  const saleWeekMap = new Map<string, string>(); // sale_id → week-index
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
      // Current month qty
      if (saleIds.includes((item as any).sale_id)) {
        const existing = productMap.get(pid);
        if (existing) { existing.qty += Number((item as any).quantity ?? 0); }
        else { productMap.set(pid, { name: prod.name ?? "—", unit: prod.unit ?? "", qty: Number((item as any).quantity ?? 0) }); }
      }
      // Weekly trend
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

  // ===== Top Debtors (DigiKhata style — jin sy zyada paisa lena) =====
  const { data: topDebtorRows } = await serviceClient
    .from("customers")
    .select("id, name, phone_number, current_balance")
    .eq("is_deleted", false)
    .gt("current_balance", 0)
    .order("current_balance", { ascending: false })
    .limit(8);

  // Har debtor ke liye last 6 weeks ka weekly net trend
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

  // Products with inventory but no batch cost records (stock mismatch ka sabab)
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

  const totalRevenue = posRevenue + (showAgri ? agriRevenue : 0) + (showDairy ? milkGrossIncome : 0);
  const totalAllExpenses = (showAgri ? totalExpenses : 0) + (showDairy ? milkTotalDeductions : 0);
  const netProfit = totalRevenue - totalAllExpenses;
  // Position bhi ledger se. Jawab na mile to NULL -- sifar nahi.
  const currentPosition = haalat.position;

  const noDataYetBusinesses = ["grain_procurement", "machinery_fleet", "vet"];

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

      {/* Shop Filter */}
      <form method="GET" className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-surface-700 dark:text-surface-300">Shop:</span>
        <select
          name="shop_id"
          defaultValue={shopId ?? ""}
          className="rounded-lg border border-surface-200 bg-white p-2 text-sm dark:border-surface-700 dark:bg-surface-900 dark:text-white"
        >
          <option value="">Sab Shops</option>
          {(shopsList ?? []).map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Filter
        </button>
        {shopId && (
          <a href="/admin/master-dashboard" className="text-sm text-surface-500 underline">
            Reset
          </a>
        )}
      </form>

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
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold">Stock ke do adad abhi barabar nahi.</p>
            <Link href="/admin/inventory#missing-batches" className="shrink-0 rounded-lg bg-amber-700 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-800">
              Inventory Kholo →
            </Link>
          </div>
          <p className="mt-1 text-xs leading-relaxed">
            Godam ki ginti (batch ki asal khareed qeemat par): <strong>Rs {Math.round(totalInventoryValue).toLocaleString()}</strong> ·
            Ledger ka khata 1200: <strong>Rs {Math.round(stockLedger ?? 0).toLocaleString()}</strong> ·
            Farq: <strong>Rs {Math.round(stockFarq).toLocaleString()}</strong>
          </p>
          <p className="mt-1 text-xs leading-relaxed">
            Wajah: kisi product ka koi batch bina record hue reh gaya hai (quantity to inventory mein hai, magar
            us ka batch/qeemat kahin darj nahi) — is liye us ka hissa upar wali ginti mein nahi aa raha.
          </p>
          {missingBatchProducts.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {missingBatchProducts.map((p) => (
                <Link key={p.id} href={`/admin/inventory?focus=${p.id}#missing-batch-${p.id}`}
                  className="rounded-md border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-surface-900 dark:text-amber-300">
                  {p.name} →
                </Link>
              ))}
            </div>
          )}
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

      <div className="mb-6 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">
          Is Mahine Ka P&L {shopId ? `(Is Shop)` : businessContext === "master" ? "(Sab)" : `(${BUSINESS_LABELS[businessContext]})`}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-surface-50 p-3 text-center dark:bg-surface-800">
            <p className="text-xs text-surface-400">{t("md_total_revenue", lang)}</p>
            <p className="font-display text-lg font-semibold text-green-600">Rs {totalRevenue.toLocaleString()}</p>
            <p className="mt-1 text-[10px] text-surface-400">
              {`POS: Rs ${posRevenue.toLocaleString()}`}
              {showAgri && agriRevenue > 0 && ` | Orders: Rs ${agriRevenue.toLocaleString()}`}
              {showDairy && milkGrossIncome > 0 && ` | Milk: Rs ${milkGrossIncome.toLocaleString()}`}
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
          <div className={`rounded-lg p-3 text-center ${netProfit >= 0 ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
            <p className="text-xs text-surface-400">{t("md_net_pl", lang)}</p>
            <p className={`font-display text-lg font-bold ${netProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>Rs {netProfit.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <ClickableCards
        variant="pl"
        expenseBreakdown={showAgri ? expenseBreakdown : []}
        milkBreakdown={showDairy ? milkBreakdown : []}
        totalExpenses={showAgri ? totalExpenses : 0}
        milkTotalDeductions={showDairy ? milkTotalDeductions : 0}
      />

      {topSellingItems.length > 0 && (
        <div className="mb-6 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">
            Top Selling Items — Is Mahine{shopId ? " (Is Shop)" : ""}
          </h2>
          <div className="space-y-2">
            {topSellingItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-5 shrink-0 text-center text-xs font-bold text-surface-400">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-surface-800 dark:text-surface-100">{item.name}</span>
                <MiniSparkline data={item.trend} color="brand" />
                <span className="w-24 shrink-0 text-right font-semibold tabular-nums text-brand-700 dark:text-brand-400">
                  {item.qty.toLocaleString()} {item.unit}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-surface-400">Sparkline = last {SELL_WEEKS} weeks · Mota line = zyada sale</p>
        </div>
      )}

      {topDebtors.length > 0 && (
        <div className="mb-6 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">
            Jin Sy Paisa Lena Hai — Top {topDebtors.length}
          </h2>
          <div className="space-y-2">
            {topDebtors.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-5 shrink-0 text-center text-xs font-bold text-surface-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <span className="text-surface-800 dark:text-surface-100">{d.name}</span>
                  {d.phone && (
                    <span className="ml-2 text-[10px] text-surface-400">{d.phone}</span>
                  )}
                </div>
                <MiniSparkline data={d.trend} color="red" />
                <span className="w-28 shrink-0 text-right font-semibold tabular-nums text-red-600 dark:text-red-400">
                  Rs {Math.round(d.balance).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center justify-between text-[10px] text-surface-400">
            <span>↑ Line upar = zyada udhaar · ↓ Neeche = wapas diya</span>
            <span>Total: Rs {Math.round(topDebtors.reduce((s, d) => s + d.balance, 0)).toLocaleString()}</span>
          </p>
        </div>
      )}

      {showDairy && (
        <p className="text-xs text-surface-400">
          Note: Milk numbers sab chillers (combined) ke liye hain. Chiller-wise breakdown ke liye
          Milk Collection → Company Billing &amp; P&amp;L page dekhein.
        </p>
      )}
    </div>
  );
}

function MiniSparkline({ data, color }: { data: number[]; color: "brand" | "red" }) {
  const W = 64, H = 22;
  const nonZero = data.some((v) => v > 0);
  if (!nonZero) {
    // Flat line — koi activity nahi
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
