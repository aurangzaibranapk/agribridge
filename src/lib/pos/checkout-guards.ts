/**
 * POS checkout ki server-side jaanch (fix/sales-money-guards).
 *
 * Browser se cashPaid / khataAmount / paymentLines alag alag aate hain.
 * Ye teenon aapas mein aur bill ke saath milne chahiye, warna receipt,
 * cash book aur ledger alag alag kahani sunate hain. Pure function --
 * DB nahi chhoti, is liye unit test ho sakti hai.
 */
export interface CheckoutTotalsInput {
  items: { quantity: number; unit_price: number }[];
  discount?: number;
  cashPaid: number;
  khataAmount: number;
  paymentLines: { method: string; amount: number }[];
}

export type CheckoutTotals =
  | { ok: true; gross: number; discount: number; net: number; nonKhataPaid: number; cashOnly: number; khata: number; overpayment: number }
  | { ok: false; error: string };

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export function validateCheckoutTotals(input: CheckoutTotalsInput): CheckoutTotals {
  const gross = r2(input.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0));
  const discount = r2(input.discount ?? 0);
  if (!Number.isFinite(gross) || gross < 0) return { ok: false, error: "Bill ki raqam ghalat hai." };
  if (discount < 0) return { ok: false, error: "Discount manfi nahi hota." };
  if (discount > gross) return { ok: false, error: `Discount (Rs ${discount}) bill (Rs ${gross}) se zyada nahi ho sakta.` };
  const net = r2(gross - discount);

  for (const line of input.paymentLines) {
    const amt = Number(line.amount);
    if (!Number.isFinite(amt) || amt < 0) return { ok: false, error: "Payment line ki raqam ghalat hai." };
  }
  const nonKhataPaid = r2(input.paymentLines.filter((l) => l.method !== "khata").reduce((s, l) => s + Number(l.amount || 0), 0));
  // fix/pos-card-cash-dupes (19 October): pos_sales.cash_paid mein ab SIRF
  // "cash" line jaati hai. Waseela Card / bank / wallet pehle isi khane mein
  // jama ho kar "Naqad aaya" ko phula dete the (bill 3C711691 = Rs 230
  // Waseela Card, magar cash_paid 230). Asal tareeqa-wari tafseel
  // pos_sale_payment_details mein pehle se sahi thi.
  const cashOnly = r2(input.paymentLines.filter((l) => l.method === "cash").reduce((s, l) => s + Number(l.amount || 0), 0));
  const khataLines = r2(input.paymentLines.filter((l) => l.method === "khata").reduce((s, l) => s + Number(l.amount || 0), 0));
  const khata = r2(input.khataAmount);
  const cash = r2(input.cashPaid);
  if (khata < 0 || cash < 0) return { ok: false, error: "Cash ya khata manfi nahi ho sakta." };

  if (khataLines > 0 && Math.abs(khataLines - khata) > 0.01) {
    return { ok: false, error: `Khata (Rs ${khata}) payment lines ke khata (Rs ${khataLines}) se match nahi.` };
  }
  // cash_paid = sab ghair-khata lines (cash + bank + wallet). Purane
  // client sirf "cash" line bhejte the -- wo kam ho sakta hai, magar
  // lines se ZYADA kabhi nahi. Server hamesha lines wala adad likhta hai.
  if (cash > nonKhataPaid + 0.01) {
    return { ok: false, error: `Wasool raqam (Rs ${cash}) payment lines (Rs ${nonKhataPaid}) se zyada hai.` };
  }
  // Overpayment sirf tab jab koi udhaar na ho: dono ek saath matlab ghalti.
  const overpayment = r2(Math.max(0, nonKhataPaid + khata - net));
  if (overpayment > 0 && khata > 0) {
    return { ok: false, error: "Bill se zyada payment ke saath khata nahi ho sakta." };
  }
  if (Math.abs(r2(nonKhataPaid + khata - overpayment) - net) > 0.01) {
    return { ok: false, error: `Cash + khata (Rs ${r2(nonKhataPaid + khata)}) bill (Rs ${net}) ke barabar nahi.` };
  }
  return { ok: true, gross, discount, net, nonKhataPaid, cashOnly, khata, overpayment };
}

