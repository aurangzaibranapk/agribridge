import { createServiceClient } from "@/lib/supabase/service";
import { t } from "@/lib/i18n/translations";
import type { Lang } from "@/lib/i18n/translations";
import { loadCostSheet } from "@/lib/milk-cost-per-liter";
import { quantityReport } from "@/lib/ledger/quantity-money";

/**
 * Owner Command Center ke aankre.
 *
 * Yahan har adad kisi asal khane se aata hai -- koi andaza nahi. Jo
 * cheez maujooda data se nahi nikalti, wo "—" rehti hai. Dashboard par
 * ghalat adad likhna khali khane se kahin bura hota: khali khana sawal
 * paida karta hai, ghalat adad faisla badal deta hai.
 *
 * Isi wajah se har department ka hisaab USI kitab se liya gaya hai jo
 * us department ka apna safha dikhata hai. Do jagah do qaide rakhne se
 * kisi din do alag adad nikal aate hain, aur phir ye sawal khatam nahi
 * hota ke sach kaunsa hai:
 *
 *   Milk      -- Company Billing aur P&L wali policy: aamdani service
 *                rate (fi litre) se banti hai; kisan ka doodh guzarne
 *                wali raqam hai, is P&L ka hissa nahi.
 *   Grain     -- grain_sales: total_cogs sirf BIKE hue maal ki lagat
 *                hai. Is mahine ki KHAREED us ke muqable mein rakhna
 *                godam ko nuqsan bana deta hai -- wo nuqsan nahi, maal
 *                hai.
 *   Machinery -- v_machinery_pnl_booking: hamari aamdani commission
 *                hai, gross billing nahi; aur sirf WO diesel kharcha
 *                hai jo hamara apna tha. Wapas aane wala diesel kharcha
 *                nahi -- usay kharcha likhna jhoota nuqsan banata hai.
 *   Retail    -- pos_sales: nafa aur lagat dono pehle se likhe hote
 *                hain.
 *
 * Aur ek usool poore safhe par lagta hai: **Rs 0 ka matlab hai "dekh
 * liya, kuch nahi hua". Jis cheez ka indraj hi nahi hota us ke saamne
 * "—" aata hai, sifar nahi.** Dono ko kabhi mila kar nahi dikhaya jata.
 */

/**
 * Kisi khane ki halat:
 *   ok         -- adad asal record se aaya, us par bharosa kiya ja sakta hai
 *   incomplete -- kaam to hua hai magar us ka koi khana abhi khali hai
 *   untracked  -- ye cheez is department ke liye rakhi hi nahi jati
 */
export type DataState = "ok" | "incomplete" | "untracked";

export interface DeptKpi {
  key: string;
  label: string;
  /** Row par click karne se kahan jana hai. */
  href: string;
  /** Kaam ke chhote tukre: "Kharida 1,200 kg", "Bika 400 kg", "Godam 800 kg". */
  work: string[];
  /** Aamdani -- na nikal sake to null. */
  revenue: number | null;
  /** Seedhi lagat: jo cheez bechi ya kaam kiya, us ki apni lagat. */
  directCost: number | null;
  /** Baqi kharcha: chalane ka kharcha (tankhwah, bijli, marammat...). */
  otherExpense: number | null;
  /** Nafa -- sirf tab jab dono asal mein maujood hon. */
  profit: number | null;
  /** Margin -- sirf tab jab aamdani sifar se zyada ho. */
  margin: number | null;
  /** Jo kaam pare hue hain. */
  pending: number;
  /** Pending kis wajah se hai -- adad ke sath wajah bhi nazar aani chahiye. */
  pendingReason: string | null;
  pendingHref: string | null;
  /** Is department ke maali khane ki halat. */
  state: DataState;
  /** Wo cheez jo abhi is khane se nahi nikalti, ya jo policy samjhani zaroori hai. */
  note: string | null;
}

export interface DeptTotals {
  revenue: number;
  cost: number;
  net: number;
  /** Kitne department poore hisaab ke sath shaamil hue. */
  included: number;
  /** Jin ka hisaab adhoora hone ki wajah se shaamil nahi kiya gaya. */
  excluded: string[];
  attention: number;
}

export interface MoneyToday {
  revenue: number;
  expenses: number;
  net: number;
  cash: number;
  receivable: number | null;
  payable: number | null;
}

export interface Alert {
  tone: "red" | "amber" | "green";
  title: string;
  detail: string;
  href: string;
}

function n(value: unknown): number {
  return Number(value ?? 0);
}

function sumOf<T extends Record<string, unknown>>(rows: T[] | null, column: keyof T): number {
  return (rows ?? []).reduce((total, row) => total + n(row[column]), 0);
}

/**
 * Jumle mein khane bharna.
 *
 * `t()` khud khane nahi bharta, is liye ye chhota sa kaam yahan hota
 * hai. Faida ye hai ke jumla poora ka poora zaban ki file mein rehta
 * hai -- tukron mein jorne se har zaban ka apna qaida toot jata hai
 * (Urdu mein adad aur lafz ki tarteeb English jaisi nahi).
 */
