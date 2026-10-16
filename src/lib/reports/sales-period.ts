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
