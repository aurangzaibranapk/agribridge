import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createClient>;

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function number(v: unknown) {
  return Number(v ?? 0);
}

export async function getCategorySales(supabase: SupabaseClient, days = 30) {
  const db = supabase as any;
  const { data, error } = await db
    .from("v_ai_sales_category")
    .select("category_name, units_sold, sales_amount, invoice_count, sale_date")
    .gte("sale_date", isoDaysAgo(days).slice(0, 10));
  if (error) return { error: error.message, periodDays: days, categories: [] };

  const totals = new Map<string, { category: string; units: number; sales: number; invoices: number }>();
  for (const row of data ?? []) {
    const category = String(row.category_name ?? "Uncategorized");
    const existing = totals.get(category) ?? { category, units: 0, sales: 0, invoices: 0 };
    existing.units += number(row.units_sold);
    existing.sales += number(row.sales_amount);
    existing.invoices += number(row.invoice_count);
    totals.set(category, existing);
  }
  return {
    periodDays: days,
    categories: [...totals.values()].sort((a, b) => b.sales - a.sales),
    currency: "PKR",
  };
}

export async function getStaffSalesPerformance(supabase: SupabaseClient, days = 30) {
  const db = supabase as any;
  const { data, error } = await db
    .from("v_ai_staff_sales_daily")
    .select("staff_id, staff_name, sales_amount, invoice_count, sale_date")
    .gte("sale_date", isoDaysAgo(days).slice(0, 10));
  if (error) return { error: error.message, periodDays: days, staff: [] };

  const totals = new Map<string, { staffId: string | null; staffName: string; sales: number; invoices: number; activeDays: number }>();
  for (const row of data ?? []) {
    const key = String(row.staff_id ?? "unknown");
    const existing = totals.get(key) ?? {
      staffId: row.staff_id ?? null,
      staffName: String(row.staff_name ?? "Unknown staff"),
      sales: 0,
      invoices: 0,
      activeDays: 0,
    };
    existing.sales += number(row.sales_amount);
    existing.invoices += number(row.invoice_count);
    existing.activeDays += 1;
    totals.set(key, existing);
  }
  return {
    periodDays: days,
    staff: [...totals.values()]
      .sort((a, b) => b.sales - a.sales)
      .map((row, index) => ({ rank: index + 1, ...row })),
    currency: "PKR",
  };
}

export async function getDemandForecast(supabase: SupabaseClient, days = 30) {
  const horizon = Math.max(1, Math.min(90, Number(days) || 30));
  const { data, error } = await supabase
    .from("v_reorder_suggestions")
    .select("product_id, name, pack_size, sold_30, sold_7, on_hand, daily_rate, days_cover, suggested_qty, urgency, last_supplier_name")
    .order("suggested_qty", { ascending: false })
    .limit(100);
  if (error) return { error: error.message, horizonDays: horizon, products: [] };

  return {
    horizonDays: horizon,
    products: (data ?? []).map((row: any) => ({
      productId: row.product_id,
      name: row.name,
      packSize: row.pack_size,
      currentStock: number(row.on_hand),
      dailyRate: number(row.daily_rate),
      forecastUnits: Math.ceil(number(row.daily_rate) * horizon),
      daysCover: row.days_cover == null ? null : number(row.days_cover),
      suggestedOrder: number(row.suggested_qty),
      urgency: row.urgency,
      supplier: row.last_supplier_name ?? null,
    })),
    currency: "PKR",
    note: "Forecast verified POS velocity aur current stock par based hai; seasonality aur supplier-specific lead time abhi configured nahi.",
  };
}

export async function getBusinessIntelligenceReport(supabase: SupabaseClient, days = 30) {
  const [categories, staff, forecast] = await Promise.all([
    getCategorySales(supabase, days),
    getStaffSalesPerformance(supabase, days),
    getDemandForecast(supabase, days),
  ]);
  return {
    periodDays: days,
    categorySales: categories.categories,
    staffPerformance: staff.staff,
    demandForecast: forecast.products.slice(0, 20),
    currency: "PKR",
    dataQuality: {
      categorySales: !categories.error,
      staffPerformance: !staff.error,
      demandForecast: !forecast.error,
    },
  };
}
