/**
 * Mere Kaam ka popup — sirf ye tay karta hai ke kaun sa button dikhe.
 * Manzoori ki logic yahan nahi. Kharcha, mazdoori aur supplier payment
 * purane actions par jaate hain (popup-server).
 *
 * Work handoff aur WhatsApp alert par alag approve nahi: pehla agle
 * safhe ka kaam hai, doosra bhejne ki qatar hai.
 */

const UUID = /^[0-9a-f-]{36}$/i;

/** Kharcha ki final manzoori — actions/kharche.ts MANZOORI_WALE. */
const EXPENSE_DECIDE = ["owner", "super_admin", "admin"] as const;
/** Mazdoori — actions/mazdoori.ts MANZOORI_WALE + SAB_KUCH. */
const LABOUR_DECIDE = ["owner", "super_admin", "admin", "manager", "admin_assistant", "finance"] as const;
/** Supplier request approve — actions/supplier-payment-requests.ts HQ. */
const SUPPLIER_DECIDE = ["owner", "super_admin", "admin"] as const;
/** Supplier request likhna — finance bhi (RLS 356). */
const SUPPLIER_EDIT = ["owner", "super_admin", "admin", "finance"] as const;

export type PopupHint = "txn" | "handoff" | "summary" | "approving" | "linked" | null;
export type PopupEditKind = "expense" | "supplier" | null;

export interface PopupCaps {
  verify: boolean;
  approve: boolean;
  reject: boolean;
  edit: boolean;
  /** Mazdoori ki manzoori par raye lazmi hai. */
  needsComment: boolean;
  /** Supplier approve tab, jab request par khata pehle se na ho. */
  needsAccount: boolean;
  hint: PopupHint;
}

export interface PopupField {
  key: string;
  value: string;
}

export interface PendingPopupData {
  openedCategory: string;
  openedId: string;
  actionCategory: string;
  actionId: string;
  headline: string;
  status: string | null;
  fields: PopupField[];
  caps: PopupCaps;
  editKind: PopupEditKind;
  /** Form ki default values — khali string ka matlab khali khana. */
  edit: Record<string, string> | null;
  accounts: { id: string; name: string }[];
  hint: PopupHint;
}

export type PopupOk = { ok: true; effect: "done"; decision: "approve" | "reject"; message: string } | { ok: true; effect: "stay"; message: string };
export type PopupFail = { ok: false; error: string };
export type PopupCommit = PopupOk | PopupFail;

const NONE: PopupCaps = {
  verify: false,
  approve: false,
  reject: false,
  edit: false,
  needsComment: false,
  needsAccount: false,
  hint: null,
};

function has(list: readonly string[], role: string | null): boolean {
  return !!role && list.includes(role);
}

/**
 * Button ka hisaab. `isOwn` = isi bande ne record banaya.
 * Admin/Owner kharcha khud manzoor kar sakte hain (mayDecideEntry).
 * Tasdeeq apni request par band rehti hai — kharchaVerify ki rok.
 */
export function popupCaps(input: {
  category: string;
  status: string | null;
  role: string | null;
  isOwn: boolean;
  hasAccount?: boolean;
}): PopupCaps {
  const status = input.status ?? "";
  const role = input.role;
  if (input.category === "txn_alerts") return { ...NONE, hint: "txn" };
  if (input.category === "work_handoffs") return { ...NONE, hint: "handoff" };

  if (input.category === "expenses") {
    if (status === "approving") return { ...NONE, hint: "approving" };
    const money = has(EXPENSE_DECIDE, role);
    const pending = status === "pending";
    const verified = status === "verified";
    return {
      verify: pending && !input.isOwn && (money || role === "manager"),
      approve: verified && money,
      reject: (pending || verified) && money,
      edit: (pending || verified) && (money || (pending && input.isOwn)),
      needsComment: false,
      needsAccount: false,
      hint: null,
    };
  }

  if (input.category === "labour") {
    const open = status === "pending";
    const can = has(LABOUR_DECIDE, role);
    const allowed = can && (has(EXPENSE_DECIDE, role) || !input.isOwn);
    return {
      ...NONE,
      approve: open && allowed,
      reject: open && allowed,
      needsComment: open && allowed,
    };
  }

  if (input.category === "supplier_payments") {
    const open = status === "pending";
    const hq = has(SUPPLIER_DECIDE, role);
    return {
      ...NONE,
      approve: open && hq,
      reject: open && hq,
      edit: open && has(SUPPLIER_EDIT, role),
      needsAccount: open && hq && !input.hasAccount,
    };
  }

  return { ...NONE, hint: "summary" };
}

