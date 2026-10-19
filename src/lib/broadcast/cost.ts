import type { BroadcastConfig } from "./config";

export interface CostEstimate { waCount: number; smsCount: number; smsSegments: number; waUsd: number; smsUsd: number | null; totalUsd: number | null; note: string }

/**
 * Meta: per DELIVERED template message (MARKETING / UTILITY). SMS: provider rates TBD
 * (env mein rate na ho to null). "both": SMS fallback ka hissa alag dikhaya jata hai.
 */
export function estimateCost(o: { channel: "whatsapp" | "sms" | "both"; category: "MARKETING" | "UTILITY" | null; recipients: number; smsSegments: number }, cfg: BroadcastConfig): CostEstimate {
  const wa = o.channel === "sms" ? 0 : o.recipients;
  const sms = o.channel === "sms" ? o.recipients : 0;
  const rate = o.category === "MARKETING" ? cfg.rates.marketing : cfg.rates.utility;
  const waUsd = round(wa * rate);
  const smsSegs = sms * Math.max(1, o.smsSegments);
  const smsUsd = cfg.rates.smsPerSegment == null ? (sms ? null : 0) : round(smsSegs * cfg.rates.smsPerSegment);
  const fallbackMax = o.channel === "both" ? o.recipients * Math.max(1, o.smsSegments) : 0;
  return {
    waCount: wa, smsCount: sms, smsSegments: smsSegs, waUsd, smsUsd, totalUsd: smsUsd == null ? null : round(waUsd + smsUsd),
    note: `Meta PK ${o.category ?? "UTILITY"} $${rate}/delivered (eff. ${cfg.rates.effective})` + (sms || fallbackMax ? ` · SMS: ${cfg.rates.smsPerSegment == null ? "provider rates TBD" : `$${cfg.rates.smsPerSegment}/segment`}` : "") + (fallbackMax ? ` · fallback up to ${fallbackMax} SMS segments` : ""),
  };
}
const round = (n: number) => Math.round(n * 10000) / 10000;
