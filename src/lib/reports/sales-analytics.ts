import { groupForCategory } from "@/lib/demand/categories";
import { pktDayKey, pktMidnight } from "@/lib/reports/sales-period";

/**
 * Aaj ka sales dashboard.
 *
 * Adad pos_sales / pos_sale_items / products / categories / inventory se.
 * Koi sample number nahi. Query fail ho to sifar nahi — caller error dikhata hai.
 * Munafa tab hi jab cost darj ho. Bina cost ke "—" , Rs 0 nahi.
 */

export const SALE_BUCKETS = ["khaad", "beej", "doodh", "karyana"] as const;
export type SaleBucket = (typeof SALE_BUCKETS)[number] | "aur";

export type CatNode = { id: string; name: string; parent_category_id: string | null };

export function walkCategory(categoryId: string | null, byId: Map<string, CatNode>): { root: string | null; own: string | null } {
  if (!categoryId) return { root: null, own: null };
  let cur = byId.get(categoryId);
  const own = cur?.name ?? null;
  for (let i = 0; cur?.parent_category_id && i < 6; i++) {
    const next = byId.get(cur.parent_category_id);
    if (!next) break;
    cur = next;
  }
  return { root: cur?.name ?? own, own };
}

/** Khaad / Beej / Doodh / Karyana. Dairy feed doodh nahi. Jo in mein na aaye wo "aur". */
export function saleBucket(rootName: string | null, ownName: string | null, productName: string): SaleBucket {
  const blob = `${rootName ?? ""} ${ownName ?? ""} ${productName}`.toLowerCase();
  if (/dairy feed|animal feed|wanda/.test(blob)) {
    // feed neeche group mein jati hai, doodh ki bar mein nahi
  } else if (/doodh|dairy|milk|دودھ/.test(blob)) {
    return "doodh";
  }
  const group = groupForCategory(rootName, null);
  if (group === "fertilizer" || /fertili|khaad|کھاد/.test(blob)) return "khaad";
  if (group === "seed" || /\bseed\b|beej|بیج/.test(blob)) return "beej";
  if (group === "karyana" || /grocery|karyana|کریانہ/.test(blob)) return "karyana";
  return "aur";
}

export function saleProfit(row: { profit: number | null; total_amount: number; total_cogs: number | null }): number | null {
  if (row.profit != null && Number.isFinite(Number(row.profit))) return Number(row.profit);
  if (row.total_cogs != null && Number.isFinite(Number(row.total_cogs))) return Number(row.total_amount) - Number(row.total_cogs);
  return null;
}

export type SaleRow = { id: string; total_amount: number; profit?: number | null; total_cogs?: number | null };
export type ItemRow = { sale_id: string; product_id: string; subtotal: number };
export type ProductMeta = { id: string; name: string; category_id: string | null; unit: string | null; pack_size: string | null; min_stock_threshold: number | null };

export type AnalyticsNumbers = {
  total: number;
  orders: number;
  /** null = cost darj nahi, ya dekhne ki ijazat nahi */
  munafa: number | null;
  munafaGap: boolean;
  buckets: Record<SaleBucket, number>;
  itemTotal: number;
  linesMissing: boolean;
};

export function summarizeSales(sales: SaleRow[], items: ItemRow[], products: ProductMeta[], categories: CatNode[], showProfit: boolean): AnalyticsNumbers {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const productById = new Map(products.map((p) => [p.id, p]));
  const buckets: Record<SaleBucket, number> = { khaad: 0, beej: 0, doodh: 0, karyana: 0, aur: 0 };
  let itemTotal = 0;
  for (const item of items) {
    const sub = Number(item.subtotal) || 0;
    itemTotal += sub;
    const product = productById.get(item.product_id);
    const walked = walkCategory(product?.category_id ?? null, byId);
    const bucket = saleBucket(walked.root, walked.own, product?.name ?? "");
    buckets[bucket] += sub;
  }
  const profits = showProfit ? sales.map((s) => saleProfit({ profit: s.profit ?? null, total_amount: Number(s.total_amount) || 0, total_cogs: s.total_cogs ?? null })) : [];
  const known = profits.filter((p): p is number => p != null);
  const munafa = !showProfit ? null : sales.length === 0 ? 0 : known.length === 0 ? null : known.reduce((a, b) => a + b, 0);
  return {
    total: sales.reduce((s, r) => s + (Number(r.total_amount) || 0), 0),
    orders: sales.length,
    munafa,
    munafaGap: showProfit && sales.length > 0 && known.length < sales.length,
    buckets,
    itemTotal,
    linesMissing: sales.length > 0 && items.length === 0,
  };
}

export type LowStockRow = { id: string; name: string; qty: number; unitLabel: string; line: string };

export function unitShort(unit: string | null, pack: string | null): string {
  const raw = (unit || pack || "").trim();
  if (!raw) return "";
  if (/bori/i.test(raw)) return "bori";
  if (/bag/i.test(raw)) return "bag";
  if (/\bkg\b|kilo/i.test(raw)) return "kg";
  if (/lit/i.test(raw)) return "litre";
  return raw;
}

