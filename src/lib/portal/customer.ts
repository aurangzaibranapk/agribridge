/**
 * Customer Portal (Phase 5) -- pure helpers, koi DB call nahi.
 * Data 572/573 ke functions se aata hai (sirf apna; koi kharid ki qeemat nahi).
 */
import type { StatementRow } from "./khata";

export const TERMS_VERSION = "v3";
export const METHODS = ["cash", "bank", "jazzcash", "easypaisa", "cheque"] as const;
export type Method = (typeof METHODS)[number];
export const CHANGE_FIELDS = ["address", "business_name", "email", "phone", "cnic", "contact_person"] as const;
export type ChangeField = (typeof CHANGE_FIELDS)[number];
export const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
/** Server action ki had ~1 MB -- is liye 900 KB (bucket 5 MB tak leta hai). */
export const PROOF_MAX_BYTES = 900_000;

const num = (v: unknown): number => { const x = Number(v ?? 0); return Number.isFinite(x) ? x : 0; };
const str = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

export interface CustomerRec {
  id: string; code: string; name: string; business_name: string | null; customer_type: string | null; branch: string | null;
  phone: string | null; cnic: string | null; email: string | null; address: string | null; contact_person: string | null;
  credit_limit: number; payment_due_days: number | null; overdue_block_days: number | null; is_active: boolean; has_phone: boolean;
  farmer_code: string | null; terms_version: string | null; terms_at: string | null;
}
export interface CustomerProfile { customers: CustomerRec[]; farmer_linked: boolean }
export function parseProfile(raw: unknown): CustomerProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const customers = arr(r.customers).map((c) => ({
    id: String(c.id), code: String(c.code ?? ""), name: String(c.name ?? ""), business_name: str(c.business_name), customer_type: str(c.customer_type),
    branch: str(c.branch), phone: str(c.phone), cnic: str(c.cnic), email: str(c.email), address: str(c.address), contact_person: str(c.contact_person),
    credit_limit: num(c.credit_limit), payment_due_days: c.payment_due_days == null ? null : num(c.payment_due_days),
    overdue_block_days: c.overdue_block_days == null ? null : num(c.overdue_block_days), is_active: c.is_active !== false, has_phone: !!c.has_phone,
    farmer_code: str(c.farmer_code), terms_version: str(c.terms_version), terms_at: str(c.terms_at),
  }));
  return customers.length ? { customers, farmer_linked: !!r.farmer_linked } : null;
}
/** Portal ka darwaza: naam + mobile ho to profile mukammal. */
export function profileComplete(c: CustomerRec | null | undefined): boolean {
  return !!c && c.name.trim().length > 0 && c.has_phone;
}

export interface BillItem { name: string; qty: number; rate: number; amount: number }
export interface Bill { id: string; ref: string; date: string; total: number; cash: number; khata: number; mode: string | null; status: string; items: BillItem[] }
export function parseBills(raw: unknown): Bill[] {
  return arr(raw).map((b) => ({
    id: String(b.id), ref: String(b.ref ?? ""), date: String(b.date ?? "").slice(0, 10), total: num(b.total), cash: num(b.cash), khata: num(b.khata),
    mode: str(b.mode), status: String(b.status ?? "completed"),
    items: arr(b.items).map((i) => ({ name: String(i.name ?? "—"), qty: num(i.qty), rate: num(i.rate), amount: num(i.amount) })),
  }));
}
export interface OrderSteps { placed: boolean; sales: boolean; finance: boolean; approved: boolean; delivered: boolean }
export interface Order {
  id: string; number: string; date: string; type: string | null; subtotal: number; discount: number; freight: number; grand_total: number;
  payment_terms: string | null; due_date: string | null; status: string; steps: OrderSteps; rejected: boolean;
  items: { name: string; pack: string | null; qty: number; rate: number; amount: number }[];
}
export function parseOrders(raw: unknown): Order[] {
  return arr(raw).map((o) => {
    const s = (o.steps ?? {}) as Record<string, unknown>;
    return {
      id: String(o.id), number: String(o.number ?? "—"), date: String(o.date ?? "").slice(0, 10), type: str(o.type), subtotal: num(o.subtotal),
      discount: num(o.discount), freight: num(o.freight), grand_total: num(o.grand_total), payment_terms: str(o.payment_terms), due_date: str(o.due_date),
      status: String(o.status ?? ""), rejected: !!o.rejected,
      steps: { placed: true, sales: !!s.sales, finance: !!s.finance, approved: !!s.approved, delivered: !!s.delivered },
      items: arr(o.items).map((i) => ({ name: String(i.name ?? "—"), pack: str(i.pack), qty: num(i.qty), rate: num(i.rate), amount: num(i.amount) })),
    };
  });
}
/** Kitne marhale poore (1..5) -- tracking ke liye. */
export function stepIndex(s: OrderSteps): number {
  return [s.placed, s.sales, s.finance, s.approved, s.delivered].filter(Boolean).length;
}
export function orderOpen(o: Order): boolean { return !o.rejected && !o.steps.delivered; }

