/**
 * Product tabdeeli / merge ka "pehle vs baad" (malik ki manzoori 21 Oct 2026,
 * mockups/product-edit-diff). Sirf hisaab -- koi DB call nahi (test aasaan).
 */

export type FieldKey = string;

/** Wo fields jo request mein aate hain, dikhane ki tarteeb aur label key ke saath. */
export const PRODUCT_FIELDS: { key: FieldKey; label: string }[] = [
  { key: "name", label: "ped_f_name" },
  { key: "pack_size", label: "ped_f_pack_size" },
  { key: "selling_price", label: "ped_f_selling_price" },
  { key: "purchase_price", label: "ped_f_purchase_price" },
  { key: "mrp_price", label: "ped_f_mrp_price" },
  { key: "wholesale_price", label: "ped_f_wholesale_price" },
  { key: "unit", label: "ped_f_unit" },
  { key: "category_id", label: "ped_f_category" },
  { key: "company_id", label: "ped_f_company" },
  { key: "brand_id", label: "ped_f_brand" },
  { key: "barcode", label: "ped_f_barcode" },
  { key: "manufacture_date", label: "ped_f_mfg" },
  { key: "expiry_date", label: "ped_f_expiry" },
  { key: "min_stock_threshold", label: "ped_f_min_stock" },
  { key: "active_ingredient", label: "ped_f_ingredient" },
  { key: "composition", label: "ped_f_composition" },
  { key: "dose", label: "ped_f_dose" },
  { key: "usage_instructions", label: "ped_f_usage" },
  { key: "safety_information", label: "ped_f_safety" },
  { key: "image_url", label: "ped_f_image" },
  { key: "show_expiry_to_customer", label: "ped_f_show_expiry" },
];
/** Andaruni / khud bane fields -- farq mein nahi dikhte. */
const HIDDEN = new Set(["sale_rate_pending", "unit_code", "updated_at"]);
const NUMERIC = new Set(["selling_price", "purchase_price", "mrp_price", "wholesale_price", "min_stock_threshold"]);

export type DiffFlag = "changed_since" | "no_change" | "instruction_name" | "merged_target";

export interface FieldChange {
  key: FieldKey;
  label: string;
  before: unknown;
  after: unknown;
}

export interface ProductEditDiff {
  kind: "edit";
  productName: string;
  oldName: string;
  newName: string | null;
  changes: FieldChange[];
  unchangedCount: number;
  flags: DiffFlag[];
  /** "original" (693 ke baad) ya "live" (purani requests -- abhi ki qeemat). */
  beforeSource: "original" | "live";
}

/** Khaali/null/"" ek barabar; numbers "150.00" == 150. */
export function normValue(key: string, v: unknown): unknown {
  if (v === undefined || v === null || v === "") return null;
  if (NUMERIC.has(key)) {
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }
  if (typeof v === "string") return v.trim();
  return v;
}

export function sameValue(key: string, a: unknown, b: unknown): boolean {
  const x = normValue(key, a);
  const y = normValue(key, b);
  if (x === null && key === "show_expiry_to_customer") return y === null || y === false;
  if (y === null && key === "show_expiry_to_customer") return x === false;
  return JSON.stringify(x) === JSON.stringify(y);
}

/** Naam ki jagah hidayat ("ye khatm krin", "delete karo") likhi ho. */
const INSTRUCTION_RE = /\b(khatm|khatam|khtm|delete|hata|hatao|remove|band\s*kr|mita|ye\s+bhi|isko|is\s+ko)\b/i;
export function looksLikeInstruction(name: string | null | undefined): boolean {
  if (!name) return false;
  return INSTRUCTION_RE.test(name);
}

export interface EditInput {
  changes: Record<string, unknown> | null;
  original?: Record<string, unknown> | null;
  created_at: string;
}
export interface ProductRow {
  name: string;
  updated_at?: string | null;
  [k: string]: unknown;
}

/** Ids (category/company/brand) ko naam mein badalna -- loader deta hai. */
export type Resolver = (key: string, v: unknown) => unknown;

