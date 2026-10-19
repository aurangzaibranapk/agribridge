import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * Admin pending badges -- saaf (pure) hisaab. Database se 582 ka
 * fn_admin_pending_counts() / fn_admin_pending_items() aata hai; yahan
 * sirf jor-tor, umar aur kis menu par kya dikhana hai. Koi faisla, koi
 * manzoori, koi message yahan nahi.
 */

export interface PendingCount {
  category: string;
  group_key: string;
  route: string;
  pending: number | null;
  naya: number | null;
  mine_to_act: number | null;
  oldest_at: string | null;
  newest_at: string | null;
  amount: number | string | null;
  pending_with: string;
  seen_until: string | null;
  is_info: boolean;
  readable: boolean;
}

export interface PendingItem {
  category: string;
  group_key: string;
  route: string;
  item_id: string;
  ref: string | null;
  title: string | null;
  amount: number | string | null;
  created_at: string;
  entered_by: string | null;
  entered_by_name: string | null;
  actor_id: string | null;
  actor_name: string | null;
  pending_with: string;
  is_own: boolean;
  /** Darj kisi aur ne kiya, magar is record ki ijazat (manager code) isi bande ki thi -- checker nahi ban sakta. */
  code_own?: boolean;
  is_new: boolean;
  link: string | null;
}

/** 582 ki registry jaisi hi fehrist (test dono ko milata hai). */
export const CATEGORY_KEYS = [
  "pos_returns", "payment_promises", "settlements", "season_import", "custom_products",
  "cash_handover", "load_proof", "expenses", "labour", "pos_deposits", "supplier_payments", "credit_requests", "qist_plans",
  "purchases", "product_edits", "product_merge", "stock_counts", "stock_loss", "stock_transfers", "agri_returns",
  "advances", "leave", "attendance_corrections", "payroll", "salary_structures", "meeting_actions", "job_applications",
  "portal_claims", "portal_promises", "portal_changes", "portal_disputes", "portal_delete",
  "farmer_signups", "farmer_credit", "demand", "grain_pending", "grain_sales", "milk_verify",
  "machinery_payments", "machinery_work", "machinery_fuel", "fuel_logs", "generator_logs", "maintenance",
  "agri_payments", "whatsapp_submissions", "access_requests", "access_conflicts", "support_tickets", "txn_alerts",
  "work_handoffs", "data_health",
] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const ROLE_KEYS = [
  "admin_owner", "recovery", "finance", "finance_owner", "admin", "receiver", "maker_proof", "purchase_checker",
  "admin_product", "manager", "warehouse", "hr_owner", "owner", "action_owner", "hr", "checker_approver", "procurement",
  "grain_approver", "milk_verifier", "manager_finance", "branch_admin", "admin_dev", "admin_confirm", "assignee",
] as const;

export const GROUP_ORDER = [
  "sales", "finance", "purchase", "product", "inventory", "hr", "portal-dairy", "farmers", "procurement", "grain",
  "milk", "machinery", "fuel", "generator", "fleet", "ordering", "audit", "admin",
] as const;

export function catLabelKey(category: string): TranslationKey {
  return ((CATEGORY_KEYS as readonly string[]).includes(category) ? `apb_cat_${category}` : "apb_dept_other") as TranslationKey;
}
export function roleLabelKey(role: string): TranslationKey {
  return ((ROLE_KEYS as readonly string[]).includes(role) ? `apb_role_${role}` : "apb_role_admin") as TranslationKey;
}
export function groupLabelKey(group: string): TranslationKey {
  if (group === "portal-dairy") return "apb_grp_portal" as TranslationKey;
  return ((GROUP_ORDER as readonly string[]).includes(group) ? `apb_grp_${group}` : "apb_dept_other") as TranslationKey;
}

/**
 * Jin ka faisla "Mere Kaam" se seedha ho sakta hai -- PURANE server action
 * se (koi nayi manzoori ki logic nahi). Baqi sab apne safhe par khulte hain,
 * kyunke un ke faisle ko comment / account / raqam chahiye.
 */
export const INLINE_DECISIONS: Readonly<Record<string, { approve: boolean; reject: boolean; rejectNeedsReason: boolean }>> = {
  pos_returns: { approve: true, reject: true, rejectNeedsReason: true },
  product_edits: { approve: true, reject: true, rejectNeedsReason: false },
  product_merge: { approve: true, reject: true, rejectNeedsReason: false },
};

/** Approve ka button: sirf inline wali category, aur kabhi apni entry par nahi. */
export function approveState(item: Pick<PendingItem, "category" | "is_own"> & { code_own?: boolean }): "enabled" | "own" | "code" | "page" {
  if (!INLINE_DECISIONS[item.category]) return "page";
  if (item.is_own) return "own";
  return item.code_own ? "code" : "enabled";
}

/**
 * Jin categories mein darj karne wale ke ilawa ek AUR banda bhi maker hai
 * (POS wapsi: manager ka code = authorized_by). 582 ki registry sirf
 * created_by dekhti hai, is liye safha ye column alag se parh kar
 * code_own lagata hai. DB trigger (528) aur posReturnReviewCheck pehle se
 * dono ko rokte hain -- ye sirf button / ginti ko us rok ke mutabiq karta hai.
 */
export const CODE_MAKER_COLS: Readonly<Record<string, { table: string; col: string }>> = {
  pos_returns: { table: "pos_returns", col: "authorized_by" },
};

/** code_own lagao; `codeBy` = item_id -> code wale ka id. Apni darj ki hui entry (is_own) waisi hi rehti hai. */
export function markCodeOwn(items: PendingItem[], codeBy: ReadonlyMap<string, string | null | undefined>, uid: string | null | undefined): PendingItem[] {
  if (!uid) return items;
  return items.map((i) => (CODE_MAKER_COLS[i.category] && !i.is_own && codeBy.get(i.item_id) === uid ? { ...i, code_own: true } : i));
}