export function expenseVerificationReset(
  prev: { status: string; amount: number; accountId: string | null },
  next: { amount: number; accountId: string | null }
): boolean {
  if (prev.status !== "verified") return false;
  const sameAccount = (prev.accountId ?? "") === (next.accountId ?? "");
  return prev.amount !== next.amount || !sameAccount;
}

export interface ExpenseEditInput {
  description: string;
  amount: number;
  expenseDate: string | null;
  partyName: string | null;
  category: string;
  accountId: string | null;
}

export interface SupplierEditInput {
  amount: number;
  method: string;
  notes: string | null;
  accountId: string | null;
  paymentDate: string | null;
}

function money(raw: string | undefined): number | null {
  const n = Number(String(raw ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function day(raw: string | undefined): string | null | "bad" {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "bad";
  return s;
}

function account(raw: string | undefined): string | null | "bad" {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (!UUID.test(s)) return "bad";
  return s;
}

export function parseExpenseEdit(raw: {
  description?: string;
  amount?: string;
  expenseDate?: string;
  partyName?: string;
  category?: string;
  accountId?: string;
}): { ok: true; value: ExpenseEditInput } | { ok: false; error: string } {
  const description = String(raw.description ?? "").trim().slice(0, 400);
  if (description.length < 3) return { ok: false, error: "Tafseel kam az kam 3 harf." };
  const amount = money(raw.amount);
  if (amount == null) return { ok: false, error: "Raqam sifar se bara hona chahiye." };
  const expenseDate = day(raw.expenseDate);
  if (expenseDate === "bad") return { ok: false, error: "Tareekh YYYY-MM-DD honi chahiye." };
  const accountId = account(raw.accountId);
  if (accountId === "bad") return { ok: false, error: "Khata sahi nahi." };
  const category = String(raw.category ?? "").trim().slice(0, 80);
  if (!category) return { ok: false, error: "Qism likhein." };
  const partyName = String(raw.partyName ?? "").trim().slice(0, 120) || null;
  return { ok: true, value: { description, amount, expenseDate, partyName, category, accountId } };
}

export function parseSupplierEdit(raw: {
  amount?: string;
  method?: string;
  notes?: string;
  accountId?: string;
  paymentDate?: string;
}): { ok: true; value: SupplierEditInput } | { ok: false; error: string } {
  const amount = money(raw.amount);
  if (amount == null) return { ok: false, error: "Raqam sifar se bara hona chahiye." };
  const method = String(raw.method ?? "").trim().slice(0, 40);
  if (method.length < 2) return { ok: false, error: "Adaigi ka tareeqa likhein." };
  const accountId = account(raw.accountId);
  if (accountId === "bad") return { ok: false, error: "Khata sahi nahi." };
  const paymentDate = day(raw.paymentDate);
  if (paymentDate === "bad") return { ok: false, error: "Tareekh YYYY-MM-DD honi chahiye." };
  const notes = String(raw.notes ?? "").trim().slice(0, 300) || null;
  return { ok: true, value: { amount, method, notes, accountId, paymentDate } };
}

/** Handoff jis table par hai, us ka pending category — warna null. */
export function handoffActionCategory(recordTable: string | null | undefined): "expenses" | "labour" | "supplier_payments" | null {
  if (recordTable === "company_expense_requests") return "expenses";
  if (recordTable === "labour_work_entries") return "labour";
  if (recordTable === "supplier_payment_requests") return "supplier_payments";
  return null;
}

export function showText(value: unknown): string {
  if (value == null) return "—";
  const s = String(value).trim();
  return s ? s : "—";
}

export function showRs(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return `Rs ${n.toLocaleString("en-PK")}`;
}
