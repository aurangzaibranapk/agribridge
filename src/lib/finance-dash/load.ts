import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { addDays, computeCashFlow, computeInventory, computePnl, type GlAccount, type JEntry, type JLine } from "./compute";

/** Naye finance dashboards sirf in roles ko (RLS ke mutabiq maali data). */
export const FINANCE_DASH_ROLES = ["owner", "super_admin", "admin", "finance"];

export async function canSeeFinanceDash(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  return Boolean(me?.is_active && FINANCE_DASH_ROLES.includes(me.role as string));
}

type Svc = ReturnType<typeof createServiceClient>;

async function all<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await fetchPage(i, i + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

async function journal(svc: Svc, from: string, to: string) {
  const sb = svc as any;
  const entries = await all<JEntry>((a, b) => sb.from("journal_entries").select("id, entry_date, source_module, is_reversal, posting_status").gte("entry_date", from).lte("entry_date", to).order("id").range(a, b));
  const ids = entries.map((e) => e.id);
  const lines: JLine[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    lines.push(...(await all<JLine>((a, b) => sb.from("journal_lines").select("entry_id, account_code, debit, credit").in("entry_id", chunk).order("id").range(a, b))));
  }
  const gl = await all<GlAccount>((a, b) => sb.from("gl_accounts").select("code, name, account_type").order("code").range(a, b));
  return { entries, lines, gl };
}

export function todayPk(): string {
  return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function loadCashFlow(opts: { from?: string; to?: string } = {}) {
  const to = opts.to ?? todayPk();
  const from = opts.from ?? addDays(to, -29);
  const svc = createServiceClient();
  const sb = svc as any;
  const { entries, lines, gl } = await journal(svc, from, to);
  const cashCodes = gl.filter((a) => a.account_type === "asset" && /^(cash|bank|wallet)/i.test(a.name.trim())).map((a) => a.code);
  const balanceLines = cashCodes.length ? await all<JLine>((a, b) => sb.from("journal_lines").select("entry_id, account_code, debit, credit").in("account_code", cashCodes).order("id").range(a, b)) : [];
  const voids = await all<{ id: string }>((a, b) => sb.from("journal_entries").select("id").eq("posting_status", "void").order("id").range(a, b));
  return computeCashFlow({ from, to, entries, lines, gl, balanceLines, voidIds: new Set(voids.map((v) => v.id)) });
}

export async function loadPnl(opts: { from?: string; to?: string } = {}) {
  const to = opts.to ?? todayPk();
  // Default: pichhle mahine ki pehli tareekh se aaj tak.
  const d = new Date(to + "T00:00:00Z");
  const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const from = opts.from ?? prev;
  const f = new Date(from + "T00:00:00Z");
  const monthStart = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const { entries, lines, gl } = await journal(createServiceClient(), monthStart, to);
  return computePnl({ from, to, monthStart: monthStart.slice(0, 7), entries, lines, gl });
}

export async function loadInventory() {
  const sb = createServiceClient() as any;
  const prods = await all<any>((a, b) => sb.from("products").select("id, name, min_stock_threshold, purchase_price, is_deleted, categories(name)").order("id").range(a, b));
  const products = prods
    .filter((p) => !p.is_deleted)
    .map((p) => ({ id: p.id, name: p.name, min_stock_threshold: p.min_stock_threshold, purchase_price: p.purchase_price, category: (Array.isArray(p.categories) ? p.categories[0]?.name : p.categories?.name) ?? null }));
  const inventory = await all<any>((a, b) => sb.from("inventory").select("product_id, warehouse_id, quantity_on_hand").order("product_id").range(a, b));
  const warehouses = await all<any>((a, b) => sb.from("warehouses").select("id, name, is_active").order("name").range(a, b));
  return computeInventory({ products, inventory, warehouses: warehouses.filter((w) => w.is_active !== false).map((w) => ({ id: w.id, name: w.name })) });
}
