import { createServiceClient } from "@/lib/supabase/service";
import {
  type InsightFilters,
  type ItemRow,
  type Kpis,
  type Point,
  type Ranked,
  type SaleRow,
  addDays,
  bucketize,
  computeKpis,
  donutSlices,
  pktDayStartIso,

  rankBy,
  sparkSeries,
  timeframeWindow,
  topBottom,
  visibleCategories,
} from "@/lib/command-center-insights-core";

/**
 * Owner Command Center ke NAYE hisson ka data (dashboard upgrade).
 *
 * - Sirf owner/admin ka safha isay bulata hai (page par role check pehle).
 * - Service client sirf server par; sirf zaroori columns, page-by-page.
 * - Live par koi likhai nahi -- sirf parhna.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any };
const PAGE = 1000;
const MAX_ROWS = 50000;

async function pageAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; off < MAX_ROWS; off += PAGE) {
    const { data, error } = await build(off, off + PAGE - 1);
    if (error || !data) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

export interface InsightsData {
  filters: InsightFilters;
  shops: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  kpis: Kpis;
  spark: { sales: number[]; orders: number[]; customers: number[]; profit: number[]; qty: number[]; margin: number[] };
  trend: Point[];
  feed: { id: string; at: string; shop: string; mode: string; amount: number; customer: string | null }[];
  donut: { name: string; amount: number }[];
  perShop: { id: string; name: string; amount: number; bills: number }[];
  udhaar: { id: string; name: string; balance: number }[];
  udhaarTotal: number;
  top10: Ranked[];
  bottom5: Ranked[];
  byMonth: { key: string; label: string; amount: number; profit: number }[];
  catTable: Ranked[];
  milk: { liters: number; entries: number } | null;
  grain: { kg: number; amount: number; entries: number; stockKg: number | null } | null;
}

export async function loadInsights(filters: InsightFilters, shops: { id: string; name: string }[]): Promise<InsightsData> {
  const db = createServiceClient() as unknown as Db;
  const nowMs = Date.now();
  const tfWin = timeframeWindow(filters.tf, nowMs);
  const fromIso = pktDayStartIso(filters.from);
  const toIso = pktDayStartIso(addDays(filters.to, 1));
  const yearStartIso = timeframeWindow("1y", nowMs).startIso;
  // Ek hi dafa parho: filter range + trend window + 12 mahine (sab ka sab se pehla din).
  const windowStart = [fromIso, tfWin.startIso, yearStartIso].sort()[0];

  const shopScope = <Q extends { eq: (c: string, v: string) => Q }>(q: Q) => (filters.shopId ? q.eq("shop_id", filters.shopId) : q);

  const [salesAll, cats, allowed, feedRes, udhaarRes, milkRows, grainRows, grainStock] = await Promise.all([
    pageAll<SaleRow>((a, b) =>
      shopScope(db.from("pos_sales").select("id,total_amount,profit,created_at,shop_id,customer_id,crm_customer_id").neq("status", "returned").gte("created_at", windowStart))
        .order("created_at", { ascending: true })
        .range(a, b),
    ),
    db.from("categories").select("id,name").order("name"),
    filters.shopId ? db.from("shop_allowed_categories").select("category_id,include").eq("shop_id", filters.shopId) : Promise.resolve({ data: [] }),
    shopScope(db.from("pos_sales").select("id,created_at,shop_id,payment_mode,total_amount,customer_id")).order("created_at", { ascending: false }).limit(8),
    shopScope(db.from("customers").select("id,name,current_balance").not("is_deleted", "is", true).gt("current_balance", 0)).order("current_balance", { ascending: false }).limit(500),
    db.from("milk_entries").select("quantity_liters").neq("status", "rejected").gte("entry_date", filters.from).lte("entry_date", filters.to).limit(MAX_ROWS),
    db.from("grain_procurement_entries").select("weight_kg,total_amount").gte("entry_date", filters.from).lte("entry_date", filters.to).limit(MAX_ROWS),
    db.from("v_grain_warehouse_stock").select("maujood_kg"),
  ]);

  // Items: sirf un bills ke jo window mein hain (sale_id ke tukron mein).
  const saleIds = salesAll.map((s) => s.id);
  const items: ItemRow[] = [];
  for (let i = 0; i < saleIds.length; i += 300) {
    const chunk = saleIds.slice(i, i + 300);
    const rows = await pageAll<ItemRow>((a, b) => db.from("pos_sale_items").select("sale_id,product_id,quantity,subtotal,line_cogs,unit_cost").in("sale_id", chunk).range(a, b));
    items.push(...rows);
  }
  const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean) as string[])];
  const products = new Map<string, { name: string; category_id: string | null }>();
  for (let i = 0; i < productIds.length; i += 300) {
    const { data } = await db.from("products").select("id,name,category_id").in("id", productIds.slice(i, i + 300));
    for (const p of (data ?? []) as { id: string; name: string; category_id: string | null }[]) products.set(p.id, p);
  }
  const catList = ((cats.data ?? []) as { id: string; name: string }[]).map((c) => ({ id: c.id, name: c.name }));
  const catName = new Map(catList.map((c) => [c.id, c.name]));
  const categoryOf = (pid: string | null) => (pid ? products.get(pid)?.category_id ?? null : null);

  // Shop ki category ki ijazat (686) -- us ke bahar ki category chunni na ja sake.
  const allowedIds = ((allowed.data ?? []) as { category_id: string; include: boolean }[]).filter((r) => r.include).map((r) => r.category_id);
  const categories = visibleCategories(catList, filters.shopId ? allowedIds : null);
  const categoryId = filters.categoryId && categories.some((c) => c.id === filters.categoryId) ? filters.categoryId : null;
  const f: InsightFilters = { ...filters, categoryId };

  const inRange = (ts: string) => ts >= fromIso && ts < toIso;
  const rangeSales = salesAll.filter((s) => inRange(s.created_at));
  const rangeSaleIds = new Set(rangeSales.map((s) => s.id));
  const saleById = new Map(salesAll.map((s) => [s.id, s]));
  const rangeItems = items.filter((i) => rangeSaleIds.has(i.sale_id));
  const catItems = (xs: ItemRow[]) => (categoryId ? xs.filter((i) => categoryOf(i.product_id) === categoryId) : xs);

  const kpis = computeKpis(rangeSales, rangeItems, categoryOf, categoryId);

  // Sparklines (filter range ke 10 hisse).
  const lineRows = catItems(rangeItems).map((i) => ({ i, ts: saleById.get(i.sale_id)!.created_at }));
  const salesRows = categoryId ? lineRows.map((r) => ({ ts: r.ts, value: Number(r.i.subtotal) || 0 })) : rangeSales.map((s) => ({ ts: s.created_at, value: Number(s.total_amount) || 0 }));
  const profitRows = categoryId
    ? lineRows.map((r) => ({ ts: r.ts, value: (Number(r.i.subtotal) || 0) - (Number(r.i.line_cogs) || 0) }))
    : rangeSales.map((s) => ({ ts: s.created_at, value: Number(s.profit) || 0 }));
  const billTs = [...new Set(lineRows.map((r) => r.i.sale_id))].map((id) => saleById.get(id)!.created_at);
  const ordersRows = (categoryId ? billTs : rangeSales.map((s) => s.created_at)).map((ts) => ({ ts, value: 1 }));
  const sp = (rows: { ts: string; value: number }[]) => sparkSeries(rows, fromIso, toIso);
  const sSales = sp(salesRows);
  const sProfit = sp(profitRows);
  const spark = {
    sales: sSales,
    orders: sp(ordersRows),
    customers: sp(ordersRows),
    profit: sProfit,
    qty: sp(lineRows.map((r) => ({ ts: r.ts, value: Number(r.i.quantity) || 0 }))),
    margin: sSales.map((v, i) => (v > 0 ? (sProfit[i] / v) * 100 : 0)),
  };

  // Trend (timeframe toggle) -- shop + category filter ke saath.
  const trendRows = categoryId
    ? catItems(items).map((i) => ({ ts: saleById.get(i.sale_id)!.created_at, amount: Number(i.subtotal) || 0 }))
    : salesAll.map((s) => ({ ts: s.created_at, amount: Number(s.total_amount) || 0 }));
  const trend = bucketize(tfWin.buckets, tfWin.bucketOf, trendRows.filter((r) => r.ts >= tfWin.startIso));

  // Mahine ke hisaab se (12 mahine).
  const yWin = timeframeWindow("1y", nowMs);
  const mAmt = bucketize(yWin.buckets, yWin.bucketOf, trendRows);
  const mProfit = bucketize(
    yWin.buckets,
    yWin.bucketOf,
    categoryId
      ? catItems(items).map((i) => ({ ts: saleById.get(i.sale_id)!.created_at, amount: (Number(i.subtotal) || 0) - (Number(i.line_cogs) || 0) }))
      : salesAll.map((s) => ({ ts: s.created_at, amount: Number(s.profit) || 0 })),
  );
  const byMonth = mAmt.map((m, i) => ({ key: m.key, label: m.label, amount: m.amount, profit: mProfit[i].amount }));

  // Products / categories.
  const ranked = rankBy(catItems(rangeItems), (i) => i.product_id, (k) => products.get(k)?.name ?? "—");
  const tb = topBottom(ranked, 10, 5);
  const catTable = rankBy(rangeItems, (i) => categoryOf(i.product_id), (k) => catName.get(k) ?? "—");

  // Har dukan (sab 5) -- shop filter ke baghair, taa ke muqabla nazar aaye.
  let shopSales = rangeSales;
  let shopItems = rangeItems;
  if (filters.shopId) {
    shopSales = await pageAll<SaleRow>((a, b) =>
      db.from("pos_sales").select("id,total_amount,profit,created_at,shop_id,customer_id,crm_customer_id").neq("status", "returned").gte("created_at", fromIso).lt("created_at", toIso).range(a, b),
    );
    shopItems = [];
    if (categoryId) {
      const ids = shopSales.map((s) => s.id);
      for (let i = 0; i < ids.length; i += 300) {
        shopItems.push(...(await pageAll<ItemRow>((a, b) => db.from("pos_sale_items").select("sale_id,product_id,quantity,subtotal,line_cogs,unit_cost").in("sale_id", ids.slice(i, i + 300)).range(a, b))));
      }
      for (const pid of shopItems.map((x) => x.product_id)) if (pid && !products.has(pid)) products.set(pid, { name: "—", category_id: null });
    }
  }
  const shopOf = new Map(shopSales.map((s) => [s.id, s.shop_id]));
  const perShop = shops.map((sh) => {
    if (categoryId) {
      const ls = shopItems.filter((i) => shopOf.get(i.sale_id) === sh.id && categoryOf(i.product_id) === categoryId);
      return { id: sh.id, name: sh.name, amount: ls.reduce((a, i) => a + (Number(i.subtotal) || 0), 0), bills: new Set(ls.map((i) => i.sale_id)).size };
    }
    const ss = shopSales.filter((s) => s.shop_id === sh.id);
    return { id: sh.id, name: sh.name, amount: ss.reduce((a, s) => a + (Number(s.total_amount) || 0), 0), bills: ss.length };
  }).sort((a, b) => b.amount - a.amount);

  // Feed.
  const shopName = new Map(shops.map((s) => [s.id, s.name]));
  const feedRows = (feedRes.data ?? []) as { id: string; created_at: string; shop_id: string | null; payment_mode: string | null; total_amount: number | null; customer_id: string | null }[];
  const custIds = [...new Set(feedRows.map((r) => r.customer_id).filter(Boolean) as string[])];
  const custName = new Map<string, string>();
  if (custIds.length) {
    const { data } = await db.from("customers").select("id,name").in("id", custIds);
    for (const c of (data ?? []) as { id: string; name: string }[]) custName.set(c.id, c.name);
  }
  const feed = feedRows.map((r) => ({
    id: r.id,
    at: r.created_at,
    shop: (r.shop_id && shopName.get(r.shop_id)) || "—",
    mode: r.payment_mode ?? "—",
    amount: Number(r.total_amount) || 0,
    customer: r.customer_id ? custName.get(r.customer_id) ?? null : null,
  }));

  const udhaarAll = ((udhaarRes.data ?? []) as { id: string; name: string; current_balance: number }[]).map((c) => ({ id: c.id, name: c.name, balance: Number(c.current_balance) || 0 }));
  const milkList = (milkRows.data ?? []) as { quantity_liters: number | null }[];
  const grainList = (grainRows.data ?? []) as { weight_kg: number | null; total_amount: number | null }[];
  const stockList = (grainStock.data ?? []) as { maujood_kg: number | null }[];

  return {
    filters: f,
    shops,
    categories,
    kpis,
    spark,
    trend,
    feed,
    donut: donutSlices(categoryId ? catTable.filter((c) => c.id === categoryId) : catTable),
    perShop,
    udhaar: udhaarAll.slice(0, 6),
    udhaarTotal: udhaarAll.reduce((a, c) => a + c.balance, 0),
    top10: tb.top,
    bottom5: tb.bottom,
    byMonth,
    catTable: categoryId ? catTable.filter((c) => c.id === categoryId) : catTable,
    milk: milkList.length ? { liters: milkList.reduce((a, r) => a + (Number(r.quantity_liters) || 0), 0), entries: milkList.length } : null,
    grain: grainList.length || stockList.length
      ? {
          kg: grainList.reduce((a, r) => a + (Number(r.weight_kg) || 0), 0),
          amount: grainList.reduce((a, r) => a + (Number(r.total_amount) || 0), 0),
          entries: grainList.length,
          stockKg: stockList.length ? stockList.reduce((a, r) => a + (Number(r.maujood_kg) || 0), 0) : null,
        }
      : null,
  };
}
