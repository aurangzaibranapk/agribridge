/**
 * Grain bikri ka gahak khata (527).
 *
 * Bikri par buyer ka udhaar banta hai:   Dr 1100 (gahak) / Cr 4010 (bikri)
 * Wusooli par udhaar ghatta hai:         Dr bank GL / Cr 1100 (gahak)
 *   (fn_record_grain_sale_payment_atomic, migration 527)
 * Lagat (pehle se): Dr 5020 / Cr 1220 -- FIFO batch cost, grain-sales action.
 */
export interface GrainSaleLine {
  account: string;
  debit?: number;
  credit?: number;
  partyType?: string | null;
  partyId?: string | null;
  memo?: string | null;
}

export const GRAIN_RECEIVABLE_ACCOUNT = "1100";
export const GRAIN_SALE_REVENUE_ACCOUNT = "4010";

const money = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Dr 1100 (gahak) / Cr 4010. Gahak na ho ya raqam ghalat ho to error -- chup chaap skip nahi. */
export function grainSaleReceivableLines(args: { customerId?: string | null; amount: number; memo: string }): GrainSaleLine[] {
  const amount = money(args.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Grain bikri ki raqam sahi nahi -- gahak khata nahi ban sakta.");
  if (!args.customerId) throw new Error("Grain bikri ke liye gahak (customer) zaroori hai.");
  return [
    { account: GRAIN_RECEIVABLE_ACCOUNT, debit: amount, memo: args.memo, partyType: "customer", partyId: args.customerId },
    { account: GRAIN_SALE_REVENUE_ACCOUNT, credit: amount, memo: args.memo },
  ];
}

/** Wusooli: Dr bank GL / Cr 1100 (gahak). */
export function grainSalePaymentLines(args: { bankGl: string; customerId?: string | null; amount: number; memo: string }): GrainSaleLine[] {
  const amount = money(args.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount sahi likhein.");
  if (!args.customerId) throw new Error("Is bikri ka gahak (customer) nahi mila.");
  return [
    { account: args.bankGl, debit: amount, memo: args.memo },
    { account: GRAIN_RECEIVABLE_ACCOUNT, credit: amount, memo: args.memo, partyType: "customer", partyId: args.customerId },
  ];
}

/** Gahak kaun: form par chuna hua > buyer se jura hua > naya banana parega. */
export function resolveGrainSaleCustomer(args: { formCustomerId?: string | null; buyerCustomerId?: string | null; newCustomerName?: string | null }):
  { kind: "existing"; customerId: string } | { kind: "create"; name: string | null } {
  const form = (args.formCustomerId ?? "").trim();
  if (form && form !== "__new__") return { kind: "existing", customerId: form };
  const name = (args.newCustomerName ?? "").trim();
  if (form === "__new__" && name) return { kind: "create", name };
  if (args.buyerCustomerId) return { kind: "existing", customerId: args.buyerCustomerId };
  return { kind: "create", name: name || null };
}
