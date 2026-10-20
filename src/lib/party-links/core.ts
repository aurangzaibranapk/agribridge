/**
 * Party links (622) — ek hi banda customer bhi, supplier bhi.
 *
 * Malik (20 October): "sab kuch saaf ho, koi chhupi payment nahi."
 * Yasir Ali hum se saman leta hai (customer, 1100) aur humein diesel deta
 * hai (supplier, 2000). Dono record alag rehte hain; ye file sirf PURE
 * hisaab hai jo un ko jorr kar dikhata hai. Koi DB call nahi —
 * test: npm run test:party-links.
 */

export const LINKED_SUPPLIER_ACCOUNTS = ["2000", "1120"] as const;
export const CUSTOMER_RECEIVABLE = "1100";
export const SUPPLIER_PAYABLE = "2000";

/**
 * Wo source_module jin ki qatarein supplier statement pehle hi apni
 * table (purchases / supplier_payments) se dikhata hai. Inhein dobara GL se
 * liya to raqam DOHRI ho jayegi.
 */
export const STATEMENT_TABLE_MODULES = ["purchase", "purchase_correction", "supplier_payment", "supplier_payment_reversal"] as const;

const r2 = (v: number) => Math.round(v * 100) / 100;
const n = (v: unknown) => { const x = Number(v ?? 0); return Number.isFinite(x) ? x : 0; };

export type GlLine = {
  account_code: string;
  debit: number | string | null;
  credit: number | string | null;
  entry_date: string;
  entry_number?: string | null;
  description?: string | null;
  source_module?: string | null;
};

/** Statement ki qatar: debit = bill (dena barha), credit = payment (dena ghata). */
export type StatementRow = { date: string; description: string; debit: number; credit: number; source: "gl" };

/**
 * GL qatar -> supplier statement qatar.
 * 2000 (liability): GL credit = dena barha -> statement debit.
 * 1120 (advance, asset): GL debit = advance diya -> dena ghata -> statement credit.
 * Dono ka qaida ek hi nikalta hai: statementDebit = gl.credit, statementCredit = gl.debit.
 */
export function glToStatementRows(lines: GlLine[]): StatementRow[] {
  return lines
    .filter((l) => (LINKED_SUPPLIER_ACCOUNTS as readonly string[]).includes(String(l.account_code)))
    .filter((l) => !(STATEMENT_TABLE_MODULES as readonly string[]).includes(String(l.source_module ?? "")))
    .map((l) => ({
      date: String(l.entry_date).slice(0, 10),
      description: [l.entry_number, l.description].filter(Boolean).join(" — ") || "Ledger entry",
      debit: r2(n(l.credit)),
      credit: r2(n(l.debit)),
      source: "gl" as const,
    }))
    .filter((r) => r.debit > 0 || r.credit > 0);
}

/** Supplier ka GL se dena (2000 credit−debit, minus 1120 advance). Musbat = hum ne dena. */
export function supplierPayableFromGl(lines: GlLine[]): number {
  let v = 0;
  for (const l of lines) {
    const code = String(l.account_code);
    if (code === "2000" || code === "1120") v += n(l.credit) - n(l.debit);
  }
  return r2(v);
}

/** Customer ka GL se lena (1100 debit−credit). Musbat = us ne dena. */
export function customerReceivableFromGl(lines: { account_code: string; debit: unknown; credit: unknown }[]): number {
  let v = 0;
  for (const l of lines) if (String(l.account_code) === CUSTOMER_RECEIVABLE) v += n(l.debit) - n(l.credit);
  return r2(v);
}

/** Party 360 ka net: theyOwe (customer lena) − weOwe (supplier dena). */
export function linkedNet(customerReceivable: number, supplierPayable: number) {
  const theyOwe = r2(Math.max(0, customerReceivable)) + r2(Math.max(0, -supplierPayable));
  const weOwe = r2(Math.max(0, supplierPayable)) + r2(Math.max(0, -customerReceivable));
  return { theyOwe: r2(theyOwe), weOwe: r2(weOwe), net: r2(theyOwe - weOwe) };
}

/** Kitna net ho sakta hai: dono mein se chhoti musbat raqam. */
export function linkedSettlementLimit(customerReceivable: number, supplierPayable: number): number {
  return r2(Math.max(0, Math.min(customerReceivable, supplierPayable)));
}

export type SettlementLine = { account: string; debit?: number; credit?: number; partyType: string; partyId: string; memo: string };

/** Dr 2000 (supplier), Cr 1100 (customer) — dono khate barabar kam. */
export function linkedSettlementLines(args: { amount: number; customerId: string; supplierId: string; memo: string }): SettlementLine[] {
  const amount = r2(args.amount);
  if (!(amount > 0)) throw new Error("Raqam zero se zyada honi chahiye.");
  if (!args.customerId || !args.supplierId) throw new Error("Dono party zaroori hain.");
  return [
    { account: SUPPLIER_PAYABLE, debit: amount, partyType: "supplier", partyId: args.supplierId, memo: `${args.memo} — supplier ka dena kam` },
    { account: CUSTOMER_RECEIVABLE, credit: amount, partyType: "customer", partyId: args.customerId, memo: `${args.memo} — customer ka lena kam` },
  ];
}

/** Maker-checker: banane wala khud manzoor nahi kar sakta. */
export function canApprove(createdBy: string | null | undefined, approver: string): boolean {
  return !!approver && String(createdBy ?? "") !== approver;
}

/** Supplier bill (udhaar par kharcha): Dr kharcha (6xxx), Cr 2000 — dono supplier ke naam. */
export function supplierBillLines(args: { amount: number; expenseAccount: string; supplierId: string; memo: string }): SettlementLine[] {
  const amount = r2(args.amount);
  if (!(amount > 0)) throw new Error("Raqam zero se zyada honi chahiye.");
  if (!/^6\d{3}$/.test(args.expenseAccount)) throw new Error("Kharche ka khata 6xxx hona chahiye.");
  if (!args.supplierId) throw new Error("Supplier zaroori hai.");
  return [
    { account: args.expenseAccount, debit: amount, partyType: "supplier", partyId: args.supplierId, memo: args.memo },
    { account: SUPPLIER_PAYABLE, credit: amount, partyType: "supplier", partyId: args.supplierId, memo: `${args.memo} — supplier ka dena` },
  ];
}
