import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMergePanel, diffProductEdit, type ProductPendingExtra, type StockLine } from "./product-diff";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, any, any>;

const LOOKUP: Record<string, string> = { category_id: "categories", company_id: "companies", brand_id: "brands" };

async function stockFor(sb: Sb, ids: string[]): Promise<Map<string, StockLine[]>> {
  const m = new Map<string, StockLine[]>();
  if (!ids.length) return m;
  const { data } = await sb.from("inventory").select("product_id, quantity_on_hand, warehouses(name)").in("product_id", ids);
  for (const r of (data ?? []) as any[]) {
    const w = Array.isArray(r.warehouses) ? r.warehouses[0]?.name : r.warehouses?.name;
    const list = m.get(r.product_id) ?? [];
    list.push({ warehouse: w ?? "—", qty: Number(r.quantity_on_hand ?? 0) });
    m.set(r.product_id, list);
  }
  return m;
}

/** Product edit / merge requests ka pehle-vs-baad (sirf parhta hai, RLS ke andar). */
export async function loadProductPendingExtras(sb: Sb, editIds: string[], mergeIds: string[]): Promise<Map<string, ProductPendingExtra>> {
  const out = new Map<string, ProductPendingExtra>();
  if (editIds.length) {
    const { data: reqs } = await sb.from("product_edit_requests").select("*").in("id", editIds);
    const rows = (reqs ?? []) as any[];
    const pids = [...new Set(rows.map((r) => r.product_id))];
    const { data: prods } = pids.length ? await sb.from("products").select("*").in("id", pids) : { data: [] };
    const pm = new Map(((prods ?? []) as any[]).map((p) => [p.id, p]));
    // Ids -> naam
    const want: Record<string, Set<string>> = {};
    for (const r of rows) {
      const p = pm.get(r.product_id) ?? {};
      for (const k of Object.keys(LOOKUP)) {
        for (const v of [r.changes?.[k], r.original?.[k], p[k]]) if (v) (want[k] ??= new Set()).add(String(v));
      }
    }
    const names = new Map<string, string>();
    for (const [k, set] of Object.entries(want)) {
      const { data } = await sb.from(LOOKUP[k]).select("id, name").in("id", [...set]);
      for (const x of (data ?? []) as any[]) names.set(`${k}:${x.id}`, x.name);
    }
    const resolve = (k: string, v: unknown) => (LOOKUP[k] && v ? names.get(`${k}:${v}`) ?? v : v);
    for (const r of rows) {
      const p = pm.get(r.product_id);
      if (!p) continue;
      out.set(String(r.id), diffProductEdit(r, p, resolve));
    }
  }
  if (mergeIds.length) {
    const { data: reqs } = await sb.from("product_merge_requests").select("id, source_product_id, target_product_id, source_stock_snapshot").in("id", mergeIds);
    const rows = (reqs ?? []) as any[];
    const pids = [...new Set(rows.flatMap((r) => [r.source_product_id, r.target_product_id]))];
    const { data: prods } = pids.length ? await sb.from("products").select("id, name, selling_price").in("id", pids) : { data: [] };
    const pm = new Map(((prods ?? []) as any[]).map((p) => [p.id, p]));
    const st = await stockFor(sb, pids);
    for (const r of rows) {
      const s = pm.get(r.source_product_id);
      const t = pm.get(r.target_product_id);
      if (!s || !t) continue;
      out.set(
        String(r.id),
        buildMergePanel(
          { id: s.id, name: s.name, rate: s.selling_price, stock: st.get(s.id) ?? [] },
          { id: t.id, name: t.name, rate: t.selling_price, stock: st.get(t.id) ?? [] },
          r.source_stock_snapshot,
        ),
      );
    }
  }
  return out;
}
