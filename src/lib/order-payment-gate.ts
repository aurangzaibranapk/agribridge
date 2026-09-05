import { createClient } from "@/lib/supabase/server";

/**
 * Payment Mode — order banate waqt ye tay hota hai ke paisa kab aayega.
 * Iske liye koi naya column nahi hai: `agri_orders.payment_terms` pehle
 * se dono soortein rakhta hai, is liye wahi single source of truth hai.
 *
 *   Advance Order = payment_terms 'Advance Payment'
 *      Paisa pehle. Poori verified payment aaye baghair warehouse
 *      dispatch nahi bana sakta (getAdvancePaymentStatus). GRN par
 *      branch ke khate mein koi charge nahi jata (agri-grn.ts pehle se
 *      isi string par branch karta hai).
 *
 *   Base Order = baqi sab (Credit / Cash / Bank Transfer / Partial)
 *      Maal pehle, paisa baad mein. Branch ki credit limit ke andar
 *      hona zaroori hai (getBranchCreditCheck), aur GRN complete hone
 *      par poora amount us branch ke khate mein charge hota hai.
 */
export const ADVANCE_PAYMENT_TERMS = "Advance Payment";

export function isAdvanceOrder(paymentTerms: string | null | undefined): boolean {
  return paymentTerms === ADVANCE_PAYMENT_TERMS;
}

// Ek payment tabhi "aa gayi" mani jati hai jab finance usay verify kar
// de. 'partially_verified' bhi shamil hai kyunke verifyOrderPayment us
// soorat mein bhi poora paid_amount branch ke credit khate mein daal
// deta hai — yani wo raqam bhi asli, tasdeeq-shuda paisa hai.
const VERIFIED_PAYMENT_STATUSES = ["verified", "partially_verified"];

export interface AdvancePaymentStatus {
  isAdvance: boolean;
  grandTotal: number;
  verifiedPaid: number;
  remaining: number;
  /** Advance nahi hai, ya hai aur poori payment verify ho chuki hai. */
  isSatisfied: boolean;
}

export async function getAdvancePaymentStatus(orderId: string): Promise<AdvancePaymentStatus> {
  const supabase = createClient();

  const { data: order } = await supabase
    .from("agri_orders")
    .select("payment_terms, grand_total")
    .eq("id", orderId)
    .maybeSingle();

  const isAdvance = isAdvanceOrder(order?.payment_terms);
  const grandTotal = Number(order?.grand_total ?? 0);

  if (!isAdvance) {
    return { isAdvance: false, grandTotal, verifiedPaid: 0, remaining: 0, isSatisfied: true };
  }

  const { data: payments } = await supabase
    .from("agri_order_payments")
    .select("paid_amount, status")
    .eq("order_id", orderId)
    .in("status", VERIFIED_PAYMENT_STATUSES);

  const verifiedPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.paid_amount), 0);
  const remaining = Math.max(0, grandTotal - verifiedPaid);

  return { isAdvance: true, grandTotal, verifiedPaid, remaining, isSatisfied: remaining <= 0 };
}

export interface BranchCreditCheck {
  creditLimit: number;
  outstanding: number;
  availableCredit: number;
  orderAmount: number;
  /** Limit se kitna zyada ja raha hai (0 agar andar hai). */
  shortfall: number;
  /** Is branch ka branch_credit_accounts mein record hai ya nahi. */
  hasCreditAccount: boolean;
  isWithinLimit: boolean;
}

/**
 * Base order ki credit limit check. Outstanding ka formula bilkul wahi
 * hai jo /admin/branch-credit page istemal karta hai, taake dono jagah
 * ek hi number nazar aaye.
 */
export async function getBranchCreditCheck(branchId: string | null, orderAmount: number): Promise<BranchCreditCheck> {
  const supabase = createClient();
  const empty: BranchCreditCheck = {
    creditLimit: 0,
    outstanding: 0,
    availableCredit: 0,
    orderAmount,
    shortfall: orderAmount,
    hasCreditAccount: false,
    isWithinLimit: orderAmount <= 0,
  };
  if (!branchId) return empty;

  const { data: account } = await supabase
    .from("branch_credit_accounts")
    .select("credit_limit")
    .eq("branch_id", branchId)
    .maybeSingle();

  const { data: transactions } = await supabase
    .from("branch_credit_transactions")
    .select("transaction_type, amount")
    .eq("branch_id", branchId);

  const txns = transactions ?? [];
  const sumOf = (...types: string[]) =>
    txns.filter((t) => types.includes(t.transaction_type)).reduce((sum, t) => sum + Number(t.amount), 0);

  const orderCharges = sumOf("order_charge");
  const advancePaid = sumOf("advance_payment");
  const adjustments = sumOf("adjustment", "refund");

  const creditLimit = Number(account?.credit_limit ?? 0);
  const outstanding = orderCharges - advancePaid - adjustments;
  const availableCredit = creditLimit - outstanding;
  const shortfall = Math.max(0, orderAmount - availableCredit);

  return {
    creditLimit,
    outstanding,
    availableCredit,
    orderAmount,
    shortfall,
    hasCreditAccount: !!account,
    isWithinLimit: shortfall <= 0,
  };
}

/** Finance/warehouse ko dikhane wala saaf Urdu message. */
export function creditLimitMessage(check: BranchCreditCheck): string {
  if (!check.hasCreditAccount) {
    return `Is shop ki credit limit set nahi hai, is liye Base (udhaar) order nahi ho sakta. Pehle Admin > Branch Credit mein limit set karein, ya order ko Advance Payment par banayein.`;
  }
  return `Credit limit se zyada ja raha hai. Limit: Rs ${check.creditLimit.toLocaleString()}, pehle se baqi: Rs ${check.outstanding.toLocaleString()}, is order ka amount: Rs ${check.orderAmount.toLocaleString()} — Rs ${check.shortfall.toLocaleString()} limit se zyada.`;
}
