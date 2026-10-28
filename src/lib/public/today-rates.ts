import { pktDayKey, pktMidnight } from "@/lib/reports/sales-period";

/**
 * Public "aaj ka rate".
 *
 * Doodh: milk_entries.rate_per_liter (Mahabali branch ho to sirf wahan).
 * Gandum: grain_procurement_entries.rate_per_kg column fi mand (40kg) hai —
 * total = net kg / 40 * rate. 40 se zarb nahi lagti.
 * Mandi tab jab aaj ki kharid na ho.
 * Khali record par amount null. Purani tareekh ko "aaj" nahi likhte.
 */

export type WeightedRate = { date: string; rate: number; weight: number };

export type RateDelta = { kind: "up" | "down" | "same" | "unknown"; diff: number | null };

export type PresentedRate = {
  amount: number | null;
  isToday: boolean;
  asOf: string | null;
  delta: RateDelta;
  source: string | null;
};

export function dominantRate(rows: WeightedRate[], date: string): number | null {
  const day = rows.filter((r) => r.date === date && Number(r.rate) > 0);
  if (day.length === 0) return null;
  const weightByRate = new Map<number, number>();
  for (const row of day) {
    const key = Math.round(Number(row.rate) * 100) / 100;
    const w = Number(row.weight) > 0 ? Number(row.weight) : 1;
    weightByRate.set(key, (weightByRate.get(key) ?? 0) + w);
  }
  let best = 0;
  let bestW = -1;
  for (const [rate, w] of weightByRate) {
    if (w > bestW) {
      best = rate;
      bestW = w;
    }
  }
  return best;
}

export function rateDelta(today: number | null, yesterday: number | null): RateDelta {
  if (today == null || yesterday == null) return { kind: "unknown", diff: null };
  const diff = Math.round((today - yesterday) * 100) / 100;
  if (diff === 0) return { kind: "same", diff: 0 };
  if (diff > 0) return { kind: "up", diff };
  return { kind: "down", diff: Math.abs(diff) };
}

function latestBefore(rows: WeightedRate[], today: string): string | null {
  const dates = [...new Set(rows.map((r) => r.date).filter((d) => d && d < today))].sort();
  return dates.length ? dates[dates.length - 1] : null;
}

export function presentSeries(
  today: string,
  yesterday: string,
  rows: WeightedRate[],
  fallbackToday: number | null,
  source: string,
  fallbackSource = source,
): PresentedRate {
  const todayRate = dominantRate(rows, today);
  const yRate = dominantRate(rows, yesterday);
  if (todayRate != null) {
    return { amount: todayRate, isToday: true, asOf: today, delta: rateDelta(todayRate, yRate), source };
  }
  if (fallbackToday != null && fallbackToday > 0) {
    return { amount: fallbackToday, isToday: true, asOf: today, delta: { kind: "unknown", diff: null }, source: fallbackSource };
  }
  const last = latestBefore(rows, today);
  if (last) {
    return { amount: dominantRate(rows, last), isToday: false, asOf: last, delta: { kind: "unknown", diff: null }, source };
  }
  return { amount: null, isToday: false, asOf: null, delta: { kind: "unknown", diff: null }, source: null };
}

/** Aaj ki kharid, warna aaj ki mandi, warna jo tareekh nayi ho. Dono ko mila kar naya rate nahi banta. */
export function chooseWheat(today: string, yesterday: string, procurement: WeightedRate[], mandi: WeightedRate[]): PresentedRate {
  if (dominantRate(procurement, today) != null) return presentSeries(today, yesterday, procurement, null, "Mahabali kharid · 40kg");
  if (dominantRate(mandi, today) != null) return presentSeries(today, yesterday, mandi, null, "Mandi · 40kg");
  const p = presentSeries(today, yesterday, procurement, null, "Mahabali kharid · 40kg");
  const m = presentSeries(today, yesterday, mandi, null, "Mandi · 40kg");
  if (p.asOf && m.asOf) return p.asOf >= m.asOf ? p : m;
  if (p.amount != null) return p;
  if (m.amount != null) return m;
  return { amount: null, isToday: false, asOf: null, delta: { kind: "unknown", diff: null }, source: null };
}

export function pktTodayYesterday(now = new Date()): { today: string; yesterday: string } {
  const today = pktDayKey(now);
  const yesterday = pktDayKey(new Date(pktMidnight(now).getTime() - 24 * 60 * 60 * 1000));
  return { today, yesterday };
}

export function formatPktDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type PublicRates = {
  today: string;
  milk: PresentedRate;
  wheat: PresentedRate;
  note: string | null;
};

export const EMPTY_PUBLIC_RATE: PresentedRate = { amount: null, isToday: false, asOf: null, delta: { kind: "unknown", diff: null }, source: null };
