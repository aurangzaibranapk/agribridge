/**
 * Phone par live data: user ka JWT + maujooda RLS / RPC.
 * Naya portal route zaroori nahi. Khali RLS jawab ko Rs 0 nahi likhte.
 */

import { acceptedSupabaseUrl, clipDetail, failureLine, type FetchLike, type MobileChannel } from "./live-login";

export type LiveAuth = {
  url: string;
  anonKey: string;
  token: string;
  channel: MobileChannel;
  /** Test account sirf is_test qatarein parhta hai. Asal admin inhen chhupata hai. */
  testAccount?: boolean;
};

export type ReadScope = "live" | "test";

export type ReadResult<T> =
  | { ok: true; rows: T[] }
  | { ok: false; status: number; message: string; detail?: string };

const SALES_LIMIT = 2000;
const ITEM_LIMIT = 800;
const STOCK_LIMIT = 2000;

export function karachiDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function karachiDaySeries(days: number, now = new Date()): string[] {
  const [year, month, day] = karachiDate(now).split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const next = new Date(start);
    next.setUTCDate(start.getUTCDate() - i);
    out.push(next.toISOString().slice(0, 10));
  }
  return out;
}

export function karachiStartIso(day: string): string {
  return `${day}T00:00:00+05:00`;
}

export function rupees(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `Rs ${Math.round(value).toLocaleString("en-PK")}`;
}

export function readError(status: number, body: string, channel: MobileChannel): string {
  const denied = status === 401 || status === 403 || /42501|permission denied|row-level security/i.test(body);
  return failureLine({
    channel,
    fallback: denied ? "Is hisaab ki ijazat nahi." : "Ye fehrist nahi khuli.",
    status: status || null,
    detail: body,
  });
}