export function stockLine(name: string, qty: number, unit: string | null, pack: string | null): string {
  const n = Number.isInteger(qty) ? String(qty) : String(Math.round(qty * 100) / 100);
  const u = unitShort(unit, pack);
  return u ? `${name} — ${n} ${u}` : `${name} — ${n}`;
}

/** null tracked = hadd lagi hi nahi. Khali rows + tracked = hadd hai, koi cheez neeche nahi. */
export function lowStockList(products: ProductMeta[], qtyByProduct: Map<string, number>, limit = 8): { tracked: boolean; rows: LowStockRow[] } {
  const watched = products.filter((p) => Number(p.min_stock_threshold) > 0);
  if (watched.length === 0) return { tracked: false, rows: [] };
  const rows = watched
    .map((p) => {
      const qty = qtyByProduct.get(p.id) ?? 0;
      const min = Number(p.min_stock_threshold);
      return { p, qty, min };
    })
    .filter((r) => r.qty <= r.min)
    .sort((a, b) => a.qty / a.min - b.qty / b.min || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map((r) => ({
      id: r.p.id,
      name: r.p.name,
      qty: r.qty,
      unitLabel: unitShort(r.p.unit, r.p.pack_size),
      line: stockLine(r.p.name, r.qty, r.p.unit, r.p.pack_size),
    }));
  return { tracked: true, rows };
}

export function todayPktWindow(now = new Date()): { start: Date; end: Date; label: string } {
  const start = pktMidnight(now);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, label: pktDayKey(now) };
}

export function rsPlain(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const text = Number.isInteger(rounded)
    ? rounded.toLocaleString("en-PK")
    : rounded.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `Rs ${text}`;
}

type Sb = { from: (table: string) => any };

async function pageRange<T>(run: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; off < 20000; off += 1000) {
    const { data, error } = await run(off, off + 999);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export type AnalyticsLoad = {
  ok: true;
  label: string;
  shopNote: string | null;
  numbers: AnalyticsNumbers;
  low: { tracked: boolean; rows: LowStockRow[] } | null;
  lowMessage: string | null;
} | { ok: false; message: string };

export async function loadSalesAnalytics(
  supabase: Sb,
  opts: { shopId: string | null; showProfit: boolean; now?: Date },
): Promise<AnalyticsLoad> {
  const window = todayPktWindow(opts.now);
  try {
    const sales = await pageRange<SaleRow>((from, to) => {
      let q = supabase
        .from("pos_sales")
        .select(opts.showProfit ? "id, total_amount, profit, total_cogs, created_at" : "id, total_amount, created_at")
        .gte("created_at", window.start.toISOString())
        .lt("created_at", window.end.toISOString())
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
      if (opts.shopId) q = q.eq("shop_id", opts.shopId);
      return q;
    });

    const items: ItemRow[] = [];
    for (let i = 0; i < sales.length; i += 150) {
      const ids = sales.slice(i, i + 150).map((s) => s.id);
      const { data, error } = await supabase.from("pos_sale_items").select("sale_id, product_id, subtotal").in("sale_id", ids);
      if (error) throw new Error(error.message);
      items.push(...((data ?? []) as ItemRow[]));
    }

    const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
    const products: ProductMeta[] = [];
    for (let i = 0; i < productIds.length; i += 150) {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, category_id, unit, pack_size, min_stock_threshold")
        .in("id", productIds.slice(i, i + 150));
      if (error) throw new Error(error.message);
      products.push(...((data ?? []) as ProductMeta[]));
    }

    const { data: categories, error: catError } = await supabase.from("categories").select("id, name, parent_category_id");
    if (catError) throw new Error(catError.message);

    const numbers = summarizeSales(sales, items, products, (categories ?? []) as CatNode[], opts.showProfit);

    let low: { tracked: boolean; rows: LowStockRow[] } | null = null;
    let lowMessage: string | null = null;
    try {
      const watched = await pageRange<ProductMeta>((from, to) =>
        supabase
          .from("products")
          .select("id, name, category_id, unit, pack_size, min_stock_threshold")
          .eq("is_deleted", false)
          .gt("min_stock_threshold", 0)
          .order("id", { ascending: true })
          .range(from, to),
      );
      const qty = new Map<string, number>();
      const watchedIds = watched.map((p) => p.id);
      for (let i = 0; i < watchedIds.length; i += 150) {
        let inv = supabase.from("inventory").select("product_id, quantity_on_hand").in("product_id", watchedIds.slice(i, i + 150));
        if (opts.shopId) inv = inv.eq("shop_id", opts.shopId);
        const { data, error } = await inv;
        if (error) throw new Error(error.message);
        for (const row of (data ?? []) as { product_id: string; quantity_on_hand: number }[]) {
          qty.set(row.product_id, (qty.get(row.product_id) ?? 0) + Number(row.quantity_on_hand ?? 0));
        }
      }
      low = lowStockList(watched, qty);
    } catch (err) {
      low = null;
      lowMessage = err instanceof Error ? err.message : "Stock ka hisaab nahi mila";
    }

    return {
      ok: true,
      label: window.label,
      shopNote: opts.shopId,
      numbers,
      low,
      lowMessage,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Aaj ki bikri nahi mili" };
  }
}
