/**
 * Broadcast settings (malik ki manzoori, 19 Oct 2026). Sab .env se; default mehfooz.
 * BROADCAST_ENABLED "true" na ho to worker kuch nahi bhejta (kill switch).
 */
export interface BroadcastConfig {
  enabled: boolean;
  ratePerSec: number;
  dailyCap: number;
  quietStartHour: number; // PKT, is ghante se
  quietEndHour: number;   // PKT, is ghante tak band
  smsProvider: string;
  rates: { marketing: number; utility: number; smsPerSegment: number | null; effective: string; currency: "USD" };
}

const num = (v: string | undefined, d: number, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== "" ? Math.min(max, Math.max(min, n)) : d;
};

/** Meta Pakistan rates per DELIVERED message, effective 1 Oct 2026 (env se badal sakte hain). */
export const META_PK_RATES = { marketing: 0.0473, utility: 0.015, effective: "2026-10-01" } as const;

export function broadcastConfig(env: Record<string, string | undefined> = process.env): BroadcastConfig {
  const [qs, qe] = String(env.BROADCAST_QUIET_HOURS ?? "21-08").split("-").map((x) => Number(x));
  return {
    enabled: env.BROADCAST_ENABLED === "true",
    ratePerSec: num(env.BROADCAST_RATE_PER_SEC, 20, 1, 80),
    dailyCap: num(env.BROADCAST_DAILY_CAP, 1000, 0),
    quietStartHour: Number.isInteger(qs) && qs >= 0 && qs < 24 ? qs : 21,
    quietEndHour: Number.isInteger(qe) && qe >= 0 && qe < 24 ? qe : 8,
    smsProvider: (env.SMS_PROVIDER ?? "console").trim() || "console",
    rates: {
      marketing: num(env.META_RATE_MARKETING_USD, META_PK_RATES.marketing, 0),
      utility: num(env.META_RATE_UTILITY_USD, META_PK_RATES.utility, 0),
      smsPerSegment: env.SMS_RATE_PER_SEGMENT_USD ? num(env.SMS_RATE_PER_SEGMENT_USD, 0, 0) : null, // provider rates TBD
      effective: env.META_RATE_EFFECTIVE ?? META_PK_RATES.effective,
      currency: "USD",
    },
  };
}
