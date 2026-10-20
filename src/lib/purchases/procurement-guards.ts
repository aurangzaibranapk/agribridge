/**
 * Procurement guards (20 Oct 2026). Pure functions — server actions
 * inhe call karte hain, tests/procurement-guards.cjs seedha jaanchta hai.
 *
 * Owner/Admin self-approve (13 Oct 2026) yahan JAAN BOOJH KAR nahi badla.
 * Staff apni purchase khud approve nahi kar sakta. Owner, Super Admin aur
 * Admin (unrestricted caller) apni entry khud approve kar sakte hain.
 * Ye malik ka faisla hai; is change-set mein sirf yahan likha hai.
 */
export const OWNER_ADMIN_SELF_APPROVE = {
  since: "2026-10-13",
  roles: ["owner", "super_admin", "admin"] as const,
  rule: "Staff self-approve nahi. Owner/Super Admin/Admin apni purchase khud approve kar sakte hain (unrestricted). Policy change nahi.",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Held payment ki idempotency key. `post_desk_transaction_atomic` isay
 * `::uuid` cast karta hai. Purana `purchase-held-<id>` UUID nahi tha,
 * is liye manzoori par posting hamesha girti thi aur posted=false reh jata.
 * Purchase id se nikaali hui yahi key dobara try par wahi journal pakarti hai.
 */
export function heldPaymentClientActionId(purchaseId: string): string {
  const hex = purchaseId.replace(/-/g, "").toLowerCase();
  if (!isUuid(purchaseId) || hex.length !== 32) return "";
  const chars = hex.split("");
  const mixed = (parseInt(hex.slice(0, 2), 16) ^ 0xa5).toString(16).padStart(2, "0");
  chars[0] = mixed[0];
  chars[1] = mixed[1];
  chars[12] = "5";
  chars[16] = ((parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const h = chars.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export type HeldPayment = {
  amount?: number | string | null;
  payment_date?: string | null;
  payment_method?: string | null;
  finance_account_id?: string | null;
  requested_by?: string | null;
  posted?: boolean | null;
  client_action_id?: string | null;
};

export type HeldPostPlan =
  | { post: false }
  | {
      post: true;
      clientActionId: string;
      amount: number;
      paymentDate: string;
      paymentMethod: string | null;
      accountId: string;
    }
  | { post: false; error: string };

/** Approve par held payment: chup chaap skip nahi. Account/tareekh na ho to error. */
export function heldPaymentPostPlan(decision: string, held: HeldPayment | null | undefined, purchaseId: string): HeldPostPlan {
  if (decision !== "approve") return { post: false };
  if (!held || typeof held !== "object") return { post: false };
  if (held.posted === true) return { post: false };
  const amount = Number(held.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { post: false };
  if (!isUuid(held.finance_account_id)) {
    return { post: false, error: "Ruki hui adaigi ka finance account nahi hai — manzoori se pehle account chunein. Adaigi chup chaap skip nahi hui." };
  }
  if (!held.payment_date || !/^\d{4}-\d{2}-\d{2}$/.test(held.payment_date)) {
    return { post: false, error: "Ruki hui adaigi ki tareekh sahi nahi — post nahi hui." };
  }
  const clientActionId = isUuid(held.client_action_id) ? held.client_action_id : heldPaymentClientActionId(purchaseId);
  if (!isUuid(clientActionId)) {
    return { post: false, error: "Adaigi ki idempotency key UUID nahi — post nahi hui. Purani 'purchase-held-' key ledger par girti hai." };
  }
  return {
    post: true,
    clientActionId,
    amount,
    paymentDate: held.payment_date,
    paymentMethod: held.payment_method ?? null,
    accountId: held.finance_account_id,
  };
}

export type HeldPaymentRow = {
  id: string;
  purchaseId?: string | null;
  amount?: number | string | null;
};

export type HeldJournalRow = {
  id: string;
  clientActionId?: string | null;
  sourceModule?: string | null;
  sourceId?: string | null;
  description?: string | null;
  isReversal?: boolean | null;
};

/**
 * Held payment pehle se lagi ho (haath se, ya doosri key se) to dobara
 * post nahi. Doctor Masala PO-1792495620885: supplier_payment 93d80980
 * aur journal 7d0685b9, client_action_id hamari derived key nahi.
 */
export function existingHeldPost(args: {
  purchaseId: string;
  purchaseNumber: string;
  heldAmount: number;
  clientActionId: string;
  payments: HeldPaymentRow[];
  journals: HeldJournalRow[];
}): { already: false } | { already: true; paymentId: string | null; journalId: string | null } {
  const amount = Number(args.heldAmount);
  const sameMoney = (value: number | string | null | undefined) => {
    const n = Number(value);
    return Number.isFinite(n) && Number.isFinite(amount) && Math.abs(n - amount) <= 0.05;
  };
  const matchedPayments = args.payments.filter((p) => p.purchaseId === args.purchaseId && sameMoney(p.amount));
  const paymentIds = new Set(matchedPayments.map((p) => p.id));
  const purchaseNumber = args.purchaseNumber.trim();
  const journal = args.journals.find((j) => {
    if (j.isReversal) return false;
    if (j.clientActionId && j.clientActionId === args.clientActionId) return true;
    if (j.sourceModule === "supplier_payment" && j.sourceId && paymentIds.has(j.sourceId)) return true;
    return Boolean(
      purchaseNumber &&
        j.sourceModule === "supplier_payment" &&
        j.description &&
        j.description.includes(purchaseNumber)
    );
  });
  const payment = matchedPayments[0] ?? null;
  if (!payment && !journal) return { already: false };
  return { already: true, paymentId: payment?.id ?? null, journalId: journal?.id ?? null };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Aadhi lines + poora total manzoor nahi hota.
 * Header ya to goods (qty x rate) hai, ya goods - discount + tax.
 */
export function purchaseHeaderMatchesLines(args: {
  lines: Array<{ quantity: number; unit_cost: number }>;
  totalAmount: number;
  discountAmount?: number | null;
  taxAmount?: number | null;
  heldAmount?: number | null;
}): { ok: true; goods: number } | { ok: false; error: string } {
  if (!args.lines.length) return { ok: false, error: "Purchase par koi line nahi — total ke sath manzoori nahi ho sakti." };
  let goods = 0;
  for (const line of args.lines) {
    const qty = Number(line.quantity);
    const cost = Number(line.unit_cost);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(cost) || cost < 0) {
      return { ok: false, error: "Kisi line ki quantity ya rate sahi nahi — aadhi purchase manzoor nahi hoti." };
    }
    goods = round2(goods + round2(qty * cost));
  }
  const discount = Number(args.discountAmount ?? 0);
  const tax = Number(args.taxAmount ?? 0);
  if (!Number.isFinite(discount) || discount < 0 || !Number.isFinite(tax) || tax < 0) {
    return { ok: false, error: "Discount ya tax sahi nahi." };
  }
  const net = round2(goods - discount + tax);
  const header = round2(Number(args.totalAmount));
  if (!Number.isFinite(header)) return { ok: false, error: "Purchase ka total sahi nahi." };
  if (Math.abs(header - goods) > 0.05 && Math.abs(header - net) > 0.05) {
    return {
      ok: false,
      error: `Lines ka hisaab Rs ${goods.toLocaleString()} hai, purchase ka total Rs ${header.toLocaleString()}. Aadhi purchase manzoor nahi hoti.`,
    };
  }
  const held = args.heldAmount == null ? null : Number(args.heldAmount);
  if (held != null && Number.isFinite(held) && held > header + 0.05) {
    return { ok: false, error: "Ruki hui adaigi purchase ke total se zyada hai — manzoori nahi hui." };
  }
  return { ok: true, goods };
}

/** Receive ka status lock. 'receiving' doosri concurrent call ko rokta hai. */
export function receiveLockOutcome(
  status: string | null | undefined,
  reviewStatus: string | null | undefined
): { ok: true; action: "lock" | "resume" } | { ok: false; error: string } {
  if (reviewStatus !== "approved") {
    return { ok: false, error: "Ye purchase abhi manzoor nahi hui. Pehle Owner/Admin manzoor karein, phir maal ginein." };
  }
  if (status === "pending") return { ok: true, action: "lock" };
  if (status === "receiving") return { ok: true, action: "resume" };
  if (status === "received") return { ok: false, error: "This purchase is already marked received." };
  if (status === "cancelled") return { ok: false, error: "Cancelled purchase receive nahi ho sakti." };
  return { ok: false, error: "Purchase receive nahi ho sakti." };
}

export function purchaseMovementDedupeKey(purchaseId: string, itemId: string): string {
  return `purchase:${purchaseId}:item:${itemId}`;
}

export function purchaseBatchDedupeKey(itemId: string): string {
  return `purchase-batch:${itemId}`;
}

export function grnMovementDedupeKey(orderId: string, lineKey: string): string {
  return `agri_grn:${orderId}:line:${lineKey}`;
}

export function grnBatchDedupeKey(orderId: string, lineKey: string): string {
  return `agri-grn-batch:${orderId}:${lineKey}`;
}
