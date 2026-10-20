/**
 * Finance fixes (review on main 434fcf2). Pure functions — server actions
 * inhe call karte hain, tests/finance-money-guards.cjs seedha jaanchta hai.
 *
 * Maker-checker: jo entry banaye wo khud manzoor nahi karta. Null creator
 * purana record hai, us par ye rok nahi lagti.
 */

export const MONEY_WRITER_ROLES = ["owner", "super_admin", "admin"] as const;

/** Cash ginti darj: mauqe wala manager apni branch, Admin/Owner koi bhi. */
export const CASH_CLOSE_RECORD_ROLES = ["owner", "super_admin", "admin", "manager"] as const;

/** Customer payable restore: Admin hadd, Owner ki alag hadd. */
export const RESTORE_PAYABLE_ADMIN_MAX = 50_000;
export const RESTORE_PAYABLE_OWNER_MAX = 500_000;

export const DEALER_PAYABLE_ACCOUNT = "2016";
export const BUYER_RECEIVABLE_ACCOUNT = "1180";
export const BUYER_PAYABLE_ACCOUNT = "2018";

export const LEGACY_TRANSFER_CLOSED =
  "Purana transfer raasta band hai: ek banda dono taraf khud nahi likh sakta. Doosra Owner/Admin wusooli darj kare. Is ke liye transfer ka column (migration 522) laga hona chahiye.";

type Gate = { ok: true } | { ok: false; error: string };

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isMoneyWriter(role: string | null | undefined): boolean {
  return MONEY_WRITER_ROLES.includes(role as (typeof MONEY_WRITER_ROLES)[number]);
}

export function samePerson(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a) && Boolean(b) && a === b;
}

export function kharchaApproveGate(
  row: { status: string; requested_by?: string | null; verified_by?: string | null },
  actorId: string,
  role: string | null | undefined
): Gate {
  if (!isMoneyWriter(role)) {
    return { ok: false, error: "Final manzoori sirf Owner, Super Admin ya Admin de sakta hai." };
  }
  if (row.status === "approved" || row.status === "approving") {
    return { ok: false, error: "Ye pehle hi manzoor ho chuka hai ya manzoori chal rahi hai. Dobara se dohri qatarein ban jayengi." };
  }
  if (row.status === "rejected") return { ok: false, error: "Ye radd ho chuka hai. Nayi qatar banayein." };
  if (row.status !== "verified") {
    return { ok: false, error: "Pehle tasdeeq (verified) zaroori hai — phir doosra Owner/Admin manzoor kare." };
  }
  if (samePerson(row.requested_by, actorId)) {
    return { ok: false, error: "Apni banayi hui request khud manzoor nahi kar sakte — doosra Owner/Admin kare." };
  }
  if (samePerson(row.verified_by, actorId)) {
    return { ok: false, error: "Jis ne tasdeeq ki wo khud manzoor nahi kar sakta — doosra Owner/Admin kare." };
  }
  return { ok: true };
}

export function cashCloseRecordGate(
  role: string | null | undefined,
  userBranchId: string | null | undefined,
  branchId: string
): Gate {
  if (!CASH_CLOSE_RECORD_ROLES.includes(role as (typeof CASH_CLOSE_RECORD_ROLES)[number])) {
    return { ok: false, error: "Cash ginti sirf Owner, Super Admin, Admin ya apni branch ka Manager darj kar sakta hai." };
  }
  if (role === "manager" && (!userBranchId || userBranchId !== branchId)) {
    return { ok: false, error: "Manager sirf apni branch ki ginti darj kar sakta hai." };
  }
  return { ok: true };
}

export function cashCloseApproveGate(
  row: { counted_by?: string | null; difference: number; approval_status?: string | null; journal_entry_id?: string | null },
  actorId: string,
  role: string | null | undefined
): Gate {
  if (!isMoneyWriter(role)) {
    return { ok: false, error: "Cash farq ki manzoori sirf Owner, Super Admin ya Admin de sakta hai." };
  }
  if (row.difference === 0) return { ok: false, error: "Farq sifar hai — kitab mein alag entry ki zaroorat nahi." };
  if (row.journal_entry_id) return { ok: false, error: "Is ginti ka farq pehle hi kitab mein ja chuka hai." };
  if (row.approval_status && row.approval_status !== "recorded") {
    return { ok: false, error: "Ye ginti manzoori ke marhale mein nahi." };
  }
  if (samePerson(row.counted_by, actorId)) {
    return { ok: false, error: "Jis ne ginti ki wo khud farq manzoor nahi kar sakta — doosra Owner/Admin kare." };
  }
  return { ok: true };
}

