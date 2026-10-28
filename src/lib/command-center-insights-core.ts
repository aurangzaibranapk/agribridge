/**
 * Owner Command Center -- "NAYA" hisse (dashboard upgrade, Oct 2026).
 *
 * Sirf khalis (pure) hisaab yahan hai taa ke test ho sake. Database se
 * parhna `command-center-insights.ts` mein hai. Mojooda widgets ko ye
 * file chhooti bhi nahi -- sirf naye hisson ka hisaab.
 */

export type Timeframe = "live" | "aaj" | "7d" | "30d" | "1y";
export const TIMEFRAMES: Timeframe[] = ["live", "aaj", "7d", "30d", "1y"];

export interface InsightFilters {
  shopId: string | null;
  categoryId: string | null;
  from: string; // YYYY-MM-DD (PKT)
  to: string; // YYYY-MM-DD (PKT)
  tf: Timeframe;
}

const PKT_OFFSET_MS = 5 * 3600 * 1000;
const DAY = 86400000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UTC waqt -> Pakistan ki tareekh (YYYY-MM-DD). */
export function pktDate(ts: string | number | Date): string {
  const ms = new Date(ts).getTime() + PKT_OFFSET_MS;
  return new Date(ms).toISOString().slice(0, 10);
}
export function pktHour(ts: string | number | Date): number {
  return new Date(new Date(ts).getTime() + PKT_OFFSET_MS).getUTCHours();
}
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}
/** PKT din ki shuruat ka UTC ISO waqt. */
export function pktDayStartIso(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - PKT_OFFSET_MS).toISOString();
}

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** URL se filters -- ghalat qeemat ho to mehfooz default (pichle 30 din, sab dukanen). */
export function parseInsightFilters(
  sp: Record<string, string | string[] | undefined> | undefined,
  today: string,
  validShopIds: string[],
): InsightFilters {
  const shop = one(sp?.cc_shop);
  const cat = one(sp?.cc_cat);
  let from = one(sp?.cc_from);
  let to = one(sp?.cc_to);
  const tfRaw = one(sp?.cc_tf);
  if (!to || !DATE_RE.test(to) || to > today) to = today;
  if (!from || !DATE_RE.test(from) || from > to) from = addDays(to, -29);
  // Ek saal se lamba range nahi -- server par bojh na pare.
  if (Date.parse(to) - Date.parse(from) > 366 * DAY) from = addDays(to, -366);
  return {
    shopId: shop && validShopIds.includes(shop) ? shop : null,
    categoryId: cat && UUID_RE.test(cat) ? cat : null,
    from,
    to,
    tf: TIMEFRAMES.includes(tfRaw as Timeframe) ? (tfRaw as Timeframe) : "30d",
  };
}

export interface SaleRow {
  id: string;
  total_amount: number | null;
  profit: number | null;
  created_at: string;
  shop_id: string | null;
  customer_id: string | null;
  crm_customer_id: string | null;
}
export interface ItemRow {
  sale_id: string;
  product_id: string | null;
  quantity: number | null;
  subtotal: number | null;
  line_cogs: number | null;
  unit_cost: number | null;
}

const num = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** Item ki cost maloom hai? (cost 0/khali = adhoori, munafa zyada dikhega) */
export function itemHasCost(i: ItemRow): boolean {
  return num(i.line_cogs) > 0 || num(i.unit_cost) > 0;
}

export interface Kpis {
  sales: number;
  orders: number;
  customers: number;
  profit: number;
  qty: number;
  marginPct: number | null;
  missingCostLines: number;
  totalLines: number;
}

/**
 * 6 KPI. Category filter na ho to bill (pos_sales) ki raqam -- wohi jo
 * mojooda tiles dikhate hain. Category ho to sirf us category ki lines.
 */
export function computeKpis(sales: SaleRow[], items: ItemRow[], categoryOf: (productId: string | null) => string | null, categoryId: string | null): Kpis {
  const lines = categoryId ? items.filter((i) => categoryOf(i.product_id) === categoryId) : items;
  const saleIds = new Set(lines.map((i) => i.sale_id));
  const scopedSales = categoryId ? sales.filter((s) => saleIds.has(s.id)) : sales;
  const salesAmt = categoryId ? lines.reduce((a, i) => a + num(i.subtotal), 0) : sales.reduce((a, s) => a + num(s.total_amount), 0);
  const profit = categoryId
    ? lines.reduce((a, i) => a + num(i.subtotal) - num(i.line_cogs), 0)
    : sales.reduce((a, s) => a + num(s.profit), 0);
  const customers = new Set(scopedSales.map((s) => s.crm_customer_id ?? s.customer_id).filter(Boolean) as string[]).size;
  return {
    sales: salesAmt,
    orders: scopedSales.length,
    customers,
    profit,
    qty: lines.reduce((a, i) => a + num(i.quantity), 0),
    marginPct: salesAmt > 0 ? (profit / salesAmt) * 100 : null,
    missingCostLines: lines.filter((i) => !itemHasCost(i)).length,
    totalLines: lines.length,
  };
}

export interface Point {
  key: string;
  label: string;
  amount: number;
}