function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function loadMoneyToday(): Promise<MoneyToday> {
  const service = createServiceClient();
  const t = today();

  const [
    { data: sales },
    { data: posRet },
    { data: posRetItems },
    { data: grainSales },
    { data: expenses },
    { data: accounts },
    { data: credit },
  ] = await Promise.all([
      service.from("pos_sales").select("total_amount, profit").gte("created_at", t),
      // Aaj ki wapsiyaan. Bikri se ghatani parti hain -- warna wapas hui
      // cheez bhi aamdani mein ginti rehti hai.
      service.from("pos_returns").select("total_amount").gte("created_at", t),
      // Wapas aaye maal ki lagat -- nafa theek karne ke liye. Sirf raqam
      // ghatane se nafa ghalat rehta: cheez ke sath us ki lagat bhi wapas
      // aati hai.
      service
        .from("pos_return_items")
        .select("line_cogs, pos_returns!inner(created_at)")
        .gte("pos_returns.created_at", t),
      service.from("grain_sales").select("total_amount, profit").eq("sale_date", t),
      service.from("company_expense_requests").select("amount").eq("status", "approved").gte("created_at", t),
      service.from("finance_accounts").select("current_balance").eq("is_active", true),
      service.from("branch_credit_transactions").select("transaction_type, amount"),
    ]);

  // Wapsi bikri se GHATTI hai.
  //
  // 5 September ko malik ne do cheezein bech kar dono wapas lin, aur
  // safha phir bhi Rs 30 bikri aur Rs 2 nafa dikhata raha. Wajah ye thi
  // ke yahan sirf pos_sales parhi jati thi -- aur wapas hui bikri par
  // sirf ek nishaan lagta hai, wo qatar mitti nahi (aur mitni bhi nahi
  // chahiye: us din bikri waqai hui thi).
  //
  // Is liye ab wapsi alag se ghatai jati hai. Bikri ki qatar apni jagah
  // sachchi rehti hai, aur adad bhi sacha ho jata hai.
  const posReturned = sumOf(posRet, "total_amount");
  const posReturnedCogs = sumOf(posRetItems as { line_cogs: number }[] | null, "line_cogs");
  const revenue = sumOf(sales, "total_amount") - posReturned + sumOf(grainSales, "total_amount");
  const spent = sumOf(expenses, "amount");
  // Nafa wahan se liya jata hai jahan wo pehle se gina hua hai, dobara
  // nahi ginte -- COGS ka hisaab har jagah thora alag hota hai aur do
  // jagah ginne se do alag adad nikal aate hain. Wapsi ka nafa alag se
  // ghatana parta hai (neeche mahine wale hisaab mein poora kiya gaya
  // hai; yahan aaj ke tile par bikri ki raqam ghata di gayi hai).
  const grossProfit =
    sumOf(sales, "profit") - (posReturned - posReturnedCogs) + sumOf(grainSales, "profit");

  // Shop ka bojh: charge barhata hai, adaigi ghatati hai. Wahi usool jo
  // /admin/branch-credit dikhata hai.
  let receivable: number | null = null;
  if (credit) {
    receivable = credit.reduce(
      (total, row) => (row.transaction_type === "payment" ? total - n(row.amount) : total + n(row.amount)),
      0
    );
  }

  return {
    revenue,
    expenses: spent,
    net: grossProfit - spent,
    cash: sumOf(accounts, "current_balance"),
    receivable,
    payable: null,
  };
}