export function paymentApproveGate(
  row: { status?: string | null; created_by?: string | null },
  actorId: string,
  role: string | null | undefined
): Gate {
  if (!isMoneyWriter(role)) {
    return { ok: false, error: "Adaigi manzoor sirf Owner, Super Admin ya Admin kar sakta hai." };
  }
  if (row.status === "posted") return { ok: false, error: "Ye adaigi pehle hi manzoor ho chuki hai." };
  if (row.status === "rejected") return { ok: false, error: "Ye adaigi radd ho chuki hai." };
  if (row.status !== "pending" && row.status !== "approving") {
    return { ok: false, error: "Ye adaigi manzoori ke marhale mein nahi." };
  }
  if (samePerson(row.created_by, actorId)) {
    return { ok: false, error: "Apni darj ki hui adaigi khud manzoor nahi kar sakte — doosra Owner/Admin kare." };
  }
  return { ok: true };
}

export function restorePayableGate(role: string | null | undefined, amount: number): Gate {
  if (!isMoneyWriter(role)) {
    return { ok: false, error: "Customer payable restore sirf Owner, Super Admin ya Admin kar sakta hai." };
  }
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Restore amount Rs 0 se zyada likhein." };
  const cap = role === "owner" ? RESTORE_PAYABLE_OWNER_MAX : RESTORE_PAYABLE_ADMIN_MAX;
  if (amount > cap) {
    return {
      ok: false,
      error: `Ek dafa mein Rs ${cap.toLocaleString()} se zyada restore nahi. Chhoti qatarein karein${role === "owner" ? "" : " — bari raqam Owner kare"}.`,
    };
  }
  return { ok: true };
}

export function selfReversalGate(createdBy: string | null | undefined, actorId: string): Gate {
  if (samePerson(createdBy, actorId)) {
    return { ok: false, error: "Apni banayi hui entry khud ulti nahi kar sakte — doosra Owner/Admin kare." };
  }
  return { ok: true };
}

export type LedgerLine = { debit?: number | null; credit?: number | null };

/** Koi qatar nahi to NULL — sifar likhna jhoot hai (hisaab track hi nahi). */
export function netFromLines(lines: LedgerLine[] | null | undefined, side: "debit-credit" | "credit-debit"): number | null {
  if (!lines || lines.length === 0) return null;
  const raw = lines.reduce((sum, line) => {
    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);
    return sum + (side === "debit-credit" ? debit - credit : credit - debit);
  }, 0);
  return roundMoney(raw);
}

export function customerBalanceFromLedger(lines: LedgerLine[] | null | undefined): number | null {
  return netFromLines(lines, "debit-credit");
}

export function payableFromLedger(lines: LedgerLine[] | null | undefined): number | null {
  return netFromLines(lines, "credit-debit");
}

export function isCustomerBalanceDrift(stored: number | null | undefined, ledger: number | null | undefined): boolean {
  if (ledger == null) return stored != null && Math.abs(Number(stored)) > 0.004;
  if (stored == null) return true;
  return Math.abs(Number(stored) - Number(ledger)) > 0.004;
}

export function acceptedPurchaseAmounts(input: {
  acceptedTotal: number;
  discountAmount: number | null;
  taxAmount: number | null;
  receivedRatio: number;
}): { acceptedDiscount: number; acceptedTax: number; acceptedPayable: number } {
  const ratio = Number.isFinite(input.receivedRatio) ? input.receivedRatio : 1;
  const acceptedDiscount =
    input.discountAmount != null
      ? Math.min(input.acceptedTotal, roundMoney(Number(input.discountAmount) * ratio))
      : 0;
  const acceptedTax = input.taxAmount != null ? roundMoney(Number(input.taxAmount) * ratio) : 0;
  const acceptedPayable = roundMoney(input.acceptedTotal - acceptedDiscount + acceptedTax);
  return { acceptedDiscount, acceptedTax, acceptedPayable };
}

