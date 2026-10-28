/* Supply Chain dashboard ka hisaab -- sirf saada data andar, koi database nahi (test aur screenshot ke liye).
 * Jo data mojood na ho us ki jagah `null` aata hai, taa ke screen "data nahi" dikhaye, farzi number nahi. */

export const COST_TYPES = ["kiraya", "godam", "packing", "mazdoori", "deegar"] as const;
export type CostType = (typeof COST_TYPES)[number];
export const COST_LABEL: Record<CostType | "khareed", string> = {
  khareed: "Khareed (maal)",
  kiraya: "Kiraya-bhaara",
  godam: "Godam",
  packing: "Packing",
  mazdoori: "Mazdoori",
  deegar: "Deegar",
};

export interface ScPurchase {
  id: string;
  purchase_number: string;
  purchase_date: string; // YYYY-MM-DD
  expected_date: string | null;
  received_at: string | null; // timestamptz
  branch_id: string | null;
  supplier_id: string | null;
  status: string;
  total_amount: number | null;
}
export interface ScItem { purchase_id: string; product_id: string; quantity: number; received_qty: number | null; short_qty: number | null; damaged_qty: number | null }
export interface ScProduct { id: string; name: string; category_id: string | null; min_stock_threshold: number | null; purchase_price: number | null }
export interface ScCost { purchase_id: string; cost_type: string; amount: number }
export interface ScFilters { month: string; branch: string; category: string; supplier: string }

export interface ScInput {
  today: string; // YYYY-MM-DD (PKT)
  filters: ScFilters;
  purchases: ScPurchase[];
  items: ScItem[];
  products: ScProduct[];
  stockByProduct: Record<string, number>;
  costs: ScCost[];
  cogsByMonth: Record<string, number>; // "YYYY-MM" -> maal ki laagat jo biki
  names: { suppliers: Record<string, string>; branches: Record<string, string>; categories: Record<string, string> };
  /** Migration 692 abhi lagi nahi to ye false -- screen par wazeh paighaam. */
  hasExpectedDate: boolean;
  hasCosts: boolean;
}

