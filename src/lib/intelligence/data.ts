import { createServiceClient } from "@/lib/supabase/service";
import type { PartyEvent, PartyType, ProductIn } from "./core";

/**
 * Maujooda tables se sirf PARHNA. Har party type ki apni statement wali
 * tables wahi hain jo us ke statement safhe par istemal hoti hain.
 */
const LIMIT = 5000;
const VOID = ["cancelled", "void", "voided", "returned", "refunded"];
const num = (v: unknown) => { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; };

export const STATEMENT_HREF: Record<PartyType, (id: string) => string> = {
  customer: (id) => `/admin/crm/${id}/statement`,
  farmer: (id) => `/admin/farmers/${id}/statement`,
  dealer: (id) => `/admin/dealers/${id}/statement`,
  supplier: (id) => `/admin/suppliers/${id}/statement`,
  buyer: (id) => `/admin/buyers/${id}/statement`,
  investor: (id) => `/admin/investors/${id}/statement`,
  staff: (id) => `/admin/hr/${id}/statement`,
};

const LIST: Record<PartyType, { table: string; name: string; extra?: string; filter?: (q: any) => any }> = {
  customer: { table: "customers", name: "name", extra: "phone_number,customer_type,current_balance" },
  farmer: { table: "farmers", name: "full_name", extra: "phone_number,farmer_code" },
  dealer: { table: "dealers", name: "business_name", extra: "contact_person" },
  supplier: { table: "suppliers", name: "name", extra: "company_name,phone_number" },
  buyer: { table: "buyers", name: "business_name", extra: "phone_number" },
  investor: { table: "investors", name: "full_name", extra: "phone_number" },
  staff: { table: "profiles", name: "full_name", extra: "role,phone_number", filter: (q) => q.eq("is_active", true) },
};

export async function listParties(type: PartyType, search: string, orgId: string) {
  const db = createServiceClient() as any;
  const cfg = LIST[type];
  let q = db.from(cfg.table).select(`id,${cfg.name}${cfg.extra ? "," + cfg.extra : ""}`).order(cfg.name).limit(100);
  if (cfg.filter) q = cfg.filter(q);
  if (type === "staff") q = q.eq("organization_id", orgId);
  if (search) q = q.ilike(cfg.name, `%${search.replace(/[%,()]/g, "")}%`);
  const { data, error } = await q;
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []).map((r: any) => ({ id: r.id, name: r[cfg.name] ?? "—", sub: [r.phone_number, r.customer_type, r.role, r.company_name, r.farmer_code].filter(Boolean).join(" · ") })), error: null };
}

async function posEvents(db: any, customerIds: string[]): Promise<PartyEvent[]> {
  if (!customerIds.length) return [];
  const list = customerIds.join(",");
  const { data: sales, error } = await db.from("pos_sales").select("id,created_at,total_amount,khata_amount,status")
    .or(`customer_id.in.(${list}),crm_customer_id.in.(${list})`).order("created_at", { ascending: false }).limit(LIMIT);
  if (error) throw new Error(error.message);
  const live = (sales ?? []).filter((s: any) => !VOID.includes(String(s.status ?? "completed")));
  const ids = live.map((s: any) => s.id);
  const cat = new Map<string, Map<string, number>>();
  if (ids.length) {
    const { data: items } = await db.from("pos_sale_items").select("sale_id,subtotal,products(categories(name))").in("sale_id", ids.slice(0, 1000)).limit(LIMIT * 2);
    for (const it of items ?? []) {
      const name = it.products?.categories?.name ?? "Uncategorized";
      const m = cat.get(it.sale_id) ?? new Map<string, number>(); m.set(name, (m.get(name) ?? 0) + num(it.subtotal)); cat.set(it.sale_id, m);
    }
  }
  const out: PartyEvent[] = [];
  for (const s of live) {
    const total = num(s.total_amount), credit = Math.min(total, Math.max(0, num(s.khata_amount)));
    const cats = cat.get(s.id);
    if (cats && cats.size) for (const [name, amt] of cats) out.push({ date: s.created_at, kind: "we_sold", amount: amt, ref: `POS-${s.id.slice(0, 8)}`, category: name, credit: total ? (credit * amt) / total : 0 });
    else out.push({ date: s.created_at, kind: "we_sold", amount: total, ref: `POS-${s.id.slice(0, 8)}`, credit });
    if (total - credit > 0) out.push({ date: s.created_at, kind: "received", amount: total - credit, ref: `POS-${s.id.slice(0, 8)}` });
  }
  return out;
}

