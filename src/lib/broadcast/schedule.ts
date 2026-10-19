import type { BroadcastConfig } from "./config";

/** PKT (UTC+5, DST nahi) ka ghanta. */
export function pktHour(now: Date): number { return (now.getUTCHours() + 5) % 24; }

export function inQuietHours(now: Date, cfg: Pick<BroadcastConfig, "quietStartHour" | "quietEndHour">): boolean {
  const h = pktHour(now), s = cfg.quietStartHour, e = cfg.quietEndHour;
  if (s === e) return false;
  return s < e ? h >= s && h < e : h >= s || h < e;
}

/**
 * Is chakkar mein kitne bhejne hain: kill switch, quiet hours, rozana hadd, aur
 * rate (per second x window). Har haal mein 0 ya us se zyada.
 */
export function planBatch(now: Date, cfg: BroadcastConfig, sentToday: number, windowSec = 50): { limit: number; reason: string | null; delayMs: number } {
  if (!cfg.enabled) return { limit: 0, reason: "BROADCAST_ENABLED is not true (kill switch)", delayMs: 0 };
  if (inQuietHours(now, cfg)) return { limit: 0, reason: `quiet hours ${cfg.quietStartHour}:00-${cfg.quietEndHour}:00 PKT`, delayMs: 0 };
  const left = Math.max(0, cfg.dailyCap - Math.max(0, sentToday));
  if (left === 0) return { limit: 0, reason: "daily cap reached", delayMs: 0 };
  return { limit: Math.min(left, cfg.ratePerSec * windowSec), reason: null, delayMs: Math.ceil(1000 / cfg.ratePerSec) };
}