/** Timeframe ka shuru (UTC ISO) aur buckets. */
export function timeframeWindow(tf: Timeframe, nowMs: number): { startIso: string; buckets: Point[]; bucketOf: (ts: string) => string | null } {
  const today = pktDate(nowMs);
  if (tf === "live") {
    // Pichle 60 minute, 5-5 minute ke dabbe.
    const step = 5 * 60000;
    const end = Math.floor(nowMs / step) * step;
    const start = end - 11 * step;
    const buckets: Point[] = [];
    for (let i = 0; i < 12; i++) {
      const t = start + i * step;
      const d = new Date(t + PKT_OFFSET_MS);
      buckets.push({ key: String(t), label: `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`, amount: 0 });
    }
    return {
      startIso: new Date(start).toISOString(),
      buckets,
      bucketOf: (ts) => {
        const t = Math.floor(new Date(ts).getTime() / step) * step;
        return t >= start && t <= end ? String(t) : null;
      },
    };
  }
  if (tf === "aaj") {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ key: String(h), label: `${String(h).padStart(2, "0")}:00`, amount: 0 }));
    return { startIso: pktDayStartIso(today), buckets, bucketOf: (ts) => (pktDate(ts) === today ? String(pktHour(ts)) : null) };
  }
  if (tf === "1y") {
    const [y, m] = today.split("-").map(Number);
    const buckets: Point[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      const key = d.toISOString().slice(0, 7);
      buckets.push({ key, label: d.toLocaleString("en", { month: "short", timeZone: "UTC" }), amount: 0 });
    }
    return { startIso: pktDayStartIso(`${buckets[0].key}-01`), buckets, bucketOf: (ts) => pktDate(ts).slice(0, 7) };
  }
  const days = tf === "7d" ? 7 : 30;
  const first = addDays(today, -(days - 1));
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = addDays(first, i);
    return { key: d, label: d.slice(5), amount: 0 };
  });
  return { startIso: pktDayStartIso(first), buckets, bucketOf: (ts) => pktDate(ts) };
}

/** Bucket mein raqam jama karo. `rows` = {ts, amount}. */
export function bucketize(buckets: Point[], bucketOf: (ts: string) => string | null, rows: { ts: string; amount: number }[]): Point[] {
  const out = buckets.map((b) => ({ ...b }));
  const idx = new Map(out.map((b, i) => [b.key, i]));
  for (const r of rows) {
    const k = bucketOf(r.ts);
    const i = k == null ? undefined : idx.get(k);
    if (i !== undefined) out[i].amount += num(r.amount);
  }
  return out;
}

export interface Ranked {
  id: string;
  name: string;
  amount: number;
  qty: number;
  profit: number;
}

/** Product/category ke hisaab se jama -- sorted, bari raqam pehle. */
export function rankBy(items: ItemRow[], keyOf: (i: ItemRow) => string | null, nameOf: (key: string) => string): Ranked[] {
  const m = new Map<string, Ranked>();
  for (const i of items) {
    const k = keyOf(i) ?? "none";
    const r = m.get(k) ?? { id: k, name: k === "none" ? "Baghair category" : nameOf(k), amount: 0, qty: 0, profit: 0 };
    r.amount += num(i.subtotal);
    r.qty += num(i.quantity);
    r.profit += num(i.subtotal) - num(i.line_cogs);
    m.set(k, r);
  }
  return [...m.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

/** Top N aur sab se kam N -- dono mein ek hi cheez dohri na aaye. */
export function topBottom(rows: Ranked[], top: number, bottom: number): { top: Ranked[]; bottom: Ranked[] } {
  const t = rows.slice(0, top);
  const rest = rows.slice(top);
  const b = [...rest].sort((a, c) => a.amount - c.amount || a.name.localeCompare(c.name)).slice(0, bottom);
  return { top: t, bottom: b };
}

/** Donut ke liye: pehli (n-1) category alag, baqi "Baqi" mein. */
export function donutSlices(rows: Ranked[], n = 7): { name: string; amount: number }[] {
  const pos = rows.filter((r) => r.amount > 0);
  if (pos.length <= n) return pos.map((r) => ({ name: r.name, amount: r.amount }));
  const head = pos.slice(0, n - 1).map((r) => ({ name: r.name, amount: r.amount }));
  head.push({ name: "Baqi", amount: pos.slice(n - 1).reduce((a, r) => a + r.amount, 0) });
  return head;
}

/** Shop filter ho to category list sirf us dukan ki ijazat wali (686). Khali = sab. */
export function visibleCategories<T extends { id: string }>(all: T[], allowedForShop: string[] | null): T[] {
  if (!allowedForShop || allowedForShop.length === 0) return all;
  const s = new Set(allowedForShop);
  return all.filter((c) => s.has(c.id));
}

/** Sparkline: range ko 10 hisson mein baant kar har hisse ki qeemat. */
export function sparkSeries(rows: { ts: string; value: number }[], fromIso: string, toIso: string, parts = 10): number[] {
  const a = Date.parse(fromIso);
  const b = Math.max(Date.parse(toIso), a + 1);
  const out = new Array(parts).fill(0);
  for (const r of rows) {
    const t = Date.parse(r.ts);
    if (t < a || t > b) continue;
    out[Math.min(parts - 1, Math.floor(((t - a) / (b - a)) * parts))] += num(r.value);
  }
  return out;
}

/** Munafa % ke saath note -- jab kuch lines ki cost khali ho (munafa zyada dikhega). */
export function marginNote(k: Pick<Kpis, "missingCostLines" | "totalLines">): string | null {
  if (!k.totalLines || !k.missingCostLines) return null;
  const pct = Math.round((k.missingCostLines / k.totalLines) * 100);
  return `${k.missingCostLines} lines (${pct}%) ki cost khali -- munafa asal se zyada dikh sakta hai`;
}