export interface ReturnRow { kind: string; ref: string; date: string; amount: number; status: string }
export function parseReturns(raw: unknown): ReturnRow[] {
  return arr(raw).map((r) => ({ kind: String(r.kind ?? "pos"), ref: String(r.ref ?? ""), date: String(r.date ?? "").slice(0, 10), amount: num(r.amount), status: String(r.status ?? "") }));
}
export interface PromiseRow { id: string; date: string; amount: number; fulfilled: number; status: string; channel: string | null }
export function parsePromises(raw: unknown): PromiseRow[] {
  return arr(raw).map((p) => ({ id: String(p.id), date: String(p.date ?? "").slice(0, 10), amount: num(p.amount), fulfilled: num(p.fulfilled), status: String(p.status ?? "open"), channel: str(p.channel) }));
}
/** Wade ki dikhne wali haalat: kept / partly / broken / open. */
export function promiseState(p: PromiseRow): "open" | "kept" | "partly" | "broken" {
  if (p.status === "open") return "open";
  if (p.fulfilled >= p.amount && p.amount > 0) return "kept";
  if (p.fulfilled > 0) return "partly";
  return p.status === "kept" || p.status === "fulfilled" ? "kept" : "broken";
}
export function promisesKept(rows: PromiseRow[]): { kept: number; closed: number } {
  const closed = rows.filter((p) => promiseState(p) !== "open");
  return { kept: closed.filter((p) => promiseState(p) === "kept").length, closed: closed.length };
}
export interface PaymentRow { date: string; ref: string | null; kind: string; amount: number }
export function parsePayments(raw: unknown): PaymentRow[] {
  return arr(raw).map((p) => ({ date: String(p.date ?? "").slice(0, 10), ref: str(p.ref), kind: String(p.kind ?? ""), amount: num(p.amount) }));
}

export interface Requests {
  claims: { id: string; amount: number; method: string; reference: string | null; paid_on: string; status: string; created_at: string; has_proof: boolean; reject_reason: string | null }[];
  changes: { id: string; field: string; new_value: string; status: string; created_at: string; reject_reason: string | null }[];
  disputes: { id: string; ref: string | null; message: string; status: string; created_at: string; staff_note: string | null }[];
  promises: { id: string; amount: number; promise_date: string; status: string; created_at: string; reject_reason: string | null }[];
}
export function parseRequests(raw: unknown): Requests {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    claims: arr(r.claims).map((c) => ({ id: String(c.id), amount: num(c.amount), method: String(c.method), reference: str(c.reference), paid_on: String(c.paid_on ?? "").slice(0, 10), status: String(c.status), created_at: String(c.created_at ?? ""), has_proof: !!c.has_proof, reject_reason: str(c.reject_reason) })),
    changes: arr(r.changes).map((c) => ({ id: String(c.id), field: String(c.field), new_value: String(c.new_value ?? ""), status: String(c.status), created_at: String(c.created_at ?? ""), reject_reason: str(c.reject_reason) })),
    disputes: arr(r.disputes).map((c) => ({ id: String(c.id), ref: str(c.ref), message: String(c.message ?? ""), status: String(c.status), created_at: String(c.created_at ?? ""), staff_note: str(c.staff_note) })),
    promises: arr(r.promises).map((c) => ({ id: String(c.id), amount: num(c.amount), promise_date: String(c.promise_date ?? "").slice(0, 10), status: String(c.status), created_at: String(c.created_at ?? ""), reject_reason: str(c.reject_reason) })),
  };
}

