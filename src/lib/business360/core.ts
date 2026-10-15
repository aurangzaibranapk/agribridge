/**
 * Business 360 (owner) -- pure hisaab. Test: npm run test:business-360.
 *
 * Usool: koi farzi adad nahi. Jo source parha na ja saka (table/migration
 * maujood nahi, ya ijazat nahi) us ka total NULL -- safhe par "Data not
 * available" -- sifar nahi.
 */
export type Maybe = number | null;
export type PnlLineIn = { account_code: string; account_name: string | null; kind: string; department: string | null; source_module: string | null; branch_id: string | null; entry_date: string; amount: number };

const r2 = (v: number) => Math.round(v * 100) / 100;
export const sumOrNull = <T>(rows: T[] | null, f: (r: T) => number): Maybe => (rows == null ? null : r2(rows.reduce((a, r) => a + (Number(f(r)) || 0), 0)));

export function pnl(lines: PnlLineIn[] | null) {
  if (lines == null) return null;
  const by = (k: string) => r2(lines.filter((l) => l.kind === k).reduce((a, l) => a + l.amount, 0));
  const revenue = by("revenue"), cogs = by("cogs"), expenses = r2(by("expense") + by("stock_adjustment"));
  const gross = r2(revenue - cogs), net = r2(gross - expenses);
  const accounts = new Map<string, { code: string; name: string; kind: string; amount: number }>();
  for (const l of lines) {
    const a = accounts.get(l.account_code) ?? { code: l.account_code, name: l.account_name ?? l.account_code, kind: l.kind, amount: 0 };
    a.amount = r2(a.amount + l.amount); accounts.set(l.account_code, a);
  }
  return { revenue, cogs, gross, expenses, net, marginPct: revenue ? r2((net / revenue) * 100) : null, accounts: Array.from(accounts.values()).sort((a, b) => a.code.localeCompare(b.code)) };
}

export function groupNet(lines: PnlLineIn[] | null, key: (l: PnlLineIn) => string | null) {
  if (lines == null) return null;
  const m = new Map<string, { key: string; revenue: number; cost: number; net: number }>();
  for (const l of lines) {
    const k = key(l) ?? "—";
    const g = m.get(k) ?? { key: k, revenue: 0, cost: 0, net: 0 };
    if (l.kind === "revenue") g.revenue = r2(g.revenue + l.amount); else g.cost = r2(g.cost + l.amount);
    g.net = r2(g.revenue - g.cost); m.set(k, g);
  }
  return Array.from(m.values()).sort((a, b) => b.revenue - a.revenue);
}

export function machineryCost(lines: PnlLineIn[] | null): Maybe {
  if (lines == null) return null;
  return r2(lines.filter((l) => l.kind !== "revenue" && String(l.source_module ?? "").toLowerCase().includes("machinery")).reduce((a, l) => a + l.amount, 0));
}

export type BatchIn = { product_id: string; remaining_quantity: number; unit_cost: number | null; expiry_date: string | null };
export function stockPosition(batches: BatchIn[] | null, soldProductIds: Set<string> | null, today: string, expiryDays: number) {
  if (batches == null) return null;
  const limit = new Date(new Date(`${today}T00:00:00Z`).getTime() + expiryDays * 86_400_000).toISOString().slice(0, 10);
  let value = 0, expiringValue = 0, expiredValue = 0, deadValue = 0;
  const expiring = new Set<string>(), expired = new Set<string>(), dead = new Set<string>();
  for (const b of batches) {
    const v = Number(b.remaining_quantity) * Number(b.unit_cost ?? 0);
    value += v;
    if (b.expiry_date && b.expiry_date < today) { expired.add(b.product_id); expiredValue += v; }
    else if (b.expiry_date && b.expiry_date <= limit) { expiring.add(b.product_id); expiringValue += v; }
    if (soldProductIds && !soldProductIds.has(b.product_id)) { dead.add(b.product_id); deadValue += v; }
  }
  return {
    value: r2(value), expiring: expiring.size, expiringValue: r2(expiringValue), expired: expired.size, expiredValue: r2(expiredValue),
    dead: soldProductIds ? dead.size : null, deadValue: soldProductIds ? r2(deadValue) : null,
  };
}

export type CatItemIn = { category: string | null; subtotal: number; line_cogs: number | null };
export function categoryMargins(items: CatItemIn[] | null) {
  if (items == null) return null;
  const m = new Map<string, { name: string; sales: number; cost: number; missingCost: number }>();
  for (const i of items) {
    const k = i.category ?? "Uncategorized";
    const g = m.get(k) ?? { name: k, sales: 0, cost: 0, missingCost: 0 };
    g.sales += Number(i.subtotal) || 0;
    if (i.line_cogs == null) g.missingCost++; else g.cost += Number(i.line_cogs);
    m.set(k, g);
  }
  return Array.from(m.values()).map((g) => ({
    name: g.name, sales: r2(g.sales), cost: r2(g.cost), margin: r2(g.sales - g.cost),
    // Lagat na ho to margin jhoota hoga -- us soorat mein % nahi dikhate.
    marginPct: g.missingCost === 0 && g.sales > 0 ? r2(((g.sales - g.cost) / g.sales) * 100) : null, missingCost: g.missingCost,
  })).sort((a, b) => b.sales - a.sales);
}

/** Ledger tak le jane wale raaste. */
export const ledgerHref = {
  gl: (code: string, from: string, to: string) => `/admin/finance/statement-of-account?account=gl:${encodeURIComponent(code)}&from=${from}&to=${to}`,
  fa: (id: string, from: string, to: string) => `/admin/finance/statement-of-account?account=fa:${id}&from=${from}&to=${to}`,
};

export function validRange(from: string | undefined, to: string | undefined, today: string) {
  const ok = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const t = ok(to) ? to! : today;
  const f = ok(from) ? from! : `${t.slice(0, 7)}-01`;
  return f <= t ? { from: f, to: t } : { from: t, to: t };
}
