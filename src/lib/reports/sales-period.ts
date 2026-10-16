/**
 * "Pichli sale ka khulasa" -- poore (complete) PKT dino ki range.
 * Aaj ka adhoora din kabhi shamil nahi: range pichli raat 12 baje (PKT) par khatam.
 * Pakistan mein DST nahi, is liye UTC+5 sabit hai.
 * Test: npm run test:sales-period
 */
export const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
export const SALES_PERIODS = ["7d", "15d", "last_month", "3m", "1y"] as const;
export type SalesPeriod = (typeof SALES_PERIODS)[number];

export function isSalesPeriod(v: unknown): v is SalesPeriod {
  return typeof v === "string" && (SALES_PERIODS as readonly string[]).includes(v);
}

/** PKT ki aadhi raat (00:00) jo `now` wale din ki shuruaat hai -- UTC Date ke tor par. */
export function pktMidnight(now: Date): Date {
  const local = new Date(now.getTime() + PKT_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - PKT_OFFSET_MS);
}

/** PKT calendar date (y, m 0-based, d) ki aadhi raat. Month overflow theek handle hota hai. */
function pktDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d) - PKT_OFFSET_MS);
}

export interface PeriodRange {
  /** shamil (>=) */ start: Date;
  /** shamil nahi (<) -- hamesha kisi PKT aadhi raat par */ end: Date;
  prevStart: Date;
  prevEnd: Date;
  days: number;
}

export function periodRange(period: SalesPeriod, now: Date = new Date()): PeriodRange {
  const end = pktMidnight(now); // aaj ki 12 AM PKT -- aaj shamil nahi
  const local = new Date(end.getTime() + PKT_OFFSET_MS);
  const y = local.getUTCFullYear(), m = local.getUTCMonth(), d = local.getUTCDate();
  let start: Date; let rangeEnd = end; let prevStart: Date;
  if (period === "last_month") {
    start = pktDate(y, m - 1, 1);
    rangeEnd = pktDate(y, m, 1);
    prevStart = pktDate(y, m - 2, 1);
    const days = Math.round((rangeEnd.getTime() - start.getTime()) / 86400000);
    return { start, end: rangeEnd, prevStart, prevEnd: start, days };
  }
  if (period === "3m") { start = pktDate(y, m - 3, d); prevStart = pktDate(y, m - 6, d); }
  else if (period === "1y") { start = pktDate(y - 1, m, d); prevStart = pktDate(y - 2, m, d); }
  else {
    const n = period === "15d" ? 15 : 7;
    start = pktDate(y, m, d - n);
    prevStart = pktDate(y, m, d - 2 * n);
  }
  const days = Math.round((rangeEnd.getTime() - start.getTime()) / 86400000);
  return { start, end: rangeEnd, prevStart, prevEnd: start, days };
}

/** UTC timestamp ka PKT din "YYYY-MM-DD". */
export function pktDayKey(iso: string | Date): string {
  const t = typeof iso === "string" ? new Date(iso) : iso;
  return new Date(t.getTime() + PKT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Range ke saare din (khali din bhi 0 ke sath). */
export function dayKeys(r: { start: Date; end: Date }): string[] {
  const out: string[] = [];
  for (let t = r.start.getTime(); t < r.end.getTime(); t += 86400000) out.push(pktDayKey(new Date(t)));
  return out;
}

/** % farq pichle barabar arse se; pichla 0 ho to null. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

// ---------------------------------------------------------------------
// Aaj / Kal / Parson + rozana table (cash / bank / udhaar).
// ---------------------------------------------------------------------

export type MethodBucket = "cash" | "bank" | "udhaar";

/** payment_method -> teen khanon mein: khata = udhaar, cash = cash, baqi sab (EasyPaisa, JazzCash, Wasela, QR, card, bank) = bank. */
export function methodBucket(method: string | null | undefined): MethodBucket {
  const m = String(method ?? "").toLowerCase();
  if (m === "cash") return "cash";
  if (m === "khata" || m === "udhaar" || m === "credit") return "udhaar";
  return "bank";
}

export type DayKind = "aaj" | "kal" | "parson";
/** Aaj (00:00 PKT se abhi tak), Kal aur Parson (poore PKT din). */
export function recentDayRanges(now: Date = new Date()): { kind: DayKind; key: string; start: Date; end: Date }[] {
  const m = pktMidnight(now);
  const day = 86400000;
  return [
    { kind: "aaj", key: pktDayKey(m), start: m, end: now },
    { kind: "kal", key: pktDayKey(new Date(m.getTime() - day)), start: new Date(m.getTime() - day), end: m },
    { kind: "parson", key: pktDayKey(new Date(m.getTime() - 2 * day)), start: new Date(m.getTime() - 2 * day), end: new Date(m.getTime() - day) },
  ];
}

export interface DailyRow { day: string; bills: number; total: number; cash: number; bank: number; udhaar: number }

/**
 * Har din ki qatar, naya din upar. Total aur bills pos_sales se (card wala hi
 * hisaab, returns ka koi alag hisaab nahi); cash/bank/udhaar
 * pos_sale_payment_details.amount > 0 se -- "Payment tareeqe se" wala hisaab.
 */
export function buildDailyRows(
  days: string[],
  sales: { id: string; total_amount: number | string | null; created_at: string }[],
  payments: { sale_id: string; payment_method: string; amount: number | string | null }[]
): DailyRow[] {
  const rows = new Map<string, DailyRow>(days.map((d) => [d, { day: d, bills: 0, total: 0, cash: 0, bank: 0, udhaar: 0 }]));
  const saleDay = new Map<string, string>();
  for (const s of sales) {
    const k = pktDayKey(s.created_at);
    const r = rows.get(k); if (!r) continue;
    r.bills += 1; r.total += Number(s.total_amount ?? 0); saleDay.set(s.id, k);
  }
  for (const p of payments) {
    const amt = Number(p.amount ?? 0); if (amt <= 0) continue;
    const k = saleDay.get(p.sale_id); if (!k) continue;
    rows.get(k)![methodBucket(p.payment_method)] += amt;
  }
  return [...rows.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
}

export function sumDailyRows(rows: DailyRow[]): DailyRow {
  return rows.reduce((t, r) => ({ day: "total", bills: t.bills + r.bills, total: t.total + r.total, cash: t.cash + r.cash, bank: t.bank + r.bank, udhaar: t.udhaar + r.udhaar }), { day: "total", bills: 0, total: 0, cash: 0, bank: 0, udhaar: 0 });
}