export function diffProductEdit(req: EditInput, product: ProductRow, resolve: Resolver = (_k, v) => v): ProductEditDiff {
  const changes = req.changes ?? {};
  const hasOriginal = !!req.original && Object.keys(req.original).length > 0;
  const before = (k: string) => (hasOriginal && k in req.original! ? req.original![k] : product[k]);
  const keys = Object.keys(changes).filter((k) => !HIDDEN.has(k));
  const order = new Map(PRODUCT_FIELDS.map((f, i) => [f.key, i]));
  keys.sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));
  const out: FieldChange[] = [];
  for (const k of keys) {
    if (sameValue(k, before(k), changes[k])) continue;
    out.push({
      key: k,
      label: PRODUCT_FIELDS.find((f) => f.key === k)?.label ?? k,
      before: resolve(k, normValue(k, before(k))),
      after: resolve(k, normValue(k, changes[k])),
    });
  }
  const oldName = String(before("name") ?? product.name ?? "");
  const nameCh = out.find((c) => c.key === "name");
  const newName = nameCh ? String(changes.name ?? "") : null;
  const flags: DiffFlag[] = [];
  if (product.updated_at && new Date(product.updated_at).getTime() > new Date(req.created_at).getTime()) flags.push("changed_since");
  if (out.length === 0) flags.push("no_change");
  if (newName && looksLikeInstruction(newName)) flags.push("instruction_name");
  if (/^\[MERGED\]/i.test(product.name)) flags.push("merged_target");
  return {
    kind: "edit",
    productName: product.name,
    oldName,
    newName,
    changes: out,
    unchangedCount: Math.max(0, keys.length - out.length),
    flags,
    beforeSource: hasOriginal ? "original" : "live",
  };
}

// ---------------- Merge ----------------

export interface StockLine {
  warehouse: string;
  qty: number;
}
export interface MergeSide {
  id: string;
  name: string;
  rate: number | null;
  stock: StockLine[];
  total: number;
}
export interface MergeRow {
  warehouse: string;
  now: number;
  incoming: number;
  after: number;
}
export type MergeFlag = "self_merge" | "rate_diff" | "snapshot_diff";
export interface MergePanel {
  kind: "merge";
  source: MergeSide;
  target: MergeSide;
  rows: MergeRow[];
  totals: { now: number; incoming: number; after: number };
  flags: MergeFlag[];
  snapshotTotal: number | null;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function sumStock(lines: StockLine[]): StockLine[] {
  const m = new Map<string, number>();
  for (const l of lines) m.set(l.warehouse, r3((m.get(l.warehouse) ?? 0) + Number(l.qty || 0)));
  return [...m.entries()].map(([warehouse, qty]) => ({ warehouse, qty }));
}

export function isSelfMerge(sourceId: string, targetId: string): boolean {
  if (sourceId && sourceId === targetId) return true;
  return false;
}

export function buildMergePanel(
  source: { id: string; name: string; rate: number | string | null; stock: StockLine[] },
  target: { id: string; name: string; rate: number | string | null; stock: StockLine[] },
  snapshot?: { qty: number }[] | null,
): MergePanel {
  const s = sumStock(source.stock);
  const t = sumStock(target.stock);
  const side = (x: typeof source, st: StockLine[]): MergeSide => ({
    id: x.id,
    name: x.name,
    rate: x.rate == null || x.rate === "" ? null : Number(x.rate),
    stock: st,
    total: r3(st.reduce((a, b) => a + b.qty, 0)),
  });
  const S = side(source, s);
  const T = side(target, t);
  const whs = [...new Set([...t.map((l) => l.warehouse), ...s.map((l) => l.warehouse)])];
  const self = isSelfMerge(source.id, target.id);
  const rows = whs.map((w) => {
    const now = t.find((l) => l.warehouse === w)?.qty ?? 0;
    const incoming = self ? 0 : s.find((l) => l.warehouse === w)?.qty ?? 0;
    return { warehouse: w, now, incoming, after: r3(now + incoming) };
  });
  const totals = {
    now: r3(rows.reduce((a, r) => a + r.now, 0)),
    incoming: r3(rows.reduce((a, r) => a + r.incoming, 0)),
    after: r3(rows.reduce((a, r) => a + r.after, 0)),
  };
  const flags: MergeFlag[] = [];
  if (self) flags.push("self_merge");
  if (!self && S.rate != null && T.rate != null && Math.abs(S.rate - T.rate) > 0.0001) flags.push("rate_diff");
  const snapshotTotal = Array.isArray(snapshot) ? r3(snapshot.reduce((a, b) => a + Number(b.qty || 0), 0)) : null;
  if (!self && snapshotTotal != null && Math.abs(snapshotTotal - S.total) > 0.0001) flags.push("snapshot_diff");
  return { kind: "merge", source: S, target: T, rows, totals, flags, snapshotTotal };
}

export type ProductPendingExtra = ProductEditDiff | MergePanel;

/** Mockup ke chip: "Stock 1 + 6 = 7" */
export function mergeChip(p: MergePanel): string {
  return `${fmtQty(p.source.total)} + ${fmtQty(p.target.total)} = ${fmtQty(p.flags.includes("self_merge") ? p.target.total : p.totals.after)}`;
}
export function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
export function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "✓" : "✕";
  return String(v);
}
