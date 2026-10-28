import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { todayPk } from "@/lib/finance-dash/load";
import { addMonths, computeSupplyChain, isValidMonth, type ScFilters, type ScInput } from "./compute";

/** Poori company ka khareed/stock data -- sirf company-level roles (branch manager ko nahi, warna doosri branches dikh jayein). */
export const SUPPLY_CHAIN_ROLES = ["owner", "super_admin", "admin", "finance", "procurement", "warehouse"];

export async function canSeeSupplyChain(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  return Boolean(me?.is_active && SUPPLY_CHAIN_ROLES.includes(me.role as string));
}

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
async function all<T>(fetchPage: (from: number, to: number) => Page<T>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await fetchPage(i, i + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}
/** Column/table abhi nahi (migration 692 Live par baqi) -- is error ko pehchanna. */
export function isMissingSchema(msg: string | undefined | null, name: string): boolean {
  if (!msg) return false;
  return msg.includes(name) && /does not exist|could not find|schema cache/i.test(msg);
}

export async function loadSupplyChain(filters: ScFilters) {
  const sb = createServiceClient() as any;
  const today = todayPk();
  const endMonth = isValidMonth(filters.month) ? filters.month : today.slice(0, 7);
  // 12 mahine ka trend + pichle muddat ka muqabla = 24 mahine.
  const since = `${addMonths(endMonth, -23)}-01`;

  const PCOLS = "id, purchase_number, purchase_date, received_at, branch_id, supplier_id, status, total_amount";
  let hasExpectedDate = true;
  let purchases: any[];
  try {
    purchases = await all<any>((a, b) => sb.from("purchases").select(PCOLS + ", expected_date").gte("purchase_date", since).order("id").range(a, b));
  } catch (e) {
    if (!isMissingSchema((e as Error).message, "expected_date")) throw e;
    hasExpectedDate = false;
    purchases = (await all<any>((a, b) => sb.from("purchases").select(PCOLS).gte("purchase_date", since).order("id").range(a, b))).map((p) => ({ ...p, expected_date: null }));
  }
  const ids = purchases.map((p) => p.id as string);
  const items: any[] = [];
  let costs: any[] = [];
  let hasCosts = true;
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    items.push(...(await all<any>((a, b) => sb.from("purchase_items").select("purchase_id, product_id, quantity, received_qty, short_qty, damaged_qty").in("purchase_id", chunk).order("id").range(a, b))));
    if (hasCosts) {
      try {
        costs.push(...(await all<any>((a, b) => sb.from("purchase_costs").select("purchase_id, cost_type, amount").in("purchase_id", chunk).order("id").range(a, b))));
      } catch (e) {
        if (!isMissingSchema((e as Error).message, "purchase_costs")) throw e;
        hasCosts = false;
        costs = [];
      }
    }
  }
  if (!ids.length) {
    const probe = await sb.from("purchase_costs").select("id").limit(1);
    if (probe.error && isMissingSchema(probe.error.message, "purchase_costs")) hasCosts = false;
  }

  const products = (await all<any>((a, b) => sb.from("products").select("id, name, category_id, min_stock_threshold, purchase_price, is_deleted").order("id").range(a, b))).filter((p) => !p.is_deleted);
  const warehouses = await all<any>((a, b) => sb.from("warehouses").select("id, branch_id").order("id").range(a, b));
  const whIds = new Set(warehouses.filter((w) => !filters.branch || w.branch_id === filters.branch).map((w) => w.id));
  const inv = await all<any>((a, b) => sb.from("inventory").select("product_id, warehouse_id, quantity_on_hand").order("id").range(a, b));
  const stockByProduct: Record<string, number> = {};
  for (const r of inv) {
    if (!whIds.has(r.warehouse_id)) continue;
    stockByProduct[r.product_id] = (stockByProduct[r.product_id] ?? 0) + Number(r.quantity_on_hand ?? 0);
  }

  // Biki hui maal ki laagat (COGS) mahina-war -- gardish ke liye.
  const cogsByMonth: Record<string, number> = {};
  const salesSince = `${addMonths(endMonth, -11)}-01`;
  const sales = await all<any>((a, b) => {
    let q = sb.from("sales").select("id, sale_date, branch_id, total_purchase_value").eq("status", "confirmed").gte("sale_date", salesSince);
    if (filters.branch) q = q.eq("branch_id", filters.branch);
    return q.order("id").range(a, b);
  });
  if (!filters.category) {
    for (const s of sales) {
      const k = String(s.sale_date).slice(0, 7);
      cogsByMonth[k] = (cogsByMonth[k] ?? 0) + Number(s.total_purchase_value ?? 0);
    }
  } else {
    const catProducts = new Set(products.filter((p) => p.category_id === filters.category).map((p) => p.id));
    const monthOf = new Map(sales.map((s) => [s.id as string, String(s.sale_date).slice(0, 7)]));
    const sids = sales.map((s) => s.id as string);
    for (let i = 0; i < sids.length; i += 200) {
      const chunk = sids.slice(i, i + 200);
      const lines = await all<any>((a, b) => sb.from("sale_items").select("sale_id, product_id, line_purchase_value").in("sale_id", chunk).order("id").range(a, b));
      for (const l of lines) {
        if (!catProducts.has(l.product_id)) continue;
        const k = monthOf.get(l.sale_id) as string;
        cogsByMonth[k] = (cogsByMonth[k] ?? 0) + Number(l.line_purchase_value ?? 0);
      }
    }
  }

  const [sup, br, cat] = await Promise.all([
    all<any>((a, b) => sb.from("suppliers").select("id, name, is_active").order("name").range(a, b)),
    all<any>((a, b) => sb.from("branches").select("id, name, is_active").order("name").range(a, b)),
    all<any>((a, b) => sb.from("categories").select("id, name").order("name").range(a, b)),
  ]);
  const toMap = (rows: any[]) => Object.fromEntries(rows.map((r) => [r.id, r.name])) as Record<string, string>;

  const input: ScInput = {
    today, filters, purchases, items, products, stockByProduct, costs, cogsByMonth,
    names: { suppliers: toMap(sup), branches: toMap(br), categories: toMap(cat) },
    hasExpectedDate, hasCosts,
  };
  return {
    result: computeSupplyChain(input),
    options: {
      branches: br.filter((b) => b.is_active !== false).map((b) => ({ id: b.id as string, name: b.name as string })),
      suppliers: sup.filter((s) => s.is_active !== false).map((s) => ({ id: s.id as string, name: s.name as string })),
      categories: cat.map((c) => ({ id: c.id as string, name: c.name as string })),
    },
  };
}