export interface ScKpi { value: number | null; prev: number | null }
export interface ScRow {
  date: string; po: string; grn: string | null; product: string; category: string; branch: string; supplier: string;
  qty: number; amount: number; status: "waqt_par" | "late" | "intezar" | "tareekh_nahi";
}
export interface ScResult {
  periodLabel: string;
  from: string;
  to: string;
  kpi: { onTime: ScKpi; totalCost: ScKpi; turnover: ScKpi; fillRate: ScKpi; leadDays: ScKpi; stockout: ScKpi };
  counts: { po: number; received: number; withExpected: number; tracked: number; products: number; noMin: number };
  months: { key: string; label: string; onTime: number | null; grn: number; lead: number | null; turnover: number | null }[];
  costSplit: { key: string; name: string; value: number }[];
  rows: ScRow[];
  noMinProducts: { id: string; name: string; category: string; stock: number }[];
  hasExpectedDate: boolean;
  hasCosts: boolean;
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MON[Number(m) - 1]} ${y.slice(2)}`;
}
export function addMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
function monthEnd(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
/** received_at (UTC) ko PKT ki tareekh mein. */
export function pkDate(ts: string | null): string | null {
  if (!ts) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return ts;
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return null;
  return new Date(t + 5 * 3600 * 1000).toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}
const r1 = (v: number) => Math.round(v * 10) / 10;

export function isValidMonth(m: string | undefined | null): m is string {
  return !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}

export function computeSupplyChain(inp: ScInput): ScResult {
  const { filters: f } = inp;
  const curMonth = inp.today.slice(0, 7);
  const month = isValidMonth(f.month) ? f.month : "";
  const endMonth = month || curMonth;
  const from = month ? `${month}-01` : `${addMonths(curMonth, -11)}-01`;
  const to = month ? monthEnd(month) : inp.today;
  const prevFrom = month ? `${addMonths(month, -1)}-01` : `${addMonths(curMonth, -23)}-01`;
  const prevTo = month ? monthEnd(addMonths(month, -1)) : monthEnd(addMonths(curMonth, -12));

  const productById = new Map(inp.products.map((p) => [p.id, p]));
  const itemsByPo = new Map<string, ScItem[]>();
  for (const it of inp.items) {
    const arr = itemsByPo.get(it.purchase_id) ?? [];
    arr.push(it);
    itemsByPo.set(it.purchase_id, arr);
  }
  const inCategory = (p: ScPurchase) =>
    !f.category || (itemsByPo.get(p.id) ?? []).some((it) => productById.get(it.product_id)?.category_id === f.category);
  const pos = inp.purchases.filter(
    (p) => p.status !== "cancelled" && (!f.branch || p.branch_id === f.branch) && (!f.supplier || p.supplier_id === f.supplier) && inCategory(p),
  );
  const between = (d: string | null, a: string, b: string) => !!d && d >= a && d <= b;

  function poStats(a: string, b: string) {
    const list = pos.filter((p) => between(p.purchase_date, a, b));
    const received = list.filter((p) => pkDate(p.received_at));
    const judged = received.filter((p) => p.expected_date);
    const onTime = judged.filter((p) => (pkDate(p.received_at) as string) <= (p.expected_date as string)).length;
    const leads = received.map((p) => daysBetween(p.purchase_date, pkDate(p.received_at) as string)).filter((d) => d >= 0);
    let ordered = 0, good = 0;
    for (const p of received) {
      for (const it of itemsByPo.get(p.id) ?? []) {
        if (f.category && productById.get(it.product_id)?.category_id !== f.category) continue;
        const q = Number(it.quantity) || 0;
        const rec = it.received_qty == null ? q - (Number(it.short_qty) || 0) : Number(it.received_qty);
        ordered += q;
        good += Math.max(0, rec - (Number(it.damaged_qty) || 0));
      }
    }
    const ids = new Set(list.map((p) => p.id));
    const costs = inp.costs.filter((c) => ids.has(c.purchase_id));
    const procurement = list.reduce((s, p) => s + (Number(p.total_amount) || 0), 0);
    const extra = costs.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    return {
      list, received, judged,
      onTime: judged.length ? r1((onTime / judged.length) * 100) : null,
      lead: leads.length ? r1(leads.reduce((s, d) => s + d, 0) / leads.length) : null,
      fill: ordered > 0 ? r1(Math.min(100, (good / ordered) * 100)) : null,
      total: list.length ? procurement + extra : null,
      costs, procurement,
    };
  }
  const cur = poStats(from, to);
  const prev = poStats(prevFrom, prevTo);

  // Stock: aaj ki halat (purani tareekh ka stock record nahi hota).
  const prods = inp.products.filter((p) => !f.category || p.category_id === f.category);
  const stockOf = (id: string) => Number(inp.stockByProduct[id] ?? 0);
  const stockValue = prods.reduce((s, p) => s + Math.max(0, stockOf(p.id)) * (Number(p.purchase_price) || 0), 0);
  const tracked = prods.filter((p) => Number(p.min_stock_threshold) > 0);
  const stockout = tracked.length ? r1((tracked.filter((p) => stockOf(p.id) <= 0).length / tracked.length) * 100) : null;
  const sumCogs = (a: string, b: string) => {
    let s = 0, any = false;
    for (let k = a.slice(0, 7); k <= b.slice(0, 7); k = addMonths(k, 1)) {
      if (inp.cogsByMonth[k] != null) { s += inp.cogsByMonth[k]; any = true; }
    }
    return any ? s : null;
  };
  const turn = (c: number | null) => (c != null && stockValue > 0 ? Math.round((c / stockValue) * 100) / 100 : null);

  const months = [] as ScResult["months"];
  for (let i = 11; i >= 0; i--) {
    const key = addMonths(endMonth, -i);
    const a = `${key}-01`, b = monthEnd(key);
    const rec = pos.filter((p) => between(pkDate(p.received_at), a, b));
    const judged = rec.filter((p) => p.expected_date);
    const ok = judged.filter((p) => (pkDate(p.received_at) as string) <= (p.expected_date as string)).length;
    const leads = rec.map((p) => daysBetween(p.purchase_date, pkDate(p.received_at) as string)).filter((d) => d >= 0);
    months.push({
      key, label: monthLabel(key), grn: rec.length,
      onTime: judged.length ? r1((ok / judged.length) * 100) : null,
      lead: leads.length ? r1(leads.reduce((s, d) => s + d, 0) / leads.length) : null,
      turnover: turn(inp.cogsByMonth[key] ?? null),
    });
  }

  const costSplit: ScResult["costSplit"] = [];
  if (cur.procurement > 0) costSplit.push({ key: "khareed", name: COST_LABEL.khareed, value: cur.procurement });
  for (const t of COST_TYPES) {
    const v = cur.costs.filter((c) => (COST_TYPES as readonly string[]).includes(c.cost_type) ? c.cost_type === t : t === "deegar").reduce((s, c) => s + (Number(c.amount) || 0), 0);
    if (v > 0) costSplit.push({ key: t, name: COST_LABEL[t], value: v });
  }

  const n = inp.names;
  const rows: ScRow[] = cur.list
    .slice()
    .sort((a, b) => (a.purchase_date < b.purchase_date ? 1 : a.purchase_date > b.purchase_date ? -1 : b.purchase_number.localeCompare(a.purchase_number)))
    .slice(0, 15)
    .map((p) => {
      const its = (itemsByPo.get(p.id) ?? []).filter((it) => !f.category || productById.get(it.product_id)?.category_id === f.category);
      const first = its[0] ? productById.get(its[0].product_id) : undefined;
      const rd = pkDate(p.received_at);
      const status: ScRow["status"] = !rd ? "intezar" : !p.expected_date ? "tareekh_nahi" : rd <= p.expected_date ? "waqt_par" : "late";
      return {
        date: p.purchase_date, po: p.purchase_number, grn: rd,
        product: first ? first.name + (its.length > 1 ? ` +${its.length - 1}` : "") : "-",
        category: first?.category_id ? n.categories[first.category_id] ?? "-" : "-",
        branch: p.branch_id ? n.branches[p.branch_id] ?? "-" : "-",
        supplier: p.supplier_id ? n.suppliers[p.supplier_id] ?? "-" : "-",
        qty: its.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
        amount: Number(p.total_amount) || 0,
        status,
      };
    });

  const noMin = prods.filter((p) => !(Number(p.min_stock_threshold) > 0));
  const noMinProducts = noMin
    .map((p) => ({ id: p.id, name: p.name, category: p.category_id ? n.categories[p.category_id] ?? "-" : "-", stock: stockOf(p.id) }))
    .sort((a, b) => b.stock - a.stock || a.name.localeCompare(b.name))
    .slice(0, 12);

  return {
    periodLabel: month ? monthLabel(month) : "Pichle 12 mahine",
    from, to,
    kpi: {
      onTime: { value: cur.onTime, prev: prev.onTime },
      totalCost: { value: cur.total, prev: prev.total },
      turnover: { value: turn(sumCogs(from, to)), prev: null },
      fillRate: { value: cur.fill, prev: prev.fill },
      leadDays: { value: cur.lead, prev: prev.lead },
      stockout: { value: stockout, prev: null },
    },
    counts: { po: cur.list.length, received: cur.received.length, withExpected: cur.judged.length, tracked: tracked.length, products: prods.length, noMin: noMin.length },
    months, costSplit, rows, noMinProducts,
    hasExpectedDate: inp.hasExpectedDate,
    hasCosts: inp.hasCosts,
  };
}

/** Pichle mahine se farq ka chhota jumla. `lowerIsBetter` = lead time, stockout, kharcha. */
export function deltaText(k: ScKpi, unit: "pct" | "num" | "rs", lowerIsBetter = false): { text: string; good: boolean | null } {
  if (k.value == null || k.prev == null) return { text: "", good: null };
  const d = k.value - k.prev;
  if (Math.abs(d) < 1e-9) return { text: "pichle se barabar", good: null };
  const up = d > 0;
  const mag = unit === "pct" ? `${Math.abs(d).toFixed(1)} pts` : unit === "rs" && k.prev ? `${Math.abs((d / k.prev) * 100).toFixed(1)}%` : Math.abs(d).toFixed(1);
  return { text: `${up ? "▲" : "▼"} ${mag} pichle se`, good: lowerIsBetter ? !up : up };
}

/** PO ki "maal kab tak" tareekh: purchase tareekh + supplier ke din. */
export function expectedFrom(purchaseDate: string, leadDays: number | null | undefined): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) || leadDays == null || !(leadDays >= 0)) return "";
  const t = Date.parse(purchaseDate + "T00:00:00Z") + Math.round(leadDays) * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}
