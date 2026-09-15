import { createServiceClient } from "@/lib/supabase/service";

/**
 * Fi litre kharcha -- doodh ke karobar ka sab se ahem adad.
 *
 * Doodh ka rate to farmer ko diya jata hai, magar asal sawal ye hai ke
 * us litre ko chiller tak lane aur thanda rakhne mein aur KITNA lagta
 * hai. Ye adad na ho to munafa hamesha asal se zyada nazar aata hai --
 * kyunke tankhwah, petrol, marammat, kiraya aur bijli sab kisi aur
 * khane mein pare rehte hain.
 *
 * Yahan har khana asal jagah se aata hai. Jo cheez darj nahi hui, wo
 * SIFAR nahi -- wo "darj nahi hui" hai, aur ye baat safhe par saaf
 * likhi jati hai. Warna adhoora hisaab poore hisaab jaisa nazar aata
 * hai, aur wo sab se khatarnak soorat hoti hai.
 */

export interface CostLine {
  key: string;
  label: string;
  amount: number;
  /** Kitni entries se bana -- sifar ho to us ka matlab "darj nahi hua". */
  entries: number;
  source: string;
}

export interface CostSheet {
  month: number;
  year: number;
  liters: number;
  /** Farmer ko diya gaya doodh ka daam. */
  milkPurchase: number;
  lines: CostLine[];
  runningCost: number;
  totalCost: number;
  perLiterRunning: number | null;
  perLiterTotal: number | null;
  /** Wo khane jo bilkul khali hain -- inhein bharay baghair hisaab adhoora hai. */
  missing: string[];
}

function n(value: unknown): number {
  return Number(value ?? 0);
}

function sum<T extends Record<string, unknown>>(rows: T[] | null, column: keyof T): number {
  return (rows ?? []).reduce((total, row) => total + n(row[column]), 0);
}

export async function loadCostSheet(month: number, year: number, branchId: string | null): Promise<CostSheet> {
  const service = createServiceClient();
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = new Date(year, month, 0).toISOString().slice(0, 10);

  const scoped = <T extends { eq: (c: string, v: string) => T }>(q: T, column = "branch_id") =>
    branchId ? q.eq(column, branchId) : q;

  const [
    { data: milk },
    { data: fuel },
    { data: maintenance },
    { data: generator },
    { data: bills },
    { data: salaries },
    { data: other },
  ] = await Promise.all([
    scoped(
      service
        .from("milk_entries")
        .select("quantity_liters, total_amount")
        .gte("entry_date", start)
        .lte("entry_date", end)
        .neq("status", "rejected")
    ),
    // Petrol: gaari ka rozana log hi asal khana hai.
    service
      .from("vehicle_daily_logs")
      .select("fuel_amount, branch_id")
      .gte("log_date", start)
      .lte("log_date", end),
    // Sirf MANZOOR SHUDA maintenance. Jo abhi faisle ke intezar mein hai
    // wo kharche mein nahi ginta -- warna mahine ka hisaab har roz
    // badalta rehta.
    service
      .from("maintenance_logs")
      .select("cost, branch_id")
      .eq("status", "approved")
      .gte("service_date", start)
      .lte("service_date", end),
    service
      .from("generator_logs")
      .select("diesel_cost, electricity_units, hours_run, branch_id")
      .gte("log_date", start)
      .lte("log_date", end),
    // Chiller ki bijli aur dukan ka kiraya -- dono shop_bills mein.
    service
      .from("shop_bills")
      .select("amount, bill_type, branch_id")
      .eq("bill_month", month)
      .eq("bill_year", year),
    service
      .from("salary_payments")
      .select("net_salary")
      .eq("pay_month", month)
      .eq("pay_year", year),
    service
      .from("monthly_expenses")
      .select("amount, category, branch_id")
      .eq("expense_month", month)
      .eq("expense_year", year),
  ]);

  const byBranch = <T extends { branch_id?: string | null }>(rows: T[] | null) =>
    branchId ? (rows ?? []).filter((r) => r.branch_id === branchId) : (rows ?? []);

  const liters = sum(milk, "quantity_liters");
  const milkPurchase = sum(milk, "total_amount");

  const fuelRows = byBranch(fuel);
  const maintRows = byBranch(maintenance);
  const genRows = byBranch(generator);
  const billRows = byBranch(bills);
  const otherRows = byBranch(other);

  const electricity = billRows.filter((b) => (b.bill_type ?? "").toLowerCase().includes("electric"));
  const rent = billRows.filter((b) => (b.bill_type ?? "").toLowerCase().includes("rent"));
  const otherBills = billRows.filter((b) => !electricity.includes(b) && !rent.includes(b));

  const lines: CostLine[] = [
    {
      key: "salaries",
      label: "Tankhwahein",
      amount: sum(salaries, "net_salary"),
      entries: (salaries ?? []).length,
      source: "HR — is mahine ki tankhwah",
    },
    {
      key: "fuel",
      label: "Petrol / Diesel (gaari)",
      amount: sum(fuelRows, "fuel_amount"),
      entries: fuelRows.filter((r) => n(r.fuel_amount) > 0).length,
      source: "Gaari ka rozana log",
    },
    {
      key: "maintenance",
      label: "Gaari ki marammat aur oil",
      amount: sum(maintRows, "cost"),
      entries: maintRows.length,
      source: "Maintenance — sirf manzoor shuda",
    },
    {
      key: "generator",
      label: "Generator ka diesel",
      amount: sum(genRows, "diesel_cost"),
      entries: genRows.length,
      source: "Generator ka log (reading ke hisab se)",
    },
    {
      key: "electricity",
      label: "Chiller ki bijli",
      amount: sum(electricity, "amount"),
      entries: electricity.length,
      source: "Shop Bills — bijli",
    },
    {
      key: "rent",
      label: "Kiraya",
      amount: sum(rent, "amount"),
      entries: rent.length,
      source: "Shop Bills — kiraya",
    },
    {
      key: "other_bills",
      label: "Deegar bill",
      amount: sum(otherBills, "amount"),
      entries: otherBills.length,
      source: "Shop Bills",
    },
    {
      key: "other",
      label: "Deegar mahana kharche",
      amount: sum(otherRows, "amount"),
      entries: otherRows.length,
      source: "Monthly Expenses",
    },
  ];

  const runningCost = lines.reduce((total, line) => total + line.amount, 0);
  const totalCost = runningCost + milkPurchase;

  return {
    month,
    year,
    liters,
    milkPurchase,
    lines,
    runningCost,
    totalCost,
    perLiterRunning: liters > 0 ? runningCost / liters : null,
    perLiterTotal: liters > 0 ? totalCost / liters : null,
    missing: lines.filter((l) => l.entries === 0).map((l) => l.label),
  };
}