function parseArray(text: string): unknown[] | null {
  try {
    const value = JSON.parse(text) as unknown;
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export async function liveGet<T>(auth: LiveAuth, path: string, fetchImpl: FetchLike): Promise<ReadResult<T>> {
  const base = acceptedSupabaseUrl(auth.url);
  if (!base || !auth.anonKey.trim() || !auth.token.trim()) {
    return { ok: false, status: 0, message: failureLine({ channel: auth.channel, fallback: "Live read is build mein set nahi." }) };
  }
  try {
    const res = await fetchImpl(`${base}/rest/v1/${path}`, {
      method: "GET",
      headers: {
        apikey: auth.anonKey,
        authorization: `Bearer ${auth.token}`,
        accept: "application/json",
      },
    });
    const text = await res.text();
    if (res.status >= 400) return { ok: false, status: res.status, message: readError(res.status, text, auth.channel), detail: text };
    const rows = parseArray(text);
    if (!rows) return { ok: false, status: res.status, message: readError(res.status, text || "JSON nahi", auth.channel) };
    return { ok: true, rows: rows as T[] };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: failureLine({
        channel: auth.channel,
        fallback: "Network nahi mila.",
        detail: err instanceof Error ? err.message : "fetch failed",
      }),
    };
  }
}

export async function liveRpc<T>(auth: LiveAuth, name: string, body: Record<string, unknown>, fetchImpl: FetchLike): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string; detail?: string }> {
  const base = acceptedSupabaseUrl(auth.url);
  if (!base || !auth.anonKey.trim() || !auth.token.trim()) {
    return { ok: false, status: 0, message: failureLine({ channel: auth.channel, fallback: "Live read is build mein set nahi." }) };
  }
  try {
    const res = await fetchImpl(`${base}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: auth.anonKey,
        authorization: `Bearer ${auth.token}`,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (res.status >= 400) return { ok: false, status: res.status, message: readError(res.status, text, auth.channel), detail: text };
    try {
      return { ok: true, data: JSON.parse(text) as T };
    } catch {
      return { ok: false, status: res.status, message: readError(res.status, text || "JSON nahi", auth.channel) };
    }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: failureLine({
        channel: auth.channel,
        fallback: "Network nahi mila.",
        detail: err instanceof Error ? err.message : "fetch failed",
      }),
    };
  }
}

export function scopeFor(auth: LiveAuth): ReadScope {
  return auth.testAccount ? "test" : "live";
}

export function withScope(path: string, scope: ReadScope): string {
  const filter = scope === "test" ? "is_test=eq.true" : "is_test=eq.false";
  return path.includes("?") ? `${path}&${filter}` : `${path}?${filter}`;
}

/** PostgREST tab ye kehta hai jab migration 699 abhi lagi nahi. */
export function columnMissing(detail: string | undefined, column: string): boolean {
  const body = detail ?? "";
  return body.includes(column) && /does not exist|schema cache|42703|PGRST204/i.test(body);
}

export async function liveGetScoped<T>(auth: LiveAuth, path: string, fetchImpl: FetchLike, scope = scopeFor(auth)): Promise<ReadResult<T>> {
  const filtered = await liveGet<T>(auth, withScope(path, scope), fetchImpl);
  if (filtered.ok || scope === "test" || !columnMissing(filtered.detail, "is_test")) return filtered;
  return liveGet<T>(auth, path, fetchImpl);
}

export type SaleRow = { total_amount?: number | string | null; created_at?: string | null; status?: string | null; payment_mode?: string | null };
export type MilkRow = { shift?: string | null; quantity_liters?: number | string | null; field_collected_volume?: number | string | null; entry_date?: string | null; collection_date?: string | null; fat_percentage?: number | string | null; total_amount?: number | string | null; route_name?: string | null; status?: string | null };
export type AccountRow = { account_type?: string | null; current_balance?: number | string | null; is_active?: boolean | null };
export type ProductRow = { id?: string; name?: string | null; category_id?: string | null; min_stock_threshold?: number | string | null; selling_price?: number | string | null; unit?: string | null; is_available?: boolean | null };
export type InventoryRow = { product_id?: string | null; quantity_on_hand?: number | string | null };
export type CategoryRow = { id?: string; name?: string | null };
export type ItemRow = { subtotal?: number | string | null; product_id?: string | null; created_at?: string | null };

function num(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function dayOf(iso: string | null | undefined): string {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return karachiDate(date);
}

function countedSale(row: SaleRow): boolean {
  const status = String(row.status ?? "").toLowerCase();
  return status !== "void" && status !== "cancelled";
}

export function salesOnDay(rows: SaleRow[], day: string): { total: number; bills: number } {
  let total = 0;
  let bills = 0;
  for (const row of rows) {
    if (!countedSale(row) || dayOf(row.created_at) !== day) continue;
    bills += 1;
    total += num(row.total_amount);
  }
  return { total, bills };
}

export function salesByDay(rows: SaleRow[], days: string[]): { day: string; amount: number }[] {
  return days.map((day) => ({ day, amount: salesOnDay(rows, day).total }));
}

export function milkByShift(rows: MilkRow[]): { subah: number; shaam: number } {
  let subah = 0;
  let shaam = 0;
  for (const row of rows) {
    const liters = row.quantity_liters != null ? num(row.quantity_liters) : num(row.field_collected_volume);
    const shift = String(row.shift ?? "").toLowerCase();
    if (shift === "morning" || shift === "subah") subah += liters;
    else if (shift === "evening" || shift === "shaam") shaam += liters;
    else subah += liters;
  }
  return { subah, shaam };
}

export type CashPosition =
  | { state: "ok"; cash: number; bank: number; wallet: number; accounts: number }
  | { state: "empty" }
  | { state: "error"; message: string };

export function cashPosition(result: ReadResult<AccountRow>): CashPosition {
  if (!result.ok) return { state: "error", message: result.message };
  if (result.rows.length === 0) return { state: "empty" };
  let cash = 0;
  let bank = 0;
  let wallet = 0;
  for (const row of result.rows) {
    const amount = num(row.current_balance);
    const kind = String(row.account_type ?? "");
    if (kind === "cash") cash += amount;
    else if (kind === "bank") bank += amount;
    else if (kind === "mobile_wallet") wallet += amount;
  }
  return { state: "ok", cash, bank, wallet, accounts: result.rows.length };
}

export function stockAlerts(products: ProductRow[], inventory: InventoryRow[]): { name: string; qty: number; min: number }[] {
  const qty = new Map<string, number>();
  for (const row of inventory) {
    if (!row.product_id) continue;
    qty.set(row.product_id, (qty.get(row.product_id) ?? 0) + num(row.quantity_on_hand));
  }
  const alerts: { name: string; qty: number; min: number }[] = [];
  for (const product of products) {
    if (!product.id || product.min_stock_threshold == null || product.min_stock_threshold === "") continue;
    const min = num(product.min_stock_threshold);
    const have = qty.get(product.id) ?? 0;
    if (have < min) alerts.push({ name: product.name || "Product", qty: have, min });
  }
  alerts.sort((a, b) => a.qty - b.qty);
  return alerts.slice(0, 8);
}

export function categoryShare(items: ItemRow[], products: ProductRow[], categories: CategoryRow[]): { label: string; amount: number }[] {
  const categoryOf = new Map<string, string>();
  const names = new Map(categories.map((row) => [row.id, row.name || "Qism"]));
  for (const product of products) {
    if (!product.id) continue;
    categoryOf.set(product.id, product.category_id ? names.get(product.category_id) || "Qism" : "Bina qism");
  }
  const totals = new Map<string, number>();
  for (const item of items) {
    const label = item.product_id ? categoryOf.get(item.product_id) || "Bina qism" : "Bina qism";
    totals.set(label, (totals.get(label) ?? 0) + num(item.subtotal));
  }
  return [...totals.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);
}

export type PendingRow = { category?: string | null; pending?: number | null; mine_to_act?: number | null; readable?: boolean | null };
export type ActivityRow = { action?: string | null; created_at?: string | null };

export type AdminHome = {
  today: string;
  sales: { state: "ok"; total: number; bills: number; partial: boolean } | { state: "error"; message: string };
  days: { day: string; amount: number }[];
  categories: { label: string; amount: number }[];
  categoryScope: "today" | "week" | "none";
  cash: CashPosition;
  milk: { state: "ok"; subah: number; shaam: number; source: string } | { state: "error"; message: string };
  alerts: { name: string; qty: number; min: number }[];
  alertsNote: string | null;
  pending: { label: string; count: number }[];
  pendingNote: string | null;
  activity: { action: string; at: string }[];
  activityNote: string | null;
  banner: string | null;
};

export async function loadAdminHome(auth: LiveAuth, fetchImpl: FetchLike, now = new Date()): Promise<AdminHome> {
  const days = karachiDaySeries(7, now);
  const today = days[days.length - 1];
  const since = encodeURIComponent(karachiStartIso(days[0]));
  const test = auth.testAccount === true;
  const banner = test
    ? "TEST account. Sirf TEST naam ki qatarein. Asal cash, bank, bills, stock aur manzooriyan nahi dikhti. Likhai band hai."
    : null;
  const [sales, accounts, milk, route, products, inventory, categories, items, pending, activity] = await Promise.all([
    test
      ? Promise.resolve({ ok: false as const, status: 0, message: "TEST account ko asal bills nahi dikhaye jaate." })
      : liveGet<SaleRow>(auth, `pos_sales?select=total_amount,created_at,status,payment_mode&created_at=gte.${since}&order=created_at.desc&limit=${SALES_LIMIT}`, fetchImpl),
    test
      ? Promise.resolve({ ok: true as const, rows: [] as AccountRow[] })
      : liveGet<AccountRow>(auth, "finance_accounts?select=account_type,current_balance,is_active&is_active=eq.true&limit=100", fetchImpl),
    liveGetScoped<MilkRow>(auth, `milk_entries?select=shift,quantity_liters&entry_date=eq.${today}&limit=500`, fetchImpl),
    liveGetScoped<MilkRow>(auth, `milk_route_collections?select=shift,field_collected_volume&collection_date=eq.${today}&limit=200`, fetchImpl),
    test
      ? Promise.resolve({ ok: false as const, status: 0, message: "TEST stock alag nahi banaya, taake dukan ki fehrist na badle." })
      : liveGet<ProductRow>(auth, "products?select=id,name,category_id,min_stock_threshold,selling_price,unit,is_available&is_deleted=eq.false&limit=400", fetchImpl),
    test
      ? Promise.resolve({ ok: false as const, status: 0, message: "TEST stock alag nahi banaya, taake dukan ki fehrist na badle." })
      : liveGet<InventoryRow>(auth, `inventory?select=product_id,quantity_on_hand&limit=${STOCK_LIMIT}`, fetchImpl),
    test
      ? Promise.resolve({ ok: true as const, rows: [] as CategoryRow[] })
      : liveGet<CategoryRow>(auth, "categories?select=id,name&limit=200", fetchImpl),
    test
      ? Promise.resolve({ ok: true as const, rows: [] as ItemRow[] })
      : liveGet<ItemRow>(auth, `pos_sale_items?select=subtotal,product_id,created_at&created_at=gte.${since}&limit=${ITEM_LIMIT}`, fetchImpl),
    test
      ? Promise.resolve({ ok: false as const, status: 0, message: "TEST account ko asal manzooriyan nahi dikhti." })
      : liveRpc<PendingRow[] | null>(auth, "fn_admin_pending_counts", {}, fetchImpl),
    test
      ? Promise.resolve({ ok: false as const, status: 0, message: "TEST account ko asal activity nahi dikhti." })
      : liveGet<ActivityRow>(auth, "activity_logs?select=action,created_at&order=created_at.desc&limit=8", fetchImpl),
  ]);

  const todaySales = sales.ok ? salesOnDay(sales.rows, today) : null;
  const milkOk = milk.ok ? milkByShift(milk.rows) : null;
  const routeOk = route.ok ? milkByShift(route.rows) : null;
  const milkState: AdminHome["milk"] = milk.ok
    ? { state: "ok", ...milkOk!, source: "farmer entries" }
    : route.ok
      ? { state: "ok", ...routeOk!, source: "route" }
      : { state: "error", message: milk.message };

  const pendingRows = pending.ok && Array.isArray(pending.data) ? pending.data : [];
  const todayItems = items.ok ? items.rows.filter((row) => dayOf(row.created_at) === today) : [];
  const categoryRows = todayItems.some((row) => num(row.subtotal) > 0) ? todayItems : items.ok ? items.rows : [];
  const categoryScope: AdminHome["categoryScope"] = !items.ok || !products.ok ? "none" : todayItems.some((row) => num(row.subtotal) > 0) ? "today" : categoryRows.length ? "week" : "none";
  return {
    today,
    sales: sales.ok
      ? { state: "ok", total: todaySales!.total, bills: todaySales!.bills, partial: sales.rows.length >= SALES_LIMIT }
      : { state: "error", message: sales.message },
    days: sales.ok ? salesByDay(sales.rows, days) : [],
    categories: items.ok && products.ok ? categoryShare(categoryRows, products.rows, categories.ok ? categories.rows : []) : [],
    categoryScope,
    cash: cashPosition(accounts),
    milk: milkState,
    alerts: products.ok && inventory.ok ? stockAlerts(products.rows, inventory.rows) : [],
    alertsNote: !products.ok ? products.message : !inventory.ok ? inventory.message : inventory.rows.length >= STOCK_LIMIT ? "Stock ki fehrist adhoori hai." : null,
    pending: pendingRows
      .filter((row) => num(row.pending) > 0 && row.readable !== false)
      .slice(0, 6)
      .map((row) => ({ label: String(row.category || "Kaam"), count: num(row.pending) })),
    pendingNote: pending.ok ? null : pending.message,
    activity: activity.ok
      ? activity.rows.map((row) => ({ action: String(row.action || "Kaam"), at: String(row.created_at || "") }))
      : [],
    activityNote: activity.ok ? null : activity.message,
    banner,
  };
}

export type PartyRow = { id?: string; full_name?: string | null; name?: string | null; current_balance?: number | string | null };
export type PurchaseRow = { purchase_number?: string | null; purchase_date?: string | null; total_amount?: number | string | null; status?: string | null; supplier_bill_no?: string | null };
export type AttendanceRow = { attendance_date?: string | null; status?: string | null; check_in_at?: string | null; profile_id?: string | null };
export type ProfileRow = { id?: string; full_name?: string | null };
export type OrderRow = { order_number?: string | null; status?: string | null; grand_total?: number | string | null; created_at?: string | null };
export type KhataLine = { entry_date?: string | null; tafseel?: string | null; udhaar?: number | string | null; adaigi?: number | string | null; baqaya?: number | string | null; is_opening?: boolean | null; category?: string | null };
export type SalaryRow = { net_salary?: number | string | null; status?: string | null; pay_month?: number | null; pay_year?: number | null };
export type AdvanceRow = { amount?: number | string | null; status?: string | null; created_at?: string | null };

export async function searchParties(auth: LiveAuth, query: string, fetchImpl: FetchLike): Promise<{ farmers: ReadResult<PartyRow>; customers: ReadResult<PartyRow> }> {
  const q = encodeURIComponent(`*${query.trim()}*`);
  const farmerPath = query.trim()
    ? `farmers?select=id,full_name&full_name=ilike.${q}&order=full_name.asc&limit=30`
    : "farmers?select=id,full_name&order=full_name.asc&limit=30";
  const customerPath = query.trim()
    ? `customers?select=id,name,current_balance&name=ilike.${q}&order=name.asc&limit=30`
    : "customers?select=id,name,current_balance&order=name.asc&limit=30";
  const [farmers, customers] = await Promise.all([
    liveGetScoped<PartyRow>(auth, farmerPath, fetchImpl),
    liveGetScoped<PartyRow>(auth, customerPath, fetchImpl),
  ]);
  return { farmers, customers };
}

export async function loadMilkList(auth: LiveAuth, fetchImpl: FetchLike): Promise<ReadResult<MilkRow>> {
  return liveGetScoped<MilkRow>(auth, "milk_entries?select=entry_date,shift,quantity_liters,fat_percentage,total_amount,route_name,status&order=entry_date.desc&limit=40", fetchImpl);
}

export async function loadPurchases(auth: LiveAuth, fetchImpl: FetchLike): Promise<ReadResult<PurchaseRow>> {
  return liveGet<PurchaseRow>(auth, "purchases?select=purchase_number,purchase_date,total_amount,status,supplier_bill_no&order=purchase_date.desc&limit=30", fetchImpl);
}

export async function loadAttendance(auth: LiveAuth, day: string, fetchImpl: FetchLike): Promise<{ rows: ReadResult<AttendanceRow>; names: Map<string, string> }> {
  const rows = await liveGetScoped<AttendanceRow>(auth, `attendance_records?select=attendance_date,status,check_in_at,profile_id&attendance_date=eq.${day}&order=check_in_at.desc&limit=40`, fetchImpl);
  const names = new Map<string, string>();
  if (!rows.ok) return { rows, names };
  const ids = [...new Set(rows.rows.map((row) => row.profile_id).filter((id): id is string => Boolean(id)))];
  if (!ids.length) return { rows, names };
  const listed = ids.map((id) => encodeURIComponent(id)).join(",");
  const profiles = await liveGet<ProfileRow>(auth, `profiles?select=id,full_name&id=in.(${listed})`, fetchImpl);
  if (profiles.ok) {
    for (const profile of profiles.rows) {
      if (profile.id) names.set(profile.id, profile.full_name || "Staff");
    }
  }
  return { rows, names };
}

export type CatalogRow = { id?: string; name?: string | null; selling_price?: number | string | null; unit?: string | null };

export async function loadCatalog(auth: LiveAuth, fetchImpl: FetchLike): Promise<ReadResult<CatalogRow>> {
  return liveGet<CatalogRow>(auth, "products?select=id,name,selling_price,unit&is_available=eq.true&is_deleted=eq.false&order=name.asc&limit=40", fetchImpl);
}

export async function loadOrders(auth: LiveAuth, fetchImpl: FetchLike): Promise<ReadResult<OrderRow>> {
  return liveGetScoped<OrderRow>(auth, "agri_orders?select=order_number,status,grand_total,created_at&order=created_at.desc&limit=20", fetchImpl);
}

export type KhataView = {
  owed: number | null;
  note: string | null;
  lines: KhataLine[];
  linesNote: string | null;
};

export async function loadKhata(auth: LiveAuth, fetchImpl: FetchLike, now = new Date()): Promise<KhataView> {
  const today = karachiDate(now);
  const [year, month, day] = today.split("-").map(Number);
  const from = new Date(Date.UTC(year, month - 1, day));
  from.setUTCDate(from.getUTCDate() - 90);
  const start = from.toISOString().slice(0, 10);
  const [summary, lines] = await Promise.all([
    liveRpc<{ owed?: number | null } | null>(auth, "fn_my_khata_summary", { p_as_of: today }, fetchImpl),
    liveRpc<KhataLine[] | null>(auth, "fn_my_khata_statement", { p_from: start, p_to: today }, fetchImpl),
  ]);
  const owed = summary.ok && summary.data && typeof summary.data === "object" && summary.data.owed != null ? num(summary.data.owed) : null;
  return {
    owed: summary.ok ? owed : null,
    note: !summary.ok ? summary.message : summary.data == null ? "Is account ka khata track nahi hota." : null,
    lines: lines.ok && Array.isArray(lines.data) ? lines.data.filter((row) => !row.is_opening).slice(-20).reverse() : [],
    linesNote: lines.ok ? null : lines.message,
  };
}

export async function loadStaffHome(auth: LiveAuth, userId: string, fetchImpl: FetchLike): Promise<{
  attendance: ReadResult<AttendanceRow>;
  salary: ReadResult<SalaryRow>;
  advances: ReadResult<AdvanceRow>;
  tasks: { label: string; count: number }[];
  tasksNote: string | null;
}> {
  const id = encodeURIComponent(userId);
  const test = auth.testAccount === true;
  const [attendance, salary, advances, pending] = await Promise.all([
    liveGetScoped<AttendanceRow>(auth, `attendance_records?select=attendance_date,status,check_in_at&profile_id=eq.${id}&order=attendance_date.desc&limit=14`, fetchImpl),
    test
      ? Promise.resolve({ ok: true as const, rows: [] as SalaryRow[] })
      : liveGet<SalaryRow>(auth, `salary_payments?select=net_salary,status,pay_month,pay_year&profile_id=eq.${id}&order=pay_year.desc&limit=6`, fetchImpl),
    test
      ? Promise.resolve({ ok: true as const, rows: [] as AdvanceRow[] })
      : liveGet<AdvanceRow>(auth, `staff_advances?select=amount,status,created_at&profile_id=eq.${id}&order=created_at.desc&limit=6`, fetchImpl),
    test
      ? Promise.resolve({ ok: false as const, status: 0, message: "TEST account ko asal tasks nahi dikhte." })
      : liveRpc<PendingRow[] | null>(auth, "fn_admin_pending_counts", {}, fetchImpl),
  ]);
  const tasks = pending.ok && Array.isArray(pending.data)
    ? pending.data.filter((row) => num(row.mine_to_act) > 0).slice(0, 8).map((row) => ({ label: String(row.category || "Kaam"), count: num(row.mine_to_act) }))
    : [];
  return { attendance, salary, advances, tasks, tasksNote: pending.ok ? null : pending.message };
}
