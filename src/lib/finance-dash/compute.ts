/**
 * Finance dashboards ka hisaab (Cash Flow, P&L, Inventory).
 * Sirf pure functions: data andar, numbers bahar. Database yahan nahi chhuta,
 * is liye tests bina database ke chal jate hain.
 */

export type JEntry = { id: string; entry_date: string; source_module: string | null; is_reversal: boolean | null; posting_status: string | null };
export type JLine = { entry_id: string; account_code: string; debit: number | string | null; credit: number | string | null };
export type GlAccount = { code: string; name: string; account_type: string };

/** Ye entries trend mein nahi gini jatin: asal len-den nahi, sirf durusti. */
export const EXCLUDED_SOURCE_RE = /(correction|reversal|opening|manual|reconcil|repair)/i;

export function isVoid(e: Pick<JEntry, "posting_status">): boolean {
  return (e.posting_status ?? "posted") === "void";
}
export function isExcluded(e: Pick<JEntry, "source_module" | "is_reversal">): boolean {
  return Boolean(e.is_reversal) || EXCLUDED_SOURCE_RE.test(e.source_module ?? "");
}
const num = (v: unknown) => Number(v ?? 0) || 0;
const net = (l: JLine) => num(l.debit) - num(l.credit);

export function isCashAccount(a: GlAccount): boolean {
  return a.account_type === "asset" && /^(cash|bank|wallet)/i.test(a.name.trim());
}
/** "Bank — Alfalah" -> "Bank Alfalah", "Wallet — JazzCash" -> "JazzCash", qausain hata do. */
export function shortAccountName(name: string): string {
  return name.replace(/^Wallet\s+—\s+/i, "").replace(/\s+—\s+/, " ").replace(/\s*\(.*\)\s*$/, "").trim();
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function dayLabel(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MON[m - 1]}`;
}
export function mondayOf(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const wd = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - wd);
  return d.toISOString().slice(0, 10);
}
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function group<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const a = m.get(k);
    if (a) a.push(r);
    else m.set(k, [r]);
  }
  return m;
}

// ---------------------------------------------------------------- Cash flow
export type CashFlowResult = {
  from: string; to: string;
  cashIn: number; cashOut: number; net: number; margin: number;
  rawIn: number; rawOut: number;
  weekly: { label: string; in: number; out: number; net: number }[];
  daily: { label: string; in: number; out: number; net: number }[];
  monthly: { label: string; in: number; out: number }[];
  accounts: { name: string; in: number; out: number }[];
  balances: { name: string; balance: number }[];
  inflows: { name: string; value: number }[];
  outflows: { name: string; value: number }[];
};

/**
 * entries/lines: muddat (from..to) ki entries aur un ki lines.
 * balanceLines: cash accounts ki saari lines (har waqt ki), balance ke liye; void entries ki ids voidIds mein.
 */
export function computeCashFlow(args: { from: string; to: string; entries: JEntry[]; lines: JLine[]; gl: GlAccount[]; balanceLines: JLine[]; voidIds: Set<string> }): CashFlowResult {
  const { from, to, entries, lines, gl, balanceLines, voidIds } = args;
  const cash = new Map(gl.filter(isCashAccount).map((a) => [a.code, a]));
  const glName = new Map(gl.map((a) => [a.code, a.name]));
  const byEntry = group(lines, (l) => l.entry_id);
  let cashIn = 0, cashOut = 0, rawIn = 0, rawOut = 0;
  const wk = new Map<string, { in: number; out: number }>();
  const mo = new Map<string, { in: number; out: number }>();
  const dy = new Map<string, { in: number; out: number }>();
  const acct = new Map<string, { in: number; out: number }>();
  const cp = new Map<string, number>();
  for (const e of entries) {
    if (isVoid(e) || e.entry_date < from || e.entry_date > to) continue;
    const ls = byEntry.get(e.id) ?? [];
    if (!ls.some((l) => cash.has(l.account_code))) continue;
    const cn = ls.filter((l) => cash.has(l.account_code)).reduce((s, l) => s + net(l), 0);
    if (cn > 0) rawIn += cn; else rawOut -= cn;
    if (isExcluded(e)) continue;
    const w = mondayOf(e.entry_date) < from ? from : mondayOf(e.entry_date);
    const m = e.entry_date.slice(0, 7);
    for (const l of ls) {
      if (cash.has(l.account_code)) {
        const a = acct.get(l.account_code) ?? { in: 0, out: 0 };
        a.in += num(l.debit); a.out += num(l.credit);
        acct.set(l.account_code, a);
        continue;
      }
      const amt = -net(l);
      const name = glName.get(l.account_code) ?? l.account_code;
      cp.set(name, (cp.get(name) ?? 0) + amt);
      const W = wk.get(w) ?? { in: 0, out: 0 };
      const M = mo.get(m) ?? { in: 0, out: 0 };
      const D = dy.get(e.entry_date) ?? { in: 0, out: 0 };
      if (amt > 0) { cashIn += amt; W.in += amt; M.in += amt; D.in += amt; } else { cashOut -= amt; W.out -= amt; M.out -= amt; D.out -= amt; }
      wk.set(w, W); mo.set(m, M); dy.set(e.entry_date, D);
    }
  }
  const bal = new Map<string, number>();
  for (const l of balanceLines) {
    if (voidIds.has(l.entry_id) || !cash.has(l.account_code)) continue;
    bal.set(l.account_code, (bal.get(l.account_code) ?? 0) + net(l));
  }
  const cps = Array.from(cp.entries()).map(([name, value]) => ({ name, value: Math.round(value) })).filter((r) => r.value !== 0);
  return {
    from, to, cashIn, cashOut, net: cashIn - cashOut, margin: cashIn ? ((cashIn - cashOut) / cashIn) * 100 : 0, rawIn, rawOut,
    weekly: Array.from(wk.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([w, v]) => ({ label: dayLabel(w), in: v.in, out: v.out, net: v.in - v.out })),
    daily: Array.from(dy.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({ label: dayLabel(d), in: v.in, out: v.out, net: v.in - v.out })),
    monthly: Array.from(mo.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([m, v]) => ({ label: MON[Number(m.slice(5, 7)) - 1], in: v.in, out: v.out })),
    accounts: Array.from(acct.entries()).map(([c, v]) => ({ name: shortAccountName(cash.get(c)!.name), ...v })).filter((a) => a.in || a.out).sort((a, b) => b.in - a.in),
    balances: Array.from(bal.entries()).map(([c, v]) => ({ name: shortAccountName(cash.get(c)!.name), balance: Math.round(v) })).filter((b) => b.balance !== 0).sort((a, b) => b.balance - a.balance),
    inflows: cps.filter((r) => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 5),
    outflows: cps.filter((r) => r.value < 0).sort((a, b) => a.value - b.value).slice(0, 8).map((r) => ({ name: r.name, value: -r.value })),
  };
}

// ---------------------------------------------------------------- P&L
export type PnlResult = {
  from: string; to: string;
  revenue: number; expenses: number; net: number; margin: number;
  months: { key: string; label: string; revenue: number; expenses: number; faded: boolean }[];
  expenseCats: { code: string; name: string; value: number }[];
  incomeCats: { code: string; name: string; value: number }[];
  salaries: number; salariesMissing: boolean;
  grainPurchase: number;
  excluded: { source: string; type: string; value: number }[];
};

export const SALARY_CODE = "6000";
export const GRAIN_PURCHASE_CODE = "5020";
/** Is se kam tankhwah muddat mein darj ho to banner dikhao. */
export const SALARY_MIN_EXPECTED = 10000;

/** entries: KPI muddat + pichhle mahine (chart ke liye). monthStart: chart ka pehla mahina (YYYY-MM). */
export function computePnl(args: { from: string; to: string; monthStart: string; entries: JEntry[]; lines: JLine[]; gl: GlAccount[] }): PnlResult {
  const { from, to, monthStart, entries, lines, gl } = args;
  const acc = new Map(gl.map((a) => [a.code, a]));
  const byEntry = group(lines, (l) => l.entry_id);
  const months = new Map<string, { revenue: number; expenses: number }>();
  for (let m = monthStart; m <= to.slice(0, 7); m = addDays(m + "-28", 7).slice(0, 7)) months.set(m, { revenue: 0, expenses: 0 });
  const exp = new Map<string, number>(), inc = new Map<string, number>(), exc = new Map<string, number>();
  let revenue = 0, expenses = 0;
  for (const e of entries) {
    if (isVoid(e) || e.entry_date > to) continue;
    const excluded = isExcluded(e);
    for (const l of byEntry.get(e.id) ?? []) {
      const a = acc.get(l.account_code);
      if (!a || (a.account_type !== "income" && a.account_type !== "expense")) continue;
      const v = net(l);
      if (excluded) {
        if (e.entry_date >= from) {
          const k = `${e.is_reversal ? "reversal" : e.source_module ?? "?"}|${a.account_type}`;
          exc.set(k, (exc.get(k) ?? 0) + v);
        }
        continue;
      }
      const mk = e.entry_date.slice(0, 7);
      const M = months.get(mk);
      if (a.account_type === "income") { if (M) M.revenue -= v; } else if (M) M.expenses += v;
      if (e.entry_date < from) continue;
      if (a.account_type === "income") { revenue -= v; inc.set(a.code, (inc.get(a.code) ?? 0) - v); }
      else { expenses += v; exp.set(a.code, (exp.get(a.code) ?? 0) + v); }
    }
  }
  const cats = (m: Map<string, number>) =>
    Array.from(m.entries()).map(([code, value]) => ({ code, name: acc.get(code)?.name ?? code, value: Math.round(value) })).filter((r) => r.value !== 0).sort((a, b) => b.value - a.value);
  const salaries = Math.round(exp.get(SALARY_CODE) ?? 0);
  // Table aur KPI ek jaise hon: rounded category ka jor.
  revenue = cats(inc).reduce((s, c) => s + c.value, 0);
  expenses = cats(exp).reduce((s, c) => s + c.value, 0);
  return {
    from, to, revenue, expenses, net: revenue - expenses, margin: revenue ? ((revenue - expenses) / revenue) * 100 : 0,
    months: Array.from(months.entries()).map(([key, v]) => ({ key, label: MON[Number(key.slice(5, 7)) - 1] + (key === to.slice(0, 7) ? "*" : ""), ...v, faded: key < from.slice(0, 7) })),
    expenseCats: cats(exp), incomeCats: cats(inc), salaries, salariesMissing: salaries < SALARY_MIN_EXPECTED,
    grainPurchase: Math.round(exp.get(GRAIN_PURCHASE_CODE) ?? 0),
    excluded: Array.from(exc.entries()).map(([k, value]) => ({ source: k.split("|")[0], type: k.split("|")[1], value: Math.round(value) })).filter((r) => r.value !== 0).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
  };
}

// ---------------------------------------------------------------- Inventory
export type InvProduct = { id: string; name: string; category: string | null; min_stock_threshold: number | string | null; purchase_price: number | string | null };
export type InvRow = { product_id: string; warehouse_id: string | null; quantity_on_hand: number | string | null };
export type InvWarehouse = { id: string; name: string };
export type InventoryResult = {
  total: number; inStock: number; outOfStock: number; withMin: number; low: number; healthy: number; health: number;
  minSetOut: number; stockValue: number;
  byCategory: { name: string; value: number; products: number; inStock: number }[];
  lowList: { name: string; category: string; qty: number; min: number; status: "KAM" | "KHATAM" }[];
  lowTotal: number;
  byWarehouse: { name: string; value: number; items: number }[];
};

/**
 * Health = (stock wale aur min se upar) ÷ kul products.
 * "Low" = min set hai, stock > 0 aur stock <= min. Min ke bagair product kabhi low nahi hota.
 */
export function computeInventory(args: { products: InvProduct[]; inventory: InvRow[]; warehouses: InvWarehouse[] }): InventoryResult {
  const { products, inventory, warehouses } = args;
  const ids = new Set(products.map((p) => p.id));
  const qty = new Map<string, number>();
  for (const r of inventory) if (ids.has(r.product_id)) qty.set(r.product_id, (qty.get(r.product_id) ?? 0) + num(r.quantity_on_hand));
  let inStock = 0, withMin = 0, low = 0, minSetOut = 0, stockValue = 0;
  const cat = new Map<string, { value: number; products: number; inStock: number }>();
  const lows: InventoryResult["lowList"] = [];
  for (const p of products) {
    const q = qty.get(p.id) ?? 0;
    const mn = num(p.min_stock_threshold);
    const v = Math.max(q, 0) * num(p.purchase_price);
    stockValue += v;
    if (q > 0) inStock++;
    const c = cat.get(p.category ?? "Bina category") ?? { value: 0, products: 0, inStock: 0 };
    c.value += v; c.products++; if (q > 0) c.inStock++;
    cat.set(p.category ?? "Bina category", c);
    if (mn > 0) {
      withMin++;
      if (q <= mn) {
        if (q > 0) low++; else minSetOut++;
        lows.push({ name: p.name, category: p.category ?? "—", qty: Math.max(q, 0), min: Math.round(mn), status: q > 0 ? "KAM" : "KHATAM" });
      }
    }
  }
  const pp = new Map(products.map((p) => [p.id, num(p.purchase_price)]));
  const wh = new Map<string, { value: number; items: number }>(warehouses.map((w) => [w.id, { value: 0, items: 0 }]));
  for (const r of inventory) {
    if (!r.warehouse_id || !ids.has(r.product_id) || !wh.has(r.warehouse_id)) continue;
    const q = num(r.quantity_on_hand);
    if (q <= 0) continue;
    const w = wh.get(r.warehouse_id)!;
    w.value += q * (pp.get(r.product_id) ?? 0); w.items++;
  }
  const healthy = inStock - low;
  lows.sort((a, b) => (a.status === b.status ? a.qty - b.qty : a.status === "KAM" ? -1 : 1));
  return {
    total: products.length, inStock, outOfStock: products.length - inStock, withMin, low, healthy,
    health: products.length ? (healthy / products.length) * 100 : 0, minSetOut, stockValue,
    byCategory: Array.from(cat.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.value - a.value),
    lowList: lows.slice(0, 10), lowTotal: lows.length,
    byWarehouse: warehouses.map((w) => ({ name: w.name, ...wh.get(w.id)! })).sort((a, b) => b.value - a.value),
  };
}

/** Donut ke liye: pehle n, baqi "Baqi" mein. */
export function topWithRest(rows: { name: string; value: number }[], n = 6): { name: string; value: number }[] {
  const pos = rows.filter((r) => r.value > 0);
  if (pos.length <= n + 1) return pos;
  return [...pos.slice(0, n), { name: "Baqi", value: pos.slice(n).reduce((s, r) => s + r.value, 0) }];
}