/** Mahine ka aakhri din -- YYYY-MM-DD. */
function monthEnd(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

function fmtQty(value: number, unit: string): string {
  return `${Math.round(value).toLocaleString()} ${unit}`;
}

export async function loadDeptKpis(lang: Lang = "rm"): Promise<DeptKpi[]> {
  const service = createServiceClient();
  const from = monthStart();
  const to = monthEnd();

  const [
    { data: pos, error: posErr },
    { data: posRet, error: posRetErr },
    { data: posRetItems, error: posRetItemsErr },
    { data: grain, error: grainErr },
    { data: grainBuy, error: grainBuyErr },
    { data: grainStock, error: grainStockErr },
    { data: bookings, error: bookingsErr },
    { data: machPnl, error: machPnlErr },
    { data: milk, error: milkErr },
    { data: billingSettings },
    { data: salaries, error: salariesErr },
    { data: fuel, error: fuelErr },
    { data: generator, error: generatorErr },
    { data: maintenance, error: maintenanceErr },
    { data: monthlyExp, error: monthlyExpErr },
    { data: routes, error: routesErr },
    { data: rateSettings },
    { data: pendingSubs },
    { data: pendingReturns },
    { data: pendingFat },
  ] = await Promise.all([
    service.from("pos_sales").select("total_amount, profit, total_cogs").gte("created_at", from),
    // Wapsiyaan aur wapas aaye maal ki lagat -- dono bikri se ghatti
    // hain. Bikri ki qatar mitti nahi (us din bikri waqai hui thi), is
    // liye ghatana yahan hota hai.
    service.from("pos_returns").select("total_amount").gte("created_at", from),
    service
      .from("pos_return_items")
      .select("line_cogs, pos_returns!inner(created_at)")
      .gte("pos_returns.created_at", from),
    service
      .from("grain_sales")
      .select("total_amount, profit, total_cogs, quantity_kg, bardana_cost, mazdoori_cost")
      .gte("sale_date", from),
    service.from("grain_procurement_entries").select("total_amount, weight_kg").gte("entry_date", from),
    service.from("v_grain_warehouse_stock").select("maujood_kg"),
    service
      .from("v_machinery_control")
      .select("booking_id, raw_status, kaam_mukammal, harvest_area, bill_number")
      .gte("booking_date", from),
    // Machinery ka nafa nuqsan wahi view deta hai jo /admin/machinery-rental/pnl
    // dikhata hai -- commission, hamara diesel aur munafa sab wahan se.
    // Hisaab ki bunyaad BILL ki tareekh hai (malik ka faisla), is liye
    // jo kaam abhi bill nahi hua wo aamdani mein nahi ginta.
    service
      .from("v_machinery_pnl_booking")
      .select("acre, hamari_aamdani, diesel_hamara_kharcha, munafa, gross_billing")
      .gte("bill_date", from),
    service
      .from("milk_entries")
      .select("quantity_liters, adjusted_volume, total_amount")
      .gte("entry_date", from)
      .neq("status", "rejected"),
    service.from("company_billing_settings").select("service_rate_per_liter").limit(1).maybeSingle(),
    service.from("salary_payments").select("net_salary").eq("pay_month", new Date().getMonth() + 1).eq("pay_year", new Date().getFullYear()),
    service.from("fuel_logs").select("fuel_cost").gte("log_date", from).lte("log_date", to),
    service.from("generator_logs").select("diesel_cost").gte("log_date", from).lte("log_date", to),
    service.from("maintenance_logs").select("cost").gte("service_date", from).lte("service_date", to),
    service
      .from("monthly_expenses")
      .select("category, amount")
      .eq("expense_month", new Date().getMonth() + 1)
      .eq("expense_year", new Date().getFullYear()),
    service.from("milk_route_collections").select("shortage_liters").gte("collection_date", from).lte("collection_date", to),
    service.from("milk_rate_settings").select("standard_rate").limit(1).maybeSingle(),
    service.from("whatsapp_submissions").select("id").eq("status", "pending"),
    service.from("agri_order_returns").select("id").eq("status", "pending"),
    service.from("milk_entries").select("id").eq("status", "pending_fat"),
  ]);

  // ---------- Sawal nakaam to nahi hua? ----------
  //
  // Ye hissa sab se ahem hai. PostgREST ka nakaam sawal `data: null`
  // deta hai, aur null ko jama karne par SIFAR nikalta hai -- yani
  // safha bilkul theek nazar aata hai aur adad khamoshi se ghalat hota
  // hai. Yahi ghalti pehle Access Requests par ho chuki hai (58 tables
  // par GRANT ki kami se har adad sifar aa raha tha) aur wo tab tak
  // pakri nahi gayi jab tak safhe ne sach bolna shuru nahi kiya.
  //
  // Is liye: sawal nakaam ho to us department ka hisaab "adhoora" hai,
  // sifar nahi.
  const failed = (...errors: ({ message: string } | null)[]): string | null => {
    const first = errors.find((e) => e);
    return first ? first.message : null;
  };

  const milkFail = failed(milkErr, salariesErr, fuelErr, generatorErr, maintenanceErr, monthlyExpErr, routesErr);
  const grainFail = failed(grainErr, grainBuyErr, grainStockErr);
  const machFail = failed(machPnlErr, bookingsErr);
  const retailFail = failed(posErr, posRetErr, posRetItemsErr);

  // ---------- Milk ----------
  // Policy wahi jo /admin/milk-collection/billing aur Master Dashboard
  // par chalti hai: aamdani = adjusted volume x service rate.
  const milkLiters = (milk ?? []).reduce((total, e) => total + n(e.adjusted_volume ?? e.quantity_liters), 0);
  const milkFarmerPayable = sumOf(milk, "total_amount");
  const serviceRate = billingSettings ? n(billingSettings.service_rate_per_liter) : null;

  const milkFuel = sumOf(fuel, "fuel_cost");
  const milkGenerator = sumOf(generator, "diesel_cost");
  const milkMaintenance = sumOf(maintenance, "cost");
  const milkSalaries = sumOf(salaries, "net_salary");
  const expenseMap = new Map((monthlyExp ?? []).map((e) => [e.category as string, n(e.amount)]));
  const milkElectricity = expenseMap.get("electricity") ?? 0;
  const milkChiller = expenseMap.get("chiller_maintenance") ?? 0;
  const standardRate = rateSettings ? n(rateSettings.standard_rate) : 0;
  const shortageLiters = (routes ?? []).reduce((total, r) => total + Math.max(0, n(r.shortage_liters)), 0);
  const shortageLoss = shortageLiters * standardRate;

  const milkRevenue = serviceRate != null && serviceRate > 0 ? milkLiters * serviceRate : null;
  const milkDirect = milkFuel + milkGenerator + shortageLoss;
  const milkOther = milkSalaries + milkElectricity + milkChiller + milkMaintenance;
  const milkProfit = milkRevenue == null ? null : milkRevenue - milkDirect - milkOther;

  const milkWork = [`${t("cc_w_collected", lang)} ${fmtQty(milkLiters, "L")}`];
  if (shortageLiters > 0) milkWork.push(`${t("cc_w_shortage", lang)} ${fmtQty(shortageLiters, "L")}`);
  if (milkFarmerPayable > 0)
    milkWork.push(`${t("cc_w_farmer_payable", lang)} Rs ${Math.round(milkFarmerPayable).toLocaleString()}`);

  // ---------- Grain ----------
  const grainRevenue = sumOf(grain, "total_amount");
  const grainCogs = sumOf(grain, "total_cogs");
  const grainOther = sumOf(grain, "bardana_cost") + sumOf(grain, "mazdoori_cost");
  const grainProfit = sumOf(grain, "profit");
  const grainBought = sumOf(grainBuy, "weight_kg");
  const grainSold = sumOf(grain, "quantity_kg");
  const grainInStock = sumOf(grainStock, "maujood_kg");
  const grainBuyValue = sumOf(grainBuy, "total_amount");

  // ---------- Machinery ----------
  const machRevenue = sumOf(machPnl, "hamari_aamdani");
  const machDirect = sumOf(machPnl, "diesel_hamara_kharcha");
  const machProfit = sumOf(machPnl, "munafa");
  const machAcres = sumOf(machPnl, "acre");
  const liveBookings = (bookings ?? []).filter((b) => b.raw_status !== "cancelled");
  const completed = liveBookings.filter((b) => b.kaam_mukammal === true).length;
  const bookedAcres = liveBookings.reduce((total, b) => total + n(b.harvest_area), 0);
  // Mukammal kaam jis ka bill abhi nahi bana -- ye aamdani abhi gini
  // nahi jati. Bina is nishan ke owner samjhta hai machinery ne kam
  // kamaya, jab ke asal mein bill hi nahi bana.
  const unbilled = liveBookings.filter((b) => b.kaam_mukammal === true && !b.bill_number).length;

  // ---------- Retail ----------
  //
  // WAPSI BIKRI SE GHATTI HAI.
  //
  // 5 September ko malik ne do cheezein bech kar dono wapas lin, aur
  // safha phir bhi Rs 30 bikri aur Rs 2 nafa dikhata raha. Wajah: yahan
  // sirf pos_sales parhi jati thi. Wapas hui bikri par sirf ek nishaan
  // lagta hai -- wo qatar mitti nahi, aur mitni bhi nahi chahiye: us din
  // bikri waqai hui thi, aur us din ka hisaab jhoota nahi kiya jata.
  //
  // Is liye wapsi ALAG SE ghatai jati hai: raqam bhi aur us maal ki
  // lagat bhi. Sirf raqam ghatane se nafa ghalat reh jata -- cheez ke
  // sath us ki lagat bhi wapas aati hai.
  const retReturned = sumOf(posRet, "total_amount");
  const retReturnedCogs = sumOf(posRetItems as { line_cogs: number }[] | null, "line_cogs");

  const retailRevenue = sumOf(pos, "total_amount") - retReturned;
  const retailCogs = sumOf(pos, "total_cogs") - retReturnedCogs;
  const retailProfit = retailRevenue - retailCogs;

  const margin = (profit: number | null, revenue: number | null) =>
    profit != null && revenue != null && revenue > 0 ? (profit / revenue) * 100 : null;

  return [
    {
      key: "milk",
      label: "Milk",
      href: "/admin/milk-collection/billing",
      work: milkWork,
      revenue: milkRevenue,
      directCost: milkDirect,
      otherExpense: milkOther,
      profit: milkProfit,
      margin: margin(milkProfit, milkRevenue),
      pending: (pendingFat ?? []).length,
      pendingReason:
        (pendingFat ?? []).length > 0 ? `${(pendingFat ?? []).length} ${t("cc_p_fat", lang)}` : null,
      pendingHref: "/admin/milk-collection/verify",
      state: milkFail || milkRevenue == null ? "incomplete" : "ok",
      note: milkFail
        ? fill(t("cc_n_read_failed", lang), { err: milkFail })
        : milkRevenue == null
          ? t("cc_n_milk_no_rate", lang)
          : t("cc_n_milk", lang),
    },
    {
      key: "grain",
      label: "Grain",
      href: "/admin/grain-procurement/dashboard",
      work: [
        `${t("cc_w_bought", lang)} ${fmtQty(grainBought, "kg")}`,
        `${t("cc_w_sold", lang)} ${fmtQty(grainSold, "kg")}`,
        `${t("cc_w_in_store", lang)} ${fmtQty(grainInStock, "kg")}`,
      ],
      revenue: grainRevenue,
      directCost: grainCogs,
      otherExpense: grainOther,
      profit: grainProfit,
      margin: margin(grainProfit, grainRevenue),
      pending: 0,
      pendingReason: null,
      pendingHref: null,
      state: grainFail ? "incomplete" : "ok",
      note: grainFail
        ? fill(t("cc_n_read_failed", lang), { err: grainFail })
        : grainBought > 0 && grainSold === 0
          ? t("cc_n_grain_unsold", lang)
          : t("cc_n_grain", lang),
    },
    {
      key: "machinery",
      label: "Machinery",
      href: "/admin/machinery-rental/pnl",
      work: [
        `${t("cc_w_bookings", lang)} ${liveBookings.length}`,
        `${t("cc_w_completed", lang)} ${completed}`,
        `${t("cc_w_acres", lang)} ${machAcres > 0 ? machAcres.toFixed(1) : bookedAcres.toFixed(1)}`,
      ],
      revenue: machRevenue,
      directCost: machDirect,
      otherExpense: null,
      profit: machProfit,
      margin: margin(machProfit, machRevenue),
      pending: unbilled,
      pendingReason: unbilled > 0 ? `${unbilled} ${t("cc_p_unbilled", lang)}` : null,
      pendingHref: "/admin/machinery-rental/billing",
      state: machFail ? "incomplete" : "ok",
      note: machFail ? fill(t("cc_n_read_failed", lang), { err: machFail }) : t("cc_n_machinery", lang),
    },
    {
      key: "retail",
      label: "Retail",
      href: "/admin/reports/pnl",
      // Bikri aur wapsi dono nazar mein. Sirf bikri ka adad dikhane se
      // ye baat chhup jati hai ke un mein se kitni wapas aa gayi.
      work: [
        `${t("cc_w_sales", lang)} ${(pos ?? []).length}`,
        ...((posRet ?? []).length > 0 ? [`${t("cc_w_returns", lang)} ${(posRet ?? []).length}`] : []),
      ],
      revenue: retailRevenue,
      directCost: retailCogs,
      otherExpense: null,
      profit: retailProfit,
      margin: margin(retailProfit, retailRevenue),
      pending: (pendingReturns ?? []).length,
      pendingReason:
        (pendingReturns ?? []).length > 0 ? `${(pendingReturns ?? []).length} ${t("cc_p_returns", lang)}` : null,
      pendingHref: "/admin/agri-returns",
      state: retailFail ? "incomplete" : "ok",
      note: retailFail ? fill(t("cc_n_read_failed", lang), { err: retailFail }) : t("cc_n_retail", lang),
    },
    {
      key: "approvals",
      label: "Approval",
      href: "/admin/submissions",
      work: [`${t("cc_w_waiting", lang)} ${(pendingSubs ?? []).length}`],
      revenue: null,
      directCost: null,
      otherExpense: null,
      profit: null,
      margin: null,
      pending: (pendingSubs ?? []).length,
      pendingReason:
        (pendingSubs ?? []).length > 0 ? `${(pendingSubs ?? []).length} ${t("cc_p_approvals", lang)}` : null,
      pendingHref: "/admin/submissions",
      state: "untracked",
      note: t("cc_n_approval", lang),
    },
  ];
}

/**
 * Upar ke chaar card.
 *
 * Sirf wo department jama kiye jate hain jin ka maali hisaab POORA hai.
 * Adhoore department ko chup chaap sifar maan lena sab se aam dashboard
 * ki ghalti hai: kul adad theek nazar aata hai aur kisi ko pata nahi
 * chalta ke us mein ek poora karobar shaamil hi nahi.
 */
export function deptTotals(depts: DeptKpi[]): DeptTotals {
  const money = depts.filter((d) => d.revenue != null || d.directCost != null);
  const complete = money.filter((d) => d.state === "ok");
  const excluded = money.filter((d) => d.state !== "ok").map((d) => d.label);

  return {
    revenue: complete.reduce((total, d) => total + (d.revenue ?? 0), 0),
    cost: complete.reduce((total, d) => total + (d.directCost ?? 0) + (d.otherExpense ?? 0), 0),
    net: complete.reduce((total, d) => total + (d.profit ?? 0), 0),
    included: complete.length,
    excluded,
    attention: depts.reduce((total, d) => total + d.pending, 0),
  };
}

export async function loadAlerts(): Promise<Alert[]> {
  const service = createServiceClient();
  const alerts: Alert[] = [];
  const from = monthStart();

  const [{ data: redRoutes }, { data: subs }, { data: expenses }, { data: openLogs }, { data: dupMilk }] =
    await Promise.all([
      service
        .from("milk_route_collections")
        .select("route_name, collection_date, shortage_liters")
        .eq("is_red_alert", true)
        .gte("collection_date", from)
        .order("collection_date", { ascending: false })
        .limit(3),
      service.from("whatsapp_submissions").select("id").eq("status", "pending"),
      service.from("company_expense_requests").select("id").eq("status", "pending"),
      service.from("vehicle_daily_logs").select("id").not("opening_km", "is", null).is("closing_km", null).lt("log_date", today()),
      service.from("milk_entries").select("id").not("possible_duplicate_of", "is", null).neq("status", "rejected"),
    ]);

  for (const route of redRoutes ?? []) {
    alerts.push({
      tone: "red",
      title: `Doodh ki kami — ${route.route_name}`,
      detail: `${route.collection_date}: ${Math.abs(n(route.shortage_liters))} L ka farq, hadd se zyada.`,
      href: "/admin/milk-collection/routes",
    });
  }

  if ((subs ?? []).length > 0) {
    alerts.push({
      tone: "amber",
      title: `${(subs ?? []).length} entry approval ke intezar mein`,
      detail: "In par faisla hone tak paisa kisi khate mein nahi jata.",
      href: "/admin/submissions",
    });
  }

  if ((expenses ?? []).length > 0) {
    alerts.push({
      tone: "amber",
      title: `${(expenses ?? []).length} kharcha manzoori ke intezar mein`,
      detail: "Finance ne abhi in par faisla nahi kiya.",
      href: "/admin/company-expenses",
    });
  }

  if ((openLogs ?? []).length > 0) {
    alerts.push({
      tone: "red",
      title: `${(openLogs ?? []).length} gaari ka shaam wala meter nahi aaya`,
      detail: "Guzray hue dinon ka hisaab adhoora hai.",
      href: "/admin/field-watch",
    });
  }

  if ((dupMilk ?? []).length > 0) {
    alerts.push({
      tone: "amber",
      title: `${(dupMilk ?? []).length} doodh ki entry par duplicate ka nishan`,
      detail: "Usi kisan ki usi shift mein ek se zyada entry mili.",
      href: "/admin/milk-collection/verify",
    });
  }

  // ---- Fi litre ka hisaab adhoora to nahi? ----
  // Khali khana sifar ki tarah ginta hai, aur us se fi litre kharcha
  // ASAL SE KAM nazar aata hai -- yani munafa asal se ZYADA. Ye ghalti
  // chup rehti hai: safha bilkul theek nazar aata hai, bas adad chhota
  // hota hai. Is liye ye baat yahan bhi aati hai, us safhe par jane ka
  // intezar nahi kiya jata.
  const now = new Date();
  const sheet = await loadCostSheet(now.getMonth() + 1, now.getFullYear(), null);
  if (sheet.liters > 0 && sheet.missing.length > 0) {
    alerts.push({
      tone: sheet.missing.length >= 3 ? "red" : "amber",
      title: `Fi litre ka hisaab adhoora — ${sheet.missing.length} khane khali`,
      detail:
        `${sheet.missing.join(", ")} is mahine darj nahi huye. ` +
        `Abhi fi litre Rs ${(sheet.perLiterRunning ?? 0).toFixed(2)} dikh raha hai — asal is se zyada hoga.`,
      href: "/admin/milk-collection/cost-per-liter",
    });
  }

  // ---- Raat ki ginti chhoot to nahi rahi? ----
  // Jis din ginti nahi hui, us din ka farq kabhi maloom nahi hoga --
  // aur farq wahi ek cheez hai jo kaghaz aur golak ka faasla dikhati
  // hai. Ye baat safhe par jane ka intezar nahi kar sakti, kyunki
  // chhoote hue din khud koi shor nahi machate.
  const [{ data: missedDays }, { data: bigGaps }] = await Promise.all([
    service.from("v_cash_close_missing").select("branch_name, close_date"),
    service
      .from("cash_closings")
      .select("branch_id, close_date, difference, branches(name)")
      .neq("difference", 0)
      .gte("close_date", from)
      .order("close_date", { ascending: false })
      .limit(5),
  ]);

  if ((missedDays ?? []).length > 0) {
    const branchNames = Array.from(
      new Set((missedDays ?? []).map((d) => d.branch_name ?? "—"))
    );
    alerts.push({
      tone: (missedDays ?? []).length >= 3 ? "red" : "amber",
      title: `${(missedDays ?? []).length} din ki cash ginti nahi hui`,
      detail: `${branchNames.join(", ")} — un dinon cash hila magar raat ko gina nahi gaya. Us din ka farq ab maloom nahi ho sakta.`,
      href: "/admin/cash-close",
    });
  }

  const gapTotal = (bigGaps ?? []).reduce((sum, g) => sum + Math.abs(n(g.difference)), 0);
  if (gapTotal > 0) {
    alerts.push({
      tone: gapTotal >= 2000 ? "red" : "amber",
      title: `Cash ginti mein Rs ${Math.round(gapTotal).toLocaleString()} ka farq`,
      detail:
        `Is mahine ${(bigGaps ?? []).length} raat golak aur hisaab barabar nahi mile. ` +
        `Har farq "Cash ka farq" khate mein darj hai — kisi kharche mein chhupaya nahi gaya.`,
      href: "/admin/cash-close",
    });
  }

  // ---- Cash jo abhi kisi ke haath mein hai ----
  // Ye raqam "raaste mein" hai, gum nahi -- magar jitna waqt guzarta
  // hai, utna kam mumkin hota jata hai ke wo kabhi mile. Is liye din
  // ginte hain, sirf raqam nahi.
  const { data: inTransit } = await service
    .from("v_cash_in_transit")
    .select("amount_sent, din_guzray, lene_wala, le_jane_wala");

  const transitRows = inTransit ?? [];
  if (transitRows.length > 0) {
    const total = transitRows.reduce((sum, r) => sum + n(r.amount_sent), 0);
    const stale = transitRows.filter((r) => n(r.din_guzray) >= 2);
    const names = Array.from(
      new Set(stale.map((r) => r.le_jane_wala ?? r.lene_wala ?? "—"))
    );

    alerts.push({
      tone: stale.length > 0 ? "red" : "amber",
      title: `Rs ${Math.round(total).toLocaleString()} abhi kisi ke haath mein hai`,
      detail:
        stale.length > 0
          ? `${stale.length} raqam do ya us se zyada din se raaste mein hai — ${names.join(", ")}. Tasdeeq abhi tak nahi hui.`
          : `${transitRows.length} handover ki tasdeeq baqi hai.`,
      href: "/admin/cash-handover",
    });
  }

  // ---- Bank ki wo qataren jo hamare khate mein hain hi nahi ----
  const { data: bankGaps } = await service
    .from("bank_statement_lines")
    .select("amount")
    .eq("status", "unmatched");

  if ((bankGaps ?? []).length > 0) {
    const total = (bankGaps ?? []).reduce((sum, r) => sum + Math.abs(n(r.amount)), 0);
    alerts.push({
      tone: "amber",
      title: `Bank ki ${(bankGaps ?? []).length} qatar hamare khate mein nahi`,
      detail: `Rs ${Math.round(total).toLocaleString()} ka farq. Bank ghalat nahi hota — ye entriyan hamari taraf reh gayi hain.`,
      href: "/admin/bank-reconcile",
    });
  }

  // ---- Jin godamon ki ginti bohat arse se nahi hui ----
  // Kabhi na gina gaya godam sab se khatarnak hai: wahan farq ka jama
  // hona shuru se jari hai aur kisi ne dekha hi nahi. Maal chupke se
  // nikalna cash se aasan hota hai -- Rs 50,000 ghayab hon to raat ko
  // pakre jate hain, paanch bori khaad ghayab ho to koi ginta hi nahi.
  const { data: staleStock } = await service
    .from("v_stock_count_overdue")
    .select("warehouse_name, din_guzray");

  if ((staleStock ?? []).length > 0) {
    const never = (staleStock ?? []).filter((w) => n(w.din_guzray) >= 9999);
    const names = (staleStock ?? []).map((w) => w.warehouse_name ?? "—");
    alerts.push({
      tone: never.length > 0 ? "red" : "amber",
      title: `${(staleStock ?? []).length} godam ki ginti arse se nahi hui`,
      detail:
        never.length > 0
          ? `${never.length} godam to kabhi gina hi nahi gaya (${names.join(", ")}). Wahan farq ka jama hona shuru se jari hai.`
          : `${names.join(", ")} — ek mahine se zyada ho gaya.`,
      href: "/admin/stock-count",
    });
  }

  // ---- Wo nuqsan jo "khareed" ke andar chhupa hua hai ----
  // Ye raqam ghayab nahi -- wo kharch ho chuki hai aur ledger mein
  // maujood hai. Masla ye hai ke wo khareed ke andar hai, jahan aam
  // lagat jaisi nazar aati hai. Fi litre kharcha thora zyada dikhta hai
  // aur koi ye nahi poochh sakta ke kyun -- kyunki kami ka apna koi
  // khana nahi.
  const qtyReport = await quantityReport({ month: now.getMonth() + 1, year: now.getFullYear() });
  if (qtyReport.hiddenLossValue > 0) {
    const worst = qtyReport.streams
      .filter((s) => s.canBook && !s.booked && s.gapValue > 0)
      .sort((a, b) => b.gapValue - a.gapValue)[0];

    alerts.push({
      tone: qtyReport.hiddenLossValue >= 10000 ? "red" : "amber",
      title: `Rs ${Math.round(qtyReport.hiddenLossValue).toLocaleString()} ka nuqsan khareed ke andar chhupa hua hai`,
      detail: worst
        ? `Sab se bara: ${worst.label} — ${Math.abs(worst.gap)} ${worst.unit} ka farq. Alag khane mein daalne se kul kharcha nahi badalta, magar nuqsan nazar aane lagta hai.`
        : "Alag khane mein daalne se kul kharcha nahi badalta, magar nuqsan nazar aane lagta hai.",
      href: "/admin/quantity-money",
    });
  }

  // ---- Roz ki jaanch ka nateeja ----
  // Ye alert baqi sab se pehle aata hai, kyunki ye un sab ka nichor hai.
  // Aur "jaanch hui hi nahi" ko khamoshi se nahi guzara jata: khamosh
  // safha "sab theek hai" ki tarah parha jata hai, jab ke us ka matlab
  // sirf itna hai ke kisi ne dekha hi nahi.
  const { data: lastRun } = await service
    .from("reconciliation_runs")
    .select("run_date, verdict, summary, checks_failed, checks_skipped")
    .order("run_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const todayStr = today();
  if (!lastRun) {
    alerts.push({
      tone: "amber",
      title: "Roz ka milaan abhi kabhi chala hi nahi",
      detail: "Jab tak jaanch nahi chalti, ye maloom nahi ho sakta ke sab theek hai ya nahi. Khamoshi tasalli nahi hoti.",
      href: "/admin/reconciliation",
    });
  } else if (lastRun.run_date !== todayStr) {
    alerts.push({
      tone: "amber",
      title: `Aaj ka milaan nahi hua — aakhri jaanch ${lastRun.run_date}`,
      detail: "Cron chala ya nahi, ye dekh lein. Jis din jaanch na ho us din ka nateeja maloom nahi hota.",
      href: "/admin/reconciliation",
    });
  } else if (lastRun.verdict !== "clean") {
    alerts.push({
      tone: lastRun.checks_failed > 0 ? "red" : "amber",
      title:
        lastRun.checks_failed > 0
          ? `Aaj ke milaan mein ${lastRun.checks_failed} masle nikle`
          : `Aaj ${lastRun.checks_skipped} jaanch chal hi nahi saki`,
      detail: lastRun.summary ?? "Tafseel ke liye milaan ka safha dekhein.",
      href: "/admin/reconciliation",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      tone: "green",
      title: "Filhal koi cheez tawajjah nahi mangti",
      detail: "Na koi kami ka nishan, na koi faisla atka hua.",
      href: "/admin/field-watch",
    });
  }

  return alerts;
}

/**
 * Nateeja -- aankron se, andaze se nahi.
 *
 * Ye jaan boojh kar AI ko nahi bheja jata. Aankre pehle se maujood hain
 * aur un se seedha nateeja nikalta hai; beech mein AI daalne se sirf ye
 * khatra barhta hai ke wo koi aisi baat keh de jo aankron mein hai hi
 * nahi. Dashboard par likhi baat par faisla hota hai, is liye us ka har
 * lafz kisi khane se nikalna chahiye.
 *
 * Tarteeb bhi maayne rakhti hai: pehle wo baatein jo GHALAT PARHI JA
 * SAKTI HAIN (adhoora hisaab, godam mein para maal), phir moqabla, phir
 * ruka hua kaam. Agar adhoore hisaab ki baat neeche chali jaye to
 * upar wala moqabla poora sach lagne lagta hai.
 */
export function conclude(depts: DeptKpi[], lang: Lang = "rm"): string[] {
  const lines: string[] = [];

  // 1. Jin ka hisaab adhoora hai -- ye sab se pehle, warna neeche wala
  //    moqabla poora sach lagta hai.
  for (const d of depts.filter((x) => x.state === "incomplete")) {
    lines.push(fill(t("cc_i_incomplete", lang), { dept: d.label, why: d.note ?? "" }));
  }

  // 2. Wo baat jo nuqsan lagti hai magar nuqsan hai nahi.
  for (const d of depts.filter((x) => x.state === "ok" && x.note && x.key === "grain")) {
    if ((d.profit ?? 0) <= 0 && d.note) lines.push(fill(t("cc_i_note", lang), { dept: d.label, why: d.note }));
  }

  // 3. Moqabla -- sirf un mein jin ka hisaab poora hai aur jinhon ne
  //    is mahine waqai kuch kamaya.
  const withProfit = depts.filter((d) => d.state === "ok" && d.profit != null && (d.revenue ?? 0) > 0);
  if (withProfit.length === 0) {
    lines.push(t("cc_i_too_early", lang));
  } else {
    const sorted = [...withProfit].sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    lines.push(
      fill(t("cc_i_best", lang), {
        dept: best.label,
        profit: `Rs ${Math.round(best.profit ?? 0).toLocaleString()}`,
        revenue: `Rs ${Math.round(best.revenue ?? 0).toLocaleString()}`,
        margin: best.margin != null ? ` (${best.margin.toFixed(1)}%)` : "",
      })
    );

    if (sorted.length > 1 && worst.key !== best.key) {
      lines.push(
        fill(t("cc_i_worst", lang), {
          dept: worst.label,
          margin: worst.margin != null ? `${worst.margin.toFixed(1)}%` : "—",
          cost: `Rs ${Math.round((worst.directCost ?? 0) + (worst.otherExpense ?? 0)).toLocaleString()}`,
        })
      );
    }
  }

  // 4. Ruka hua kaam -- wajah ke sath, sirf adad nahi.
  for (const d of depts.filter((x) => x.pending > 0 && x.pendingReason)) {
    lines.push(fill(t("cc_i_pending", lang), { dept: d.label, why: d.pendingReason ?? "" }));
  }

  return lines;
}