/**
 * "Mujh par baqi" ginti (582 mine_to_act) mein se wo qatarein nikalo jin par
 * mera code laga hai. Sirf tab jab category ki saari qatarein list mein hon
 * (warna andaza galat hota) -- warna ginti waisi hi.
 */
export function adjustMineForCode(counts: PendingCount[], items: PendingItem[]): PendingCount[] {
  const flagged = new Map<string, number>();
  const shown = new Map<string, number>();
  for (const i of items) {
    shown.set(i.category, (shown.get(i.category) ?? 0) + 1);
    if (i.code_own) flagged.set(i.category, (flagged.get(i.category) ?? 0) + 1);
  }
  return counts.map((c) => {
    const f = flagged.get(c.category) ?? 0;
    if (!f || c.mine_to_act == null || (shown.get(c.category) ?? 0) < Number(c.pending ?? 0)) return c;
    return { ...c, mine_to_act: Math.max(0, Number(c.mine_to_act) - f) };
  });
}

const DAY = 86_400_000;
export function ageDays(iso: string | null, now: number = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / DAY));
}
/** Neela < 3 din, peela 3-6, laal 7+. */
export function ageTone(days: number | null): "blue" | "amber" | "red" {
  if (days == null || days < 3) return "blue";
  if (days < 7) return "amber";
  return "red";
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === "string" ? Number(v) : v ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
};

function clean(route: string): string {
  return route.split(/[?#]/, 1)[0];
}

/** Laal ginti -- sirf parhi ja saki, aur info (data-health) ke baghair. */
export function live(counts: PendingCount[]): PendingCount[] {
  return counts.filter((c) => c.readable && !c.is_info && num(c.pending) > 0);
}

export function totals(counts: PendingCount[], now: number = Date.now()) {
  const l = live(counts);
  const oldest = l.map((c) => ageDays(c.oldest_at, now) ?? 0);
  return {
    pending: l.reduce((s, c) => s + num(c.pending), 0),
    naya: l.reduce((s, c) => s + num(c.naya), 0),
    mine: l.reduce((s, c) => s + num(c.mine_to_act), 0),
    amount: l.reduce((s, c) => s + num(c.amount), 0),
    oldTypes: oldest.filter((d) => d >= 7).length,
    oldestDays: oldest.length ? Math.max(...oldest) : null,
    types: l.length,
    unreadable: counts.filter((c) => !c.readable).map((c) => c.category),
    info: counts.filter((c) => c.is_info && c.readable).reduce((s, c) => s + num(c.pending), 0),
  };
}

export interface Badge {
  pending: number;
  naya: number;
  oldestDays: number | null;
  pendingWith: string | null;
  categories: string[];
}

function sum(list: PendingCount[], now: number): Badge {
  const oldest = list.map((c) => ageDays(c.oldest_at, now)).filter((d): d is number => d != null);
  const top = [...list].sort((a, b) => num(b.pending) - num(a.pending))[0];
  return {
    pending: list.reduce((s, c) => s + num(c.pending), 0),
    naya: list.reduce((s, c) => s + num(c.naya), 0),
    oldestDays: oldest.length ? Math.max(...oldest) : null,
    pendingWith: top?.pending_with ?? null,
    categories: list.map((c) => c.category),
  };
}

/** Menu item par: jin categories ka raasta bilkul yahi hai. */
export function badgeForHref(counts: PendingCount[], href: string, now: number = Date.now()): Badge | null {
  const h = clean(href);
  const list = live(counts).filter((c) => clean(c.route) === h);
  if (!list.length) return null;
  return sum(list, now);
}

/** Group heading par: us group ki categories + jin ka raasta is group ke kisi item ka hai. */
export function badgeForGroup(counts: PendingCount[], groupKey: string, hrefs: string[], now: number = Date.now()): Badge | null {
  const hs = new Set(hrefs.map(clean));
  const list = live(counts).filter((c) => c.group_key === groupKey || hs.has(clean(c.route)));
  if (!list.length) return null;
  return sum(list, now);
}

/** Safha khulte hi kaun si categories "dekh li" (Naya hat jata hai, Pending rehta hai). */
export function categoriesForPath(counts: PendingCount[], pathname: string): string[] {
  return counts
    .filter((c) => {
      const r = clean(c.route);
      return pathname === r || pathname.startsWith(r + "/");
    })
    .filter((c) => num(c.naya) > 0)
    .map((c) => c.category);
}

/** Pichhle poll ke muqable mein jahan Naya barha -- toast sirf inhi par. */
export function newArrivals(prev: PendingCount[] | null, next: PendingCount[]): string[] {
  if (!prev) return [];
  const before = new Map(prev.map((c) => [c.category, num(c.naya)]));
  return live(next)
    .filter((c) => num(c.naya) > (before.get(c.category) ?? 0))
    .map((c) => c.category);
}

/** Department ke hisaab se, GROUP_ORDER ki tarteeb. */
export function groupItems<T extends { group_key: string }>(items: T[]): { group: string; items: T[] }[] {
  const by = new Map<string, T[]>();
  for (const i of items) {
    if (!by.has(i.group_key)) by.set(i.group_key, []);
    by.get(i.group_key)!.push(i);
  }
  const order = (g: string) => {
    const i = (GROUP_ORDER as readonly string[]).indexOf(g);
    return i < 0 ? 999 : i;
  };
  return [...by.entries()].sort((a, b) => order(a[0]) - order(b[0])).map(([group, list]) => ({ group, items: list }));
}

export function fmtRs(v: number | string | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = num(v);
  return `Rs ${Math.round(n).toLocaleString("en-PK")}`;
}