const ev = (rows: any[] | null, date: string, kind: PartyEvent["kind"], amount: string, ref: string): PartyEvent[] =>
  (rows ?? []).map((r) => ({ date: r[date], kind, amount: num(r[amount]), ref: String(r[ref] ?? r.id ?? "").slice(0, 24) }));

export async function loadParty(type: PartyType, id: string): Promise<{ name: string; events: PartyEvent[]; balanceOverride: number | null; truncated: boolean; notes: string[] }> {
  const db = createServiceClient() as any;
  const cfg = LIST[type];
  const { data: head } = await db.from(cfg.table).select(`id,${cfg.name}${type === "customer" ? ",current_balance" : ""}`).eq("id", id).maybeSingle();
  if (!head) throw new Error("Party nahi mili.");
  const name = head[cfg.name] ?? "—";
  const notes: string[] = [];
  let events: PartyEvent[] = [];
  let balanceOverride: number | null = null;
  const get = async (table: string, cols: string, col: string) => {
    const { data, error } = await db.from(table).select(cols).eq(col, id).limit(LIMIT);
    if (error) { notes.push(`${table}: ${error.message}`); return []; }
    return data ?? [];
  };
  switch (type) {
    case "customer":
      events = await posEvents(db, [id]);
      if (head.current_balance != null) { balanceOverride = num(head.current_balance); notes.push("balance = customers.current_balance (khata)"); }
      break;
    case "farmer": {
      const { data: links } = await db.from("customers").select("id").eq("farmer_id", id);
      events = [
        ...(await posEvents(db, (links ?? []).map((l: any) => l.id))),
        ...ev(await get("grain_procurement_entries", "id,entry_date,total_amount", "farmer_id"), "entry_date", "we_bought", "total_amount", "id"),
        ...ev(await get("grain_procurement_payments", "id,payment_date,amount", "farmer_id"), "payment_date", "paid", "amount", "id"),
      ];
      notes.push("POS (linked customer) + grain entries/payments");
      break;
    }
    case "dealer":
      events = [
        ...ev((await get("bridge_orders", "id,order_number,created_at,commission_amount", "dealer_id")).filter((r: any) => num(r.commission_amount) > 0), "created_at", "we_bought", "commission_amount", "order_number"),
        ...ev(await get("dealer_payments", "id,payment_date,amount", "dealer_id"), "payment_date", "paid", "amount", "id"),
      ];
      notes.push("sold to us = commission earned on bridge orders");
      break;
    case "supplier":
      events = [
        ...ev(await get("purchases", "id,purchase_number,purchase_date,total_amount", "supplier_id"), "purchase_date", "we_bought", "total_amount", "purchase_number"),
        ...ev(await get("supplier_payments", "id,payment_date,amount", "supplier_id"), "payment_date", "paid", "amount", "id"),
      ];
      break;
    case "buyer": {
      const pays = await get("buyer_payments", "id,payment_date,amount,direction", "buyer_id");
      events = [
        ...ev(await get("produce_orders", "id,order_number,created_at,subtotal", "buyer_id"), "created_at", "we_sold", "subtotal", "order_number").map((e) => ({ ...e, credit: e.amount })),
        ...ev(pays.filter((p: any) => p.direction === "they_paid"), "payment_date", "received", "amount", "id"),
        ...ev(pays.filter((p: any) => p.direction === "we_paid"), "payment_date", "paid", "amount", "id"),
      ];
      break;
    }
    case "investor":
      events = [
        ...ev(await get("investor_investments", "id,investment_date,amount", "investor_id"), "investment_date", "received", "amount", "id"),
        ...ev(await get("investor_returns", "id,return_date,amount", "investor_id"), "return_date", "paid", "amount", "id"),
      ];
      notes.push("received = investment, paid = returns");
      break;
    case "staff": {
      const rows = await get("staff_credit_ledger", "id,ledger_type,source_type,amount,created_at", "profile_id");
      events = [
        ...ev(rows.filter((r: any) => r.ledger_type === "credit"), "created_at", "we_bought", "amount", "source_type"),
        ...ev(rows.filter((r: any) => r.ledger_type === "debit"), "created_at", "paid", "amount", "source_type"),
      ];
      notes.push("staff_credit_ledger: credit = owed to staff, debit = paid/advance");
      break;
    }
  }
  return { name, events, balanceOverride, truncated: events.length >= LIMIT, notes };
}