/**
 * Do-bara bana bill (double-submit) pakadne ke liye bill ka "nishan".
 * Live par 16 October 19:24 PKT ko Mujahid Abbas ke Rs 230 ke do bilkul ek
 * jaise bill 24 second ke farq se bane (0516B948, 405AB0F2). Nishan:
 * customer + bill ki raqam + har cheez ki tadaad aur rate (tarteeb se
 * azaad).
 */
export interface SaleSignatureInput {
  customerId: string | null;
  total: number;
  items: { product_id: string; quantity: number; unit_price: number }[];
}

export function saleSignature(s: SaleSignatureInput): string {
  const lines = s.items
    .map((i) => `${i.product_id}:${r2(i.quantity)}@${r2(i.unit_price)}`)
    .sort()
    .join("|");
  return `${s.customerId ?? "-"}#${r2(s.total)}#${lines}`;
}

/** Itne second ke andar wohi bill dobara aaye to pehle poocha jata hai. */
export const DUPLICATE_WINDOW_SECONDS = 120;

/**
 * Haal hi ke bilon mein se wo jo isi naye bill jaisa hai (wohi nishan, aur
 * DUPLICATE_WINDOW_SECONDS ke andar). Pure function -- DB nahi chhoti.
 */
export function findRecentDuplicate<T extends SaleSignatureInput & { id: string; createdAt: string }>(
  candidate: SaleSignatureInput,
  recent: T[],
  now: Date = new Date(),
  windowSeconds: number = DUPLICATE_WINDOW_SECONDS
): T | null {
  const sig = saleSignature(candidate);
  for (const r of recent) {
    const age = (now.getTime() - new Date(r.createdAt).getTime()) / 1000;
    if (!(age >= -5 && age <= windowSeconds)) continue;
    if (saleSignature(r) === sig) return r;
  }
  return null;
}

/** Duplicate-guard ka error text -- client isi nishani se confirm poochta hai. */
export const DUPLICATE_SALE_MARKER = "DUPLICATE_SALE:";

/** WhatsApp ke liye "92XXXXXXXXXX" -- 92 sirf ek dafa. */
export function normalizePkPhone(raw: string | null | undefined): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("0092")) d = d.slice(2);
  if (d.startsWith("92")) return d;
  if (d.startsWith("0")) return `92${d.slice(1)}`;
  return d ? `92${d}` : "";
}

/** Receipt ke figures: gross, discount, net aur asal (manfi bhi) balance. */
export function receiptFigures(r: { total_amount: number; discount_amount?: number | null; gross_amount?: number | null; customer_balance?: number | null }) {
  const discount = r2(r.discount_amount ?? 0);
  const net = r2(r.total_amount);
  const gross = r2(r.gross_amount ?? net + discount);
  const balance = r.customer_balance == null ? null : r2(r.customer_balance);
  return { gross, discount, net, balance };
}

/**
 * POS wapsi ki cash-book qataron mein se sirf wo jo isi wapsi ki hain.
 * Nayi qataron par source_row_id hota hai; purani (525 se pehle) par sirf
 * notes -- un mein return number ka EXACT token chahiye, ILIKE nahi
 * (RET-1 ko RET-10 nahi pakadna chahiye).
 */
export function matchReturnFinanceRows<T extends { source_row_id?: string | null; notes?: string | null }>(
  rows: T[], returnId: string, returnNumber: string
): T[] {
  const bySource = rows.filter((r) => r.source_row_id === returnId);
  if (bySource.length) return bySource;
  const esc = returnNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^POS wapsi ${esc} \\([^)]*\\)$`);
  return rows.filter((r) => !r.source_row_id && re.test(String(r.notes ?? "")));
}