// ---------- hisaab ----------
const ym = (d: string) => d.slice(0, 7);
export function addMonthsYm(y: string, n: number): string {
  const [Y, M] = y.split("-").map(Number);
  const t = Y * 12 + (M - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
/** 12 maheene: khareedari (udhaar) aur adaigi -- khata ki lakeeron se. */
export function monthlySeries(rows: StatementRow[], asOf: string, months = 12): { month: string; buy: number; paid: number }[] {
  const end = ym(asOf);
  const keys = Array.from({ length: months }, (_, i) => addMonthsYm(end, i - (months - 1)));
  const map = new Map(keys.map((k) => [k, { month: k, buy: 0, paid: 0 }]));
  for (const r of rows) {
    if (r.is_opening || !r.entry_date) continue;
    const m = map.get(ym(r.entry_date));
    if (!m) continue;
    m.buy += r.udhaar;
    m.paid += r.adaigi;
  }
  return keys.map((k) => map.get(k)!);
}
export function monthTotals(bills: Bill[], payments: PaymentRow[], asOf: string) {
  const m = ym(asOf);
  const mb = bills.filter((b) => b.date.startsWith(m));
  const mp = payments.filter((p) => p.date.startsWith(m));
  return {
    buy: mb.reduce((a, b) => a + b.total, 0), bills: mb.length,
    products: new Set(mb.flatMap((b) => b.items.map((i) => i.name))).size,
    paid: mp.reduce((a, p) => a + p.amount, 0), payments: mp.length, lastPaid: payments[0]?.date ?? null,
  };
}
/** Credit limit ka istemal (0..100), had 0 ho to null. */
export function limitUsedPct(owed: number, limit: number): number | null {
  if (!(limit > 0)) return null;
  return Math.max(0, Math.min(100, Math.round((Math.max(0, owed) / limit) * 100)));
}
export function rs(n: number): string {
  const v = Math.round(Math.abs(n));
  return `${n < 0 ? "-" : ""}Rs ${v.toLocaleString("en-IN")}`;
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

// ---------- form validation ----------
type V<T> = { ok: true; value: T } | { ok: false; error: string };
const s = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export function addDaysIso(d: string, n: number): string {
  const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10);
}
export function validateClaim(fd: FormData, today: string): V<{ amount: number; method: Method; paid_on: string; reference: string | null; note: string | null }> {
  const amount = Number(s(fd.get("amount")).replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return { ok: false, error: "pc_err_amount" };
  const method = s(fd.get("method")) as Method;
  if (!(METHODS as readonly string[]).includes(method)) return { ok: false, error: "pc_err_generic" };
  const paid_on = s(fd.get("paid_on")) || today;
  if (!ISO.test(paid_on) || paid_on > today || paid_on < addDaysIso(today, -90)) return { ok: false, error: "pc_err_date" };
  return { ok: true, value: { amount: Math.round(amount * 100) / 100, method, paid_on, reference: s(fd.get("reference")).slice(0, 80) || null, note: s(fd.get("note")).slice(0, 300) || null } };
}
export function proofOk(f: { size: number; type: string } | null | undefined): boolean {
  return !!f && f.size > 0 && f.size <= PROOF_MAX_BYTES && PROOF_TYPES.includes(f.type);
}
export function proofPath(customerId: string, id: string, type: string): string {
  const ext = type === "application/pdf" ? "pdf" : type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  return `${customerId}/${id}.${ext}`;
}
export function validatePromise(fd: FormData, today: string): V<{ amount: number; promise_date: string }> {
  if (fd.get("accept") !== "on") return { ok: false, error: "pc_err_terms" };
  const amount = Number(s(fd.get("amount")).replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return { ok: false, error: "pc_err_amount" };
  const d = s(fd.get("promise_date"));
  if (!ISO.test(d) || d < today || d > addDaysIso(today, 30)) return { ok: false, error: "pc_err_promise_date" };
  return { ok: true, value: { amount: Math.round(amount * 100) / 100, promise_date: d } };
}
export function validateChange(fd: FormData): V<{ field: ChangeField; value: string }> {
  const field = s(fd.get("field")) as ChangeField;
  const value = s(fd.get("value"));
  if (!(CHANGE_FIELDS as readonly string[]).includes(field) || !value || value.length > 300) return { ok: false, error: "pc_err_field" };
  if (field === "phone" && !/^\+?[0-9 -]{10,16}$/.test(value)) return { ok: false, error: "pc_err_field" };
  if (field === "cnic" && !/^[0-9]{13}$/.test(value.replace(/\D/g, ""))) return { ok: false, error: "pc_err_field" };
  if (field === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return { ok: false, error: "pc_err_field" };
  return { ok: true, value: { field, value } };
}
export function validateDispute(fd: FormData): V<{ ref: string | null; message: string }> {
  const message = s(fd.get("message"));
  if (message.length < 3 || message.length > 500) return { ok: false, error: "pc_err_text" };
  return { ok: true, value: { ref: s(fd.get("ref")).slice(0, 60) || null, message } };
}
/** DB ka paigham -> hamari chaabi (gahak ko khaam error nahi dikhana). */
export function dbErrorKey(msg: string | null | undefined): string {
  const m = String(msg ?? "");
  if (/had poori/i.test(m)) return "pc_err_limit";
  if (/pehle se/i.test(m)) return "pc_err_dup";
  if (/Tareekh/i.test(m)) return "pc_err_date";
  if (/30 din/i.test(m)) return "pc_err_promise_date";
  if (/Sharaait/i.test(m)) return "pc_err_terms";
  if (/Raqam/i.test(m)) return "pc_err_amount";
  if (/Phone|CNIC|Email|Nayi/i.test(m)) return "pc_err_field";
  return "pc_err_generic";
}

// ---------- admin ----------
export interface AdminCust {
  id: string; code: string; name: string; business_name: string | null; farmer_code: string | null; branch: string | null;
  balance: number; credit_limit: number; has_phone: boolean; portal: "none" | "active" | "suspended"; last_seen: string | null; pending: number;
}
export function parseAdminCustomers(raw: unknown): AdminCust[] {
  return arr(raw).map((c) => ({
    id: String(c.id), code: String(c.code ?? ""), name: String(c.name ?? ""), business_name: str(c.business_name), farmer_code: str(c.farmer_code),
    branch: str(c.branch), balance: num(c.balance), credit_limit: num(c.credit_limit), has_phone: !!c.has_phone,
    portal: (["none", "active", "suspended"].includes(String(c.portal)) ? c.portal : "none") as AdminCust["portal"],
    last_seen: str(c.last_seen), pending: num(c.pending),
  }));
}
export function adminFilter(rows: AdminCust[], f: string, q: string): AdminCust[] {
  let out = rows;
  if (f === "on") out = out.filter((r) => r.portal === "active");
  if (f === "over") out = out.filter((r) => r.credit_limit > 0 && r.balance > r.credit_limit);
  if (f === "shop") out = out.filter((r) => !r.farmer_code);
  const t = q.trim().toLowerCase();
  if (t) out = out.filter((r) => `${r.code} ${r.name} ${r.business_name ?? ""} ${r.farmer_code ?? ""} ${r.branch ?? ""}`.toLowerCase().includes(t));
  return out;
}
export function adminKpis(rows: AdminCust[]) {
  return {
    total: rows.length, farmer: rows.filter((r) => r.farmer_code).length, shop: rows.filter((r) => !r.farmer_code).length,
    active: rows.filter((r) => r.portal === "active").length, noLogin: rows.filter((r) => r.portal === "none").length,
    pending: rows.reduce((a, r) => a + r.pending, 0),
    over: rows.filter((r) => r.credit_limit > 0 && r.balance > r.credit_limit).length,
    overAmt: rows.filter((r) => r.credit_limit > 0 && r.balance > r.credit_limit).reduce((a, r) => a + r.balance, 0),
  };
}
export interface QueueItem {
  kind: "claim" | "change" | "promise" | "dispute"; id: string; customer_id: string; customer: string; code: string; amount: number | null;
  detail: string; date: string; status: string; has_proof: boolean; proof_path: string | null; can_check: boolean; can_approve: boolean;
}
export function parseQueue(raw: unknown): QueueItem[] {
  return arr(raw).map((q) => ({
    kind: (["claim", "change", "promise", "dispute"].includes(String(q.kind)) ? q.kind : "claim") as QueueItem["kind"], id: String(q.id),
    customer_id: String(q.customer_id), customer: String(q.customer ?? ""), code: String(q.code ?? ""), amount: q.amount == null ? null : num(q.amount),
    detail: String(q.detail ?? ""), date: String(q.date ?? "").slice(0, 10), status: String(q.status ?? ""), has_proof: !!q.has_proof,
    proof_path: str(q.proof_path), can_check: !!q.can_check, can_approve: !!q.can_approve,
  }));
}
/** Invite ka namoona -- sirf preview; bhejna owner ki manzoori tak band. */
export function invitePreview(template: string, name: string, url: string): string {
  return template.replace("{name}", name || "").replace("{url}", url);
}