/** Product intelligence -- purchase_items, pos_sale_items, stock_batches. */
export async function loadProducts(fromIso: string, search: string, category: string | null): Promise<{ products: ProductIn[]; error: string | null }> {
  const db = createServiceClient() as any;
  let pq = db.from("products").select("id,name,category_id,categories(name)").eq("is_active", true).order("name").limit(300);
  if (search) pq = pq.ilike("name", `%${search.replace(/[%,()]/g, "")}%`);
  if (category) pq = pq.eq("category_id", category);
  const { data: prods, error } = await pq;
  if (error) return { products: [], error: error.message };
  const ids = (prods ?? []).map((p: any) => p.id);
  if (!ids.length) return { products: [], error: null };
  const [pi, si, sb] = await Promise.all([
    db.from("purchase_items").select("product_id,quantity,line_total,unit_cost,purchases!inner(purchase_date,supplier_id,suppliers(name))").in("product_id", ids).gte("purchases.purchase_date", fromIso.slice(0, 10)).limit(LIMIT * 4),
    db.from("pos_sale_items").select("product_id,quantity,subtotal,pos_sales!inner(created_at,status)").in("product_id", ids).gte("pos_sales.created_at", fromIso).limit(LIMIT * 4),
    db.from("stock_batches").select("product_id,remaining_quantity,unit_cost,expiry_date").in("product_id", ids).gt("remaining_quantity", 0).limit(LIMIT * 4),
  ]);
  const errs = [pi, si, sb].map((r) => r.error?.message).filter(Boolean);
  const map = new Map<string, ProductIn>((prods ?? []).map((p: any) => [p.id, {
    id: p.id, name: p.name, category: p.categories?.name ?? null, purchasedQty: 0, purchasedValue: 0, soldQty: 0, soldValue: 0, soldCost: null,
    stockQty: 0, stockValue: 0, lastSaleAt: null, nearestExpiry: null, suppliers: [],
  }]));
  for (const r of pi.data ?? []) {
    const p = map.get(r.product_id); if (!p) continue;
    const q = num(r.quantity), v = r.line_total != null ? num(r.line_total) : q * num(r.unit_cost);
    p.purchasedQty += q; p.purchasedValue += v;
    const sup = r.purchases?.suppliers?.name ?? "—";
    const s = p.suppliers.find((x) => x.supplier === sup); if (s) { s.qty += q; s.value += v; } else p.suppliers.push({ supplier: sup, qty: q, value: v });
  }
  for (const r of si.data ?? []) {
    const p = map.get(r.product_id); if (!p || VOID.includes(String(r.pos_sales?.status ?? "completed"))) continue;
    p.soldQty += num(r.quantity); p.soldValue += num(r.subtotal);
    const at = r.pos_sales?.created_at; if (at && (!p.lastSaleAt || at > p.lastSaleAt)) p.lastSaleAt = at;
  }
  for (const r of sb.data ?? []) {
    const p = map.get(r.product_id); if (!p) continue;
    p.stockQty += num(r.remaining_quantity); p.stockValue = (p.stockValue ?? 0) + num(r.remaining_quantity) * num(r.unit_cost);
    if (r.expiry_date && (!p.nearestExpiry || r.expiry_date < p.nearestExpiry)) p.nearestExpiry = r.expiry_date;
  }
  return { products: Array.from(map.values()), error: errs.length ? errs.join("; ") : null };
}
