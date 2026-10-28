/**
 * 691: Bharti ki offer, barhotri aur salary slip ke saaf (pure) hisaab.
 * Server, client aur tests teeno yahi istemal karte hain.
 */

export interface OfferParts {
  basic?: number | null;
  house_rent?: number | null;
  travel?: number | null;
  mobile?: number | null;
  proposed_salary?: number | null;
}

const n = (v: unknown) => (v == null || v === "" || !isFinite(Number(v)) ? 0 : Number(v));

/** Offer ka mahana kul -- hissay hon to un ka jor, warna purani proposed_salary (SQL fn_job_offer_total jaisa). */
export function offerTotal(o: OfferParts | null | undefined): number | null {
  if (!o) return null;
  const sum = n(o.basic) + n(o.house_rent) + n(o.travel) + n(o.mobile);
  if (sum > 0) return sum;
  return o.proposed_salary == null ? null : Number(o.proposed_salary);
}

/** Offer maang se kitni kam/zyada: "−6,500 maang se kam (−11.8%)". */
export function gapVsExpected(offer: number | null, expected: number | null): { diff: number; pct: number } | null {
  if (offer == null || expected == null || !(expected > 0)) return null;
  const diff = offer - expected;
  return { diff, pct: Math.round((diff / expected) * 1000) / 10 };
}

export const MONTH_SHORT_RU = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
export const MONTH_SHORT_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-01" -> "01 Nov 2026" (slip/khulasa ki shakl). */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
  if (!m) return String(d);
  return `${m[3]} ${MONTH_SHORT_EN[Number(m[2]) - 1]} ${m[1]}`;
}
/** "2026-10-18" -> "18 Okt" (silsila ki chhoti shakl). */
export function fmtDayMonth(d: string | null | undefined): string {
  if (!d) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
  return m ? `${m[3]} ${MONTH_SHORT_RU[Number(m[2]) - 1]}` : String(d);
}

/** Bank account ko chhupao: "PK00 **** **** 1234" (SQL fn_mask_account jaisa). */
export function maskAccount(acc: string | null | undefined): string | null {
  if (acc == null) return null;
  const s = String(acc).replace(/\s/g, "");
  if (s.length < 5) return String(acc);
  return `${s.slice(0, 4)} **** **** ${s.slice(-4)}`;
}

/** Barhotri ka farq: naya basic ya % -- dono mein se jo diya gaya. */
export function incrementPreview(current: number, newBasic?: number | null, pct?: number | null): { basic: number; amount: number; pct: number } | null {
  if (!(current > 0)) return null;
  let basic = n(newBasic);
  if (!(basic > 0) && n(pct) > 0) basic = Math.round(current * (1 + n(pct) / 100));
  if (!(basic > 0)) return null;
  const amount = basic - current;
  return { basic, amount, pct: Math.round((amount / current) * 1000) / 10 };
}

export const CHANGE_REASONS: Record<string, string> = {
  joining: "Joining", annual: "Saalana", performance: "Performance", promotion: "Promotion", inflation: "Mehngai", correction: "Durusti",
};

export type IncrementBucket = "late" | "this_month" | "next_month" | "later" | "unknown";
/** v_upcoming_increments jaisa darja -- view na ho to app khud gin leti hai. */
export function incrementBucket(due: string | null | undefined, today: string): IncrementBucket {
  if (!due) return "unknown";
  if (due < today) return "late";
  if (due.slice(0, 7) === today.slice(0, 7)) return "this_month";
  const [y, m] = today.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return due.slice(0, 7) === next ? "next_month" : "later";
}
/** Joining ki agli saalgirah (aaj ya baad), kam az kam pehla saal. */
export function nextAnniversary(hire: string | null | undefined, today: string): string | null {
  if (!hire || !/^\d{4}-\d{2}-\d{2}/.test(hire)) return null;
  const [hy, hm, hd] = hire.slice(0, 10).split("-").map(Number);
  const mk = (yy: number) => `${yy}-${String(hm).padStart(2, "0")}-${String(hd).padStart(2, "0")}`;
  let y = hy + 1;
  while (mk(y) < today) y += 1;
  return mk(y);
}
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to.slice(0, 10) + "T00:00:00Z") - Date.parse(from.slice(0, 10) + "T00:00:00Z")) / 86400000);
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function under1000(x: number): string {
  const h = Math.floor(x / 100), r = x % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (r) parts.push(r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? `-${ONES[r % 10]}` : ""));
  return parts.join(" ");
}
/** 52497 -> "Fifty-Two Thousand Four Hundred Ninety-Seven Rupees Only". */
export function amountInWords(amount: number): string {
  let x = Math.round(Math.abs(Number(amount) || 0));
  if (x === 0) return "Zero Rupees Only";
  const scales: [number, string][] = [[1_000_000_000, "Billion"], [1_000_000, "Million"], [1000, "Thousand"]];
  const parts: string[] = [];
  for (const [v, name] of scales) {
    if (x >= v) { parts.push(`${under1000(Math.floor(x / v))} ${name}`); x %= v; }
  }
  if (x) parts.push(under1000(x));
  return `${parts.join(" ")} Rupees Only`;
}

export const PAY_METHODS: Record<string, string> = { cash: "Cash", bank_transfer: "Bank transfer", cheque: "Cheque", wallet: "Wallet" };

/** QR ke andar ka link: public tasdeeq safha. */
export function verifyUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/verify/${encodeURIComponent(code)}`;
}
