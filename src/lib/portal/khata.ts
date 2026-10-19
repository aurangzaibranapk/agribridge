/**
 * Kisan portal "Mera Khata" (Phase 2) -- pure hisaab, koi DB call nahi.
 * Data 565 ke fn_my_khata_summary / fn_my_khata_statement se aata hai.
 * Nishan: baqaya > 0 = kisan ne dena; < 0 = dukaan ne kisan ko dena.
 */

export const KHATA_CATEGORIES = [
  "karyana", "khaad", "vets", "dukaan", "naqad", "purana", "doodh", "gandum", "machinery", "qist", "adaigi", "deegar",
] as const;
export type KhataCategory = (typeof KHATA_CATEGORIES)[number];

/** Dukaan ke khane -- mockup ka "Dukaan ka udhaar" card in sab ka jor hai. */
export const SHOP_CATEGORIES: readonly string[] = ["karyana", "khaad", "vets", "dukaan", "naqad", "purana", "adaigi"];

export interface CategoryRow { category: string; udhaar: number; adaigi: number; balance: number; count: number }
export interface Aging { d0_15: number; d16_30: number; d31_60: number; d60_plus: number; oldest_days: number | null }
export interface Promise_ { amount: number; fulfilled: number; date: string; status: string; days_left: number; channel: string | null; created_at: string | null }
export interface KhataSummary {
  as_of: string;
  owed: number;
  by_category: CategoryRow[];
  aging: Aging;
  promise: Promise_ | null;
  credit_limit: number;
  score: { score: number | null; band: string | null; state: string | null; snapshot_date: string | null } | null;
  level: string | null;
  qist: { plans: number; remaining: number; next_due: string | null } | null;
  last_payment: { date: string; amount: number } | null;
  has_farmer: boolean;
  customer_count: number;
}
export interface StatementRow {
  entry_date: string | null;
  ref: string | null;
  category: string;
  kind: string;
  tafseel: string;
  udhaar: number;
  adaigi: number;
  baqaya: number;
  is_opening: boolean;
}

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

/** RPC ka jsonb (numeric strings ke saath) -> saaf types. null = koi khata nahi. */
export function parseSummary(raw: unknown): KhataSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, any>;
  const ag = r.aging ?? {};
  return {
    as_of: String(r.as_of ?? ""),
    owed: num(r.owed),
    by_category: (Array.isArray(r.by_category) ? r.by_category : []).map((c: any) => ({
      category: String(c.category), udhaar: num(c.udhaar), adaigi: num(c.adaigi), balance: num(c.balance), count: num(c.count),
    })),
    aging: {
      d0_15: num(ag.d0_15), d16_30: num(ag.d16_30), d31_60: num(ag.d31_60), d60_plus: num(ag.d60_plus),
      oldest_days: ag.oldest_days == null ? null : num(ag.oldest_days),
    },
    promise: r.promise
      ? {
          amount: num(r.promise.amount), fulfilled: num(r.promise.fulfilled), date: String(r.promise.date),
          status: String(r.promise.status ?? "open"), days_left: num(r.promise.days_left),
          channel: r.promise.channel ?? null, created_at: r.promise.created_at ?? null,
        }
      : null,
    credit_limit: num(r.credit_limit),
    score: r.score ? { score: r.score.score ?? null, band: r.score.band ?? null, state: r.score.state ?? null, snapshot_date: r.score.snapshot_date ?? null } : null,
    level: r.level ?? null,
    qist: r.qist ? { plans: num(r.qist.plans), remaining: num(r.qist.remaining), next_due: r.qist.next_due ?? null } : null,
    last_payment: r.last_payment ? { date: String(r.last_payment.date), amount: num(r.last_payment.amount) } : null,
    has_farmer: !!r.has_farmer,
    customer_count: num(r.customer_count),
  };
}

export function parseStatement(raw: unknown): StatementRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r: any) => ({
    entry_date: r.entry_date ?? null,
    ref: r.ref ?? null,
    category: String(r.category ?? "deegar"),
    kind: String(r.kind ?? "udhaar"),
    tafseel: String(r.tafseel ?? ""),
    udhaar: num(r.udhaar),
    adaigi: num(r.adaigi),
    baqaya: num(r.baqaya),
    is_opening: !!r.is_opening,
  }));
}

export interface SourceCards {
  shop: number;
  milk: number;
  grain: number;
  machinery: number;
  qistRemaining: number | null;
  qistNext: string | null;
}

/** Char bare card: dukaan, doodh, gandum, qist. */
export function sourceCards(s: KhataSummary): SourceCards {
  const bal = (pred: (c: string) => boolean) =>
    s.by_category.filter((c) => pred(c.category)).reduce((a, c) => a + c.balance, 0);
  return {
    shop: bal((c) => SHOP_CATEGORIES.includes(c)),
    milk: bal((c) => c === "doodh"),
    grain: bal((c) => c === "gandum"),
    machinery: bal((c) => c === "machinery"),
    qistRemaining: s.qist && s.qist.plans > 0 ? s.qist.remaining : null,
    qistNext: s.qist?.next_due ?? null,
  };
}

/** Qism-waar fehrist -- adaigi alag, sifar wale bahar, bara pehle. */
export function breakdown(s: KhataSummary): CategoryRow[] {
  return s.by_category
    .filter((c) => c.category !== "adaigi" && (c.udhaar !== 0 || c.adaigi !== 0))
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
}

export type StatementFilter = "all" | "udhaar" | "adaigi" | "doodh" | "gandum";
export const STATEMENT_FILTERS: StatementFilter[] = ["all", "udhaar", "adaigi", "doodh", "gandum"];

