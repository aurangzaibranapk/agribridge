import { BILL_QISMEIN, HALAT_LABEL, KHARCHA_QISMEIN, billQismKaLabel, qismDhoondein } from "../kharche";

/**
 * Kharchon ki report — company_expense_requests.
 *
 * P&L sirf manzoor journal parhta hai. Yahan pending, tasdeeq, manzoor
 * aur radd sab ek filter mein hain. Asal kharcha (nafa se katne wala)
 * default hai; supplier ki adaigi aur advance alag qism hain.
 *
 * Jis khane par dukan / shaakh / khata likha hi nahi, wo sifar nahi.
 * Alag naam: "dukan likhi nahi". Naam ki fehrist na mile to "naam nahi mila".
 */

export const EXPENSE_REPORT_PATH = "/admin/reports/expenses";
export const EXPENSE_EXPORT_PATH = "/admin/reports/expenses/export";
export const PAGE_SIZE = 50;
export const FETCH_CAP = 20000;
export const MISSING = "__none__";

export const EXPENSE_STATUSES = ["pending", "verified", "approved", "rejected"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const ASAL_KIND_VALUES: readonly string[] = KHARCHA_QISMEIN.filter((q) => q.asalKharcha).map((q) => q.value);

export const SHOP_UNTRACKED = "dukan likhi nahi";
export const BRANCH_UNTRACKED = "shaakh likhi nahi";
export const BANK_UNTRACKED = "khata chuna nahi";
export const CATEGORY_UNTRACKED = "qism likhi nahi";
export const NAME_MISSING = "naam nahi mila";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function nextIsoDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

export function yearStart(today: string): string {
  return `${today.slice(0, 4)}-01-01`;
}

export interface ExpenseReportFilters {
  from: string;
  to: string;
  branchId: string;
  shopId: string;
  category: string;
  bankId: string;
  status: string;
  /** asal | all | ek kharcha qism */
  kind: string;
  page: number;
}

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function cleanId(value: string): string {
  const v = value.trim();
  if (!v || v === "all") return "";
  if (v === MISSING) return MISSING;
  return UUID.test(v) ? v : "";
}

export function parseExpenseFilters(
  raw: Record<string, string | string[] | undefined> | undefined,
  today: string,
): ExpenseReportFilters {
  const src = raw ?? {};
  const todayOk = isIsoDate(today) ? today : "2026-01-01";
  let from = one(src.from).trim();
  let to = one(src.to).trim();
  if (!isIsoDate(from)) from = yearStart(todayOk);
  if (!isIsoDate(to)) to = todayOk;
  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  const kindRaw = one(src.kind).trim();
  const known = new Set(KHARCHA_QISMEIN.map((q) => q.value));
  const kind = kindRaw === "all" || kindRaw === "asal" || known.has(kindRaw) ? kindRaw || "asal" : "asal";
  const statusRaw = one(src.status).trim();
  const status = (EXPENSE_STATUSES as readonly string[]).includes(statusRaw) ? statusRaw : "";
  let page = Number.parseInt(one(src.page), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (page > 100000) page = 100000;
  return {
    from,
    to,
    branchId: cleanId(one(src.branch)),
    shopId: cleanId(one(src.shop)),
    category: one(src.category).replace(/[\u0000-\u001f]/g, "").trim().slice(0, 80),
    bankId: cleanId(one(src.bank)),
    status,
    kind,
    page,
  };
}

export interface ReportScope {
  unrestricted: boolean;
  scope: "all" | "own_branch" | "own_shop" | "own_records";
  branchId: string | null;
  shopId: string | null;
}

export type ScopeResult =
  | { ok: true; filters: ExpenseReportFilters; lockBranch: boolean; lockShop: boolean }
  | { ok: false; reason: "no_branch" | "no_shop" };

/**
 * Manager apni shaakh. own_shop par apni dukan. Shaakh/dukan lagi hi
 * na ho to poori company mat kholo — khali fehrist sifar jhoot hoti.
 */
export function resolveReportScope(filters: ExpenseReportFilters, scope: ReportScope): ScopeResult {
  if (scope.unrestricted || scope.scope === "all") {
    return { ok: true, filters, lockBranch: false, lockShop: false };
  }
  if (scope.scope === "own_shop") {
    if (!scope.shopId) return { ok: false, reason: "no_shop" };
    return {
      ok: true,
      lockBranch: Boolean(scope.branchId),
      lockShop: true,
      filters: {
        ...filters,
        branchId: scope.branchId ?? "",
        shopId: scope.shopId,
      },
    };
  }
  if (!scope.branchId) return { ok: false, reason: "no_branch" };
  return {
    ok: true,
    lockBranch: true,
    lockShop: false,
    filters: { ...filters, branchId: scope.branchId },
  };
}

export interface IdSpec {
  mode: "eq" | "none" | "all";
  id?: string;
}

export interface ExpenseQueryPlan {
  dateOr: string;
  branch: IdSpec;
  shop: IdSpec;
  bank: IdSpec;
  category: string | null;
  status: string | null;
  /** null = tamam qismein */
  kinds: string[] | null;
}

function idSpec(id: string): IdSpec {
  if (!id) return { mode: "all" };
  if (id === MISSING) return { mode: "none" };
  return { mode: "eq", id };
}

export function dateOrFilter(from: string, to: string): string {
  const start = `${from}T00:00:00`;
  const end = `${nextIsoDay(to)}T00:00:00`;
  return `and(expense_date.gte.${from},expense_date.lte.${to}),and(expense_date.is.null,created_at.gte."${start}",created_at.lt."${end}")`;
}

export function undatedOutsideOr(from: string, to: string): string {
  const start = `${from}T00:00:00`;
  const end = `${nextIsoDay(to)}T00:00:00`;
  return `created_at.lt."${start}",created_at.gte."${end}"`;
}

export function expenseQueryPlan(filters: ExpenseReportFilters): ExpenseQueryPlan {
  const kinds = filters.kind === "all" ? null : filters.kind === "asal" ? [...ASAL_KIND_VALUES] : [filters.kind];
  return {
    dateOr: dateOrFilter(filters.from, filters.to),
    branch: idSpec(filters.branchId),
    shop: idSpec(filters.shopId),
    bank: idSpec(filters.bankId),
    category: filters.category || null,
    status: filters.status || null,
    kinds,
  };
}

export interface ExpenseFilterChain {
  eq(column: string, value: string): this;
  in(column: string, values: readonly string[]): this;
  is(column: string, value: null): this;
  or(filters: string): this;
}

function applyId<T extends ExpenseFilterChain>(q: T, column: string, spec: IdSpec): T {
  if (spec.mode === "none") return q.is(column, null);
  if (spec.mode === "eq" && spec.id) return q.eq(column, spec.id);
  return q;
}

/** Shaakh, dukan, khata, qism, halat, category — tareekh ke baghair. */
export function applyExpenseScope<T extends ExpenseFilterChain>(q: T, plan: ExpenseQueryPlan): T {
  let next = applyId(q, "branch_id", plan.branch);
  next = applyId(next, "shop_id", plan.shop);
  next = applyId(next, "paid_from_account_id", plan.bank);
  if (plan.category) next = next.eq("category", plan.category);
  if (plan.status) next = next.eq("status", plan.status);
  if (plan.kinds) next = next.in("kind", plan.kinds);
  return next;
}

export function applyExpenseFilters<T extends ExpenseFilterChain>(q: T, plan: ExpenseQueryPlan): T {
  return applyExpenseScope(q.or(plan.dateOr), plan);
}

export interface RawExpense {
  id: string;
  expense_number?: string | null;
  kind?: string | null;
  category?: string | null;
  amount?: number | string | null;
  description?: string | null;
  status?: string | null;
  expense_date?: string | null;
  created_at?: string | null;
  party_name?: string | null;
  shop_id?: string | null;
  branch_id?: string | null;
  paid_from_account_id?: string | null;
}

export interface NameMaps {
  shops: Map<string, string>;
  branches: Map<string, string>;
  banks: Map<string, string>;
}

export interface ExpenseLine {
  id: string;
  expenseNumber: string;
  expenseDate: string | null;
  createdAt: string | null;
  kind: string;
  kindLabel: string;
  category: string;
  categoryLabel: string;
  shopId: string | null;
  shopName: string | null;
  shopRecorded: boolean;
  branchId: string | null;
  branchName: string | null;
  branchRecorded: boolean;
  bankId: string | null;
  bankName: string | null;
  bankRecorded: boolean;
  partyName: string | null;
  description: string;
  status: string;
  amount: number | null;
  asalKharcha: boolean;
}

export function readAmount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function place(id: string | null | undefined, map: Map<string, string>): { id: string | null; name: string | null; recorded: boolean } {
  if (!id) return { id: null, name: null, recorded: false };
  const raw = map.get(id);
  const name = raw != null && raw.trim() ? raw.trim() : null;
  return { id, name, recorded: true };
}

export function mapExpenseRow(row: RawExpense, names: NameMaps): ExpenseLine {
  const kind = String(row.kind ?? "kharcha");
  const qism = qismDhoondein(kind);
  const shop = place(row.shop_id, names.shops);
  const branch = place(row.branch_id, names.branches);
  const bank = place(row.paid_from_account_id, names.banks);
  const category = String(row.category ?? "").trim();
  return {
    id: String(row.id),
    expenseNumber: String(row.expense_number ?? ""),
    expenseDate: row.expense_date ? String(row.expense_date).slice(0, 10) : null,
    createdAt: row.created_at ?? null,
    kind,
    kindLabel: qism?.label ?? kind,
    category,
    categoryLabel: billQismKaLabel(category),
    shopId: shop.id,
    shopName: shop.name,
    shopRecorded: shop.recorded,
    branchId: branch.id,
    branchName: branch.name,
    branchRecorded: branch.recorded,
    bankId: bank.id,
    bankName: bank.name,
    bankRecorded: bank.recorded,
    partyName: row.party_name ?? null,
    description: String(row.description ?? ""),
    status: String(row.status ?? ""),
    amount: readAmount(row.amount),
    asalKharcha: qism?.asalKharcha === true,
  };
}

export function placeLabel(id: string | null, name: string | null, missing: string): string {
  if (!id) return missing;
  if (!name) return NAME_MISSING;
  return name;
}

export type GroupDim = "shop" | "category" | "bank" | "status";

export interface ExpenseGroupRow {
  key: string;
  label: string;
  count: number;
  amount: number;
  gap: number;
  recorded: boolean;
}

function groupSlot(line: ExpenseLine, dim: GroupDim): { key: string; label: string; recorded: boolean } {
  if (dim === "shop") {
    if (!line.shopId) return { key: "untracked", label: SHOP_UNTRACKED, recorded: false };
    if (!line.shopName) return { key: `missing:${line.shopId}`, label: NAME_MISSING, recorded: true };
    return { key: line.shopId, label: line.shopName, recorded: true };
  }
  if (dim === "bank") {
    if (!line.bankId) return { key: "untracked", label: BANK_UNTRACKED, recorded: false };
    if (!line.bankName) return { key: `missing:${line.bankId}`, label: NAME_MISSING, recorded: true };
    return { key: line.bankId, label: line.bankName, recorded: true };
  }
  if (dim === "status") {
    const key = line.status || "unknown";
    return { key, label: HALAT_LABEL[line.status] ?? (line.status || "status likhi nahi"), recorded: Boolean(line.status) };
  }
  if (!line.category) return { key: "untracked", label: CATEGORY_UNTRACKED, recorded: false };
  return { key: line.category, label: line.categoryLabel, recorded: true };
}

export function groupExpenses(lines: ExpenseLine[], dim: GroupDim): ExpenseGroupRow[] {
  const map = new Map<string, ExpenseGroupRow>();
  for (const line of lines) {
    const slot = groupSlot(line, dim);
    const prev = map.get(slot.key);
    if (!prev) {
      map.set(slot.key, {
        key: slot.key,
        label: slot.label,
        count: 1,
        amount: line.amount == null ? 0 : round2(line.amount),
        gap: line.amount == null ? 1 : 0,
        recorded: slot.recorded,
      });
      continue;
    }
    prev.count += 1;
    if (line.amount == null) prev.gap += 1;
    else prev.amount = round2(prev.amount + line.amount);
  }
  return [...map.values()].sort((a, b) => {
    if (a.recorded !== b.recorded) return a.recorded ? -1 : 1;
    return b.amount - a.amount || a.label.localeCompare(b.label);
  });
}

export function summarizeExpenses(lines: ExpenseLine[]): { count: number; amount: number; gap: number } {
  let amount = 0;
  let gap = 0;
  for (const line of lines) {
    if (line.amount == null) gap += 1;
    else amount += line.amount;
  }
  return { count: lines.length, amount: round2(amount), gap };
}

export function sumByStatus(lines: ExpenseLine[], status: ExpenseStatus): { count: number; amount: number; gap: number } {
  return summarizeExpenses(lines.filter((line) => line.status === status));
}

/** 0 par hissa nahi — "—" . Sifar hissa sirf tab jab kul raqam ho aur ye hissa 0 ho. */
export function amountShare(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole === 0) return null;
  return part / whole;
}

export function paginateLines(lines: ExpenseLine[], page: number, size = PAGE_SIZE): { page: number; pages: number; slice: ExpenseLine[] } {
  const pages = Math.max(1, Math.ceil(lines.length / size) || 1);
  const safe = Math.min(Math.max(1, page), pages);
  const start = (safe - 1) * size;
  return { page: safe, pages, slice: lines.slice(start, start + size) };
}

export function expenseReportPath(filters: ExpenseReportFilters, patch?: Partial<ExpenseReportFilters>): string {
  const f = { ...filters, ...patch };
  const p = new URLSearchParams();
  p.set("from", f.from);
  p.set("to", f.to);
  if (f.branchId) p.set("branch", f.branchId);
  if (f.shopId) p.set("shop", f.shopId);
  if (f.category) p.set("category", f.category);
  if (f.bankId) p.set("bank", f.bankId);
  if (f.status) p.set("status", f.status);
  if (f.kind && f.kind !== "asal") p.set("kind", f.kind);
  if (f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `${EXPENSE_REPORT_PATH}?${s}` : EXPENSE_REPORT_PATH;
}

export function expenseExportPath(filters: ExpenseReportFilters): string {
  const href = expenseReportPath({ ...filters, page: 1 });
  const q = href.indexOf("?");
  return `${EXPENSE_EXPORT_PATH}${q === -1 ? "" : href.slice(q)}`;
}

export const CSV_HEADERS = ["Tareekh", "EXP", "Qism", "Category", "Dukan", "Shaakh", "Banda", "Khata", "Raqam", "Halat", "Tafseel", "Asal kharcha"] as const;

export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function expenseCsv(lines: ExpenseLine[]): string {
  const rows = lines.map((line) =>
    [
      line.expenseDate ?? "tareekh likhi nahi",
      line.expenseNumber,
      line.kindLabel,
      line.categoryLabel,
      placeLabel(line.shopId, line.shopName, SHOP_UNTRACKED),
      placeLabel(line.branchId, line.branchName, BRANCH_UNTRACKED),
      line.partyName?.trim() || "banda nahi",
      placeLabel(line.bankId, line.bankName, BANK_UNTRACKED),
      line.amount == null ? "raqam nahi mili" : line.amount.toFixed(2),
      HALAT_LABEL[line.status] ?? (line.status || "status likhi nahi"),
      line.description,
      line.asalKharcha ? "haan" : "nahi",
    ]
      .map(csvCell)
      .join(","),
  );
  const groups: { title: string; dim: GroupDim }[] = [
    { title: "Dukan", dim: "shop" },
    { title: "Category", dim: "category" },
    { title: "Khata", dim: "bank" },
    { title: "Halat", dim: "status" },
  ];
  const tail: string[] = [];
  for (const g of groups) {
    tail.push("");
    tail.push(csvCell(g.title));
    tail.push(["Naam", "Qatarein", "Raqam", "Raqam nahi mili"].join(","));
    for (const row of groupExpenses(lines, g.dim)) {
      tail.push([csvCell(row.label), String(row.count), row.amount.toFixed(2), String(row.gap)].join(","));
    }
  }
  return `\uFEFF${[CSV_HEADERS.join(","), ...rows, ...tail].join("\r\n")}`;
}

export function categoryChoices(extra: string[]): { value: string; label: string }[] {
  const seen = new Set<string>();
  const out: { value: string; label: string }[] = [];
  for (const bill of BILL_QISMEIN) {
    seen.add(bill.value);
    out.push({ value: bill.value, label: bill.label });
  }
  for (const raw of extra) {
    const value = String(raw ?? "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push({ value, label: billQismKaLabel(value) });
  }
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}

export function kindChoices(): { value: string; label: string }[] {
  return KHARCHA_QISMEIN.map((q) => ({ value: q.value, label: q.label }));
}
