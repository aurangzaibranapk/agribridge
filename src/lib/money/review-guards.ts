import { mayDecideEntry } from "@/lib/approval/guards";

/**
 * Sales/POS aur Parties review (20 Oct 2026) ke paise wale faisle.
 * SQL migrations 631–633 yahi hadd lagati hain. Ye file DB nahi chhoti,
 * is liye unit test seedha in functions par chalti hai.
 */

export const POS_DISCOUNT_MAX_PCT = 5;
export const POS_DISCOUNT_MAX_RS = 500;
export const CREDIT_MARGIN_MIN = 0;
export const CREDIT_MARGIN_MAX = 25;

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Hadd se upar discount: Rs 500 ya 5% (jo pehle poora ho). */
export function discountOverCap(
  gross: number,
  discount: number,
  maxPct = POS_DISCOUNT_MAX_PCT,
  maxRs = POS_DISCOUNT_MAX_RS,
): boolean {
  const d = r2(discount);
  const g = r2(gross);
  if (d <= 0) return false;
  const pct = g > 0 ? (d / g) * 100 : 100;
  return d > maxRs + 0.001 || pct > maxPct + 0.001;
}

/** Naqad wapsi asal cash_paid se zyada nahi, pichli naqad wapsi kaat kar. */
export function cashRefundCap(cashPaid: number, priorCashRefunds: number): number {
  return r2(Math.max(0, r2(cashPaid) - r2(priorCashRefunds)));
}

export function cashRefundAllowed(cashPaid: number, priorCashRefunds: number, requested: number): boolean {
  return r2(requested) <= cashRefundCap(cashPaid, priorCashRefunds) + 0.009;
}

/**
 * POS udhaar: hadd tabhi lagti hai jab credit_limit sifar se bari ho.
 * Khali hadd ka matlab "tay hi nahi hui" hai (pos.ts ka purana usool).
 */
export function posCreditExceeds(balance: number | null, limit: number | null, amount: number): boolean {
  const hadd = limit == null ? 0 : Number(limit);
  if (!(hadd > 0)) return false;
  const abTak = balance == null ? 0 : Number(balance);
  return r2(abTak) + r2(amount) > hadd + 0.009;
}

/**
 * Kisan udhaar: khali ya sifar hadd "be-had" nahi. Override ke baghair
 * koi raqam nahi nikalti (parties review #4).
 */
export function farmerCreditNeedsOverride(limit: number | null, balance: number, amount: number): boolean {
  const hadd = limit == null ? 0 : Number(limit);
  if (!(hadd > 0)) return true;
  return r2(balance) + r2(amount) > hadd + 0.009;
}

export function marginAllowed(margin: number): boolean {
  return Number.isFinite(margin) && margin >= CREDIT_MARGIN_MIN && margin <= CREDIT_MARGIN_MAX;
}

/** Maker-checker: staff apni entry nahi karta. Admin/Owner kar sakte hain. */
export function makerIsNotChecker(
  createdBy: string | null | undefined,
  actor: string | null | undefined,
  role?: string | null,
): boolean {
  return mayDecideEntry(role, actor, [createdBy]);
}

/** Catalog rate. Thok gahak par wholesale, warna selling. */
export function expectedPosUnitPrice(input: {
  sellingPrice: number | null;
  wholesalePrice: number | null;
  wholesaleCustomer: boolean;
}): number {
  if (input.wholesaleCustomer && input.wholesalePrice != null && Number(input.wholesalePrice) > 0) {
    return Number(input.wholesalePrice);
  }
  return Number(input.sellingPrice ?? 0);
}

export function priceMatchesCatalog(sent: number, expected: number): boolean {
  return Math.abs(Number(sent) - Number(expected)) <= 0.01;
}

/** Shop bill ka kharcha khata. */
export function shopBillExpenseAccount(billType: string): "6030" | "6040" | "6090" {
  const c = billType.toLowerCase();
  if (c.includes("rent") || c.includes("kiraya")) return "6030";
  if (
    c.includes("elect") ||
    c.includes("gas") ||
    c.includes("water") ||
    c.includes("utility") ||
    c.includes("bijli") ||
    c.includes("pani")
  ) {
    return "6040";
  }
  return "6090";
}

/**
 * Phone ki ek shakal. Khali ya chhota number null — 17 khali phones
 * ek doosre ke duplicate nahi maane jate.
 */
export function phoneDuplicateKey(raw: string | null | undefined): string | null {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("0092")) d = d.slice(2);
  if (d.startsWith("0")) d = `92${d.slice(1)}`;
  else if (!d.startsWith("92") && d.length > 0) d = `92${d}`;
  if (d.length < 12) return null;
  return d;
}

/** Same number on another party. Blank phones do not match each other. */
export function duplicatePhoneName(
  rows: { id: string; name: string; phone_number: string | null }[],
  phone: string,
  exceptId?: string | null,
): string | null {
  const key = phoneDuplicateKey(phone);
  if (!key) return null;
  const hit = rows.find((r) => r.id !== exceptId && phoneDuplicateKey(r.phone_number) === key);
  return hit?.name ?? null;
}