export function filterStatement(rows: StatementRow[], f: StatementFilter): StatementRow[] {
  if (f === "all") return rows;
  return rows.filter((r) => {
    if (r.is_opening) return true;
    if (f === "udhaar") return r.udhaar > 0 && r.category !== "doodh";
    if (f === "adaigi") return r.adaigi > 0 && r.category !== "doodh" && r.category !== "gandum";
    return r.category === f;
  });
}

export interface StatementTotals { opening: number; udhaar: number; adaigi: number; closing: number }
export function statementTotals(rows: StatementRow[]): StatementTotals {
  const open = rows.find((r) => r.is_opening);
  const body = rows.filter((r) => !r.is_opening);
  const opening = open ? open.baqaya : 0;
  const udhaar = body.reduce((a, r) => a + r.udhaar, 0);
  const adaigi = body.reduce((a, r) => a + r.adaigi, 0);
  return { opening, udhaar, adaigi, closing: body.length ? body[body.length - 1].baqaya : opening };
}

/** Umar ke teen dabbe (mockup): 0-15, 16-30, 30+ -- aur har ek ka hissa %. */
export function agingBars(a: Aging) {
  const over30 = a.d31_60 + a.d60_plus;
  const total = a.d0_15 + a.d16_30 + over30;
  const p = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
  return [
    { key: "d0_15" as const, amount: a.d0_15, pct: p(a.d0_15), tone: "bg-emerald-500" },
    { key: "d16_30" as const, amount: a.d16_30, pct: p(a.d16_30), tone: "bg-amber-500" },
    { key: "d30_plus" as const, amount: over30, pct: p(over30), tone: "bg-rose-500" },
  ];
}

/** Wade ka guzra hua waqt % (bar ke liye). */
export function promiseProgress(p: Promise_, asOf: string): number {
  if (!p.created_at) return 0;
  const start = Date.parse(p.created_at.slice(0, 10));
  const end = Date.parse(p.date);
  const now = Date.parse(asOf);
  if (!(end > start)) return 100;
  return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
}

export interface CreditUse { limit: number; used: number; available: number; pct: number }
export function creditUse(s: KhataSummary): CreditUse {
  const used = Math.max(0, s.owed);
  const limit = Math.max(0, s.credit_limit);
  return { limit, used, available: Math.max(0, limit - used), pct: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0 };
}

/** ?from=&to=&f= -- ghalat tareekh chupke se hata do. */
export function parseRange(sp: Record<string, string | string[] | undefined>): { from: string | null; to: string | null; filter: StatementFilter } {
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const okDate = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);
  let from = okDate(one("from"));
  let to = okDate(one("to"));
  if (from && to && from > to) [from, to] = [to, from];
  const f = one("f");
  const filter = (STATEMENT_FILTERS as string[]).includes(f ?? "") ? (f as StatementFilter) : "all";
  return { from, to, filter };
}

/** Tez filter: is mahine, 3 mahine, saal -- PK tareekh (as_of) se. */
export function rangePresets(asOf: string) {
  const d = new Date(`${asOf}T00:00:00Z`);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const m3 = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 2, 1));
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return [
    { key: "month" as const, from: iso(monthStart), to: asOf },
    { key: "3m" as const, from: iso(m3), to: asOf },
    { key: "year" as const, from: iso(y), to: asOf },
    { key: "all" as const, from: null, to: null },
  ];
}

export function qs(params: Record<string, string | null | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : "";
}

/** Rs 10,00,000 (Pakistani grouping). */
export function rs(v: number): string {
  const sign = v < 0 ? "-" : "";
  return `${sign}Rs ${Math.round(Math.abs(v)).toLocaleString("en-IN")}`;
}

/** 565 ki Roman tafseel -> dict key (POS ki cheezon ke naam waise hi rehte hain). */
const TAFSEEL_KEYS: Record<string, string> = {
  "Adaigi": "pk_tf_adaigi", "Naqad udhaar": "pk_tf_naqad", "Purana hisaab": "pk_tf_purana", "Wapsi (return)": "pk_tf_wapsi",
  "Durusti (reversal)": "pk_tf_durusti", "Gandum / ghalla": "pk_tf_gandum", "Gandum / ghalla ki raqam": "pk_tf_gandum_raqam",
  "Qist katauti": "pk_tf_qist", "Dukaan se khareed": "pk_tf_dukaan", "Khaad udhaar": "pk_tf_khaad", "Beej udhaar": "pk_tf_beej",
  "Spray udhaar": "pk_tf_spray", "Udhaar": "pk_tf_udhaar", "Machinery": "pk_cat_machinery", "Wallet": "pk_wallet",
  "Pichhla baqaya": "pk_opening",
};
export function tafseelKey(tafseel: string): string | null {
  return TAFSEEL_KEYS[tafseel] ?? null;
}
/** "Doodh 15 L" / "Doodh ki raqam aap ko di (cash)" -- doodh ke liye chhota tarjuma. */
export function tafseelText(tafseel: string, tr: (k: string) => string, lang: string): string {
  const k = tafseelKey(tafseel);
  if (k) return tr(k);
  if (lang !== "rm") {
    const m = /^Doodh ([\d.]+) L$/.exec(tafseel);
    if (m) return lang === "ur" ? `دودھ ${m[1]} لیٹر` : `Milk ${m[1]} L`;
    const p = /^Doodh ki raqam aap ko di \((.*)\)$/.exec(tafseel);
    if (p) return lang === "ur" ? `دودھ کی رقم آپ کو دی (${p[1]})` : `Milk payment to you (${p[1]})`;
  }
  return tafseel;
}