export interface JournalDraftLine {
  account: string;
  debit?: number;
  credit?: number;
  partyType?: string | null;
  partyId?: string | null;
  memo: string;
}

/** Maal wapas: stock aur 1195 Tax Recoverable ulta, supplier ka dena kam. */
export function purchaseReturnLines(input: {
  goodsAmount: number;
  taxAmount: number;
  supplierId?: string | null;
  memo: string;
}): { lines: JournalDraftLine[] } | { error: string } {
  const goods = roundMoney(input.goodsAmount);
  const tax = roundMoney(Math.max(0, input.taxAmount));
  if (goods <= 0) return { error: "Wapas hone wale maal ki raqam sifar se zyada honi chahiye." };
  const payable = roundMoney(goods + tax);
  const partyType = input.supplierId ? "supplier" : null;
  const partyId = input.supplierId ?? null;
  const lines: JournalDraftLine[] = [
    { account: "2000", debit: payable, partyType, partyId, memo: input.memo },
    { account: "1200", credit: goods, memo: input.memo },
  ];
  if (tax > 0) {
    lines.push({
      account: "1195",
      credit: tax,
      partyType,
      partyId,
      memo: `1195 Tax Recoverable wapas — ${input.memo}`,
    });
  }
  return { lines };
}

export function cashDifferenceLines(input: { difference: number; closeDate: string; reason: string }): JournalDraftLine[] {
  const amount = roundMoney(Math.abs(input.difference));
  const short = input.difference < 0;
  return short
    ? [
        { account: "6100", debit: amount, memo: input.reason },
        { account: "1000", credit: amount, memo: `Ginti ${input.closeDate}` },
      ]
    : [
        { account: "1000", debit: amount, memo: `Ginti ${input.closeDate}` },
        { account: "6100", credit: amount, memo: input.reason },
      ];
}

/**
 * Dealer ko adaigi. Pehli dafa ledger khali ho to pehle maujood baqi
 * (opening) alag entry hai — ye function sirf us payment ki qatarein
 * deta hai. Opening alag source se jati hai taake reversal sirf payment
 * ko ulta kare, poori baqi ko mitae nahi.
 */
export function dealerPaymentLines(input: {
  amount: number;
  cashGl: string;
  dealerId: string;
  memo: string;
}): JournalDraftLine[] {
  const amount = roundMoney(input.amount);
  return [
    { account: DEALER_PAYABLE_ACCOUNT, debit: amount, partyType: "dealer", partyId: input.dealerId, memo: input.memo },
    { account: input.cashGl, credit: amount, memo: input.memo },
  ];
}

export function dealerOpeningLines(input: { amount: number; dealerId: string; memo: string }): JournalDraftLine[] {
  const amount = roundMoney(input.amount);
  return [
    { account: "3200", debit: amount, memo: input.memo },
    { account: DEALER_PAYABLE_ACCOUNT, credit: amount, partyType: "dealer", partyId: input.dealerId, memo: input.memo },
  ];
}

export function buyerPaymentLines(input: {
  direction: string;
  amount: number;
  cashGl: string;
  buyerId: string;
  memo: string;
}): { lines: JournalDraftLine[] } | { error: string } {
  const amount = roundMoney(input.amount);
  if (input.direction === "they_paid") {
    return {
      lines: [
        { account: input.cashGl, debit: amount, memo: input.memo },
        { account: BUYER_RECEIVABLE_ACCOUNT, credit: amount, partyType: "buyer", partyId: input.buyerId, memo: input.memo },
      ],
    };
  }
  if (input.direction === "we_paid") {
    return {
      lines: [
        { account: BUYER_PAYABLE_ACCOUNT, debit: amount, partyType: "buyer", partyId: input.buyerId, memo: input.memo },
        { account: input.cashGl, credit: amount, memo: input.memo },
      ],
    };
  }
  return { error: "Direction sirf we_paid ya they_paid ho sakti hai." };
}

export function oppositeCashType(type: string): "income" | "expense" | null {
  if (type === "income") return "expense";
  if (type === "expense") return "income";
  return null;
}
