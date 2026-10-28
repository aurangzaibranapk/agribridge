/**
 * Dairy review (20 October 2026) ke faisle — hisaab yahan, database
 * ke taale alag migration mein. Dono ek hi adad dete hain.
 *
 * SNF ka constant (0.805) yahan se NAHI badla. Wasela ke contract ki
 * tasdeeq Owner ke paas hai. Rate settings ki qatar maujood ho to wahi
 * constant chalta hai; qatar na ho to andaza lagane ki ijazat nahi.
 */

import { mayDecideEntry } from "../approval/guards";

export const FAT_MIN = 1;
export const FAT_MAX = 12;
export const LR_MIN = 15;
export const LR_MAX = 40;
export const METER_BUCKET = "meter-readings";

export interface MilkSettings {
  standardRate: number;
  selfDropoffIncentive: number;
  snfConstant: number;
  referenceTs: number;
}

/** Settings ki qatar na ho to chup chaap 145 / 10 / 0.805 mat bharo. */
export function requireMilkSettings(row: {
  standard_rate?: number | string | null;
  self_dropoff_incentive?: number | string | null;
  snf_constant?: number | string | null;
  reference_ts?: number | string | null;
} | null): MilkSettings | { error: string } {
  if (!row || row.standard_rate == null || !(Number(row.standard_rate) > 0)) {
    return { error: "Doodh ka rate settings mein nahi. Andaza nahi lagate — pehle rate darj karein." };
  }
  if (row.self_dropoff_incentive == null || Number(row.self_dropoff_incentive) < 0) {
    return { error: "Self drop-off incentive settings mein nahi." };
  }
  if (row.snf_constant == null || row.reference_ts == null || !(Number(row.reference_ts) > 0)) {
    return { error: "SNF constant ya reference TS settings mein nahi." };
  }
  return {
    standardRate: Number(row.standard_rate),
    selfDropoffIncentive: Number(row.self_dropoff_incentive),
    snfConstant: Number(row.snf_constant),
    referenceTs: Number(row.reference_ts),
  };
}

export function fatRangeError(fat: number, allowOverride: boolean): string | null {
  if (!(fat > 0)) return "FAT sahi likhein.";
  if (!allowOverride && (fat < FAT_MIN || fat > FAT_MAX)) {
    return `FAT ${FAT_MIN} se ${FAT_MAX} ke darmiyan hona chahiye. Ghalat adad ho to manager override lagayein.`;
  }
  return null;
}

export function lrRangeError(lr: number | null, allowOverride: boolean): string | null {
  if (lr == null) return null;
  if (!(lr > 0)) return "LR sahi likhein.";
  if (!allowOverride && (lr < LR_MIN || lr > LR_MAX)) {
    return `LR ${LR_MIN} se ${LR_MAX} ke darmiyan hona chahiye. Ghalat adad ho to manager override lagayein.`;
  }
  return null;
}

/**
 * 23505 tabhi "pehle se mahfooz" hai jab taala client_uuid ka ho.
 * Collection number ki takkar par doodh kho jata tha, is liye alag jumla.
 */
export function milkInsertConflictMessage(code: string | undefined, message: string, details?: string | null): string | null {
  if (code !== "23505") return null;
  const blob = `${message} ${details ?? ""}`;
  if (/client_uuid/i.test(blob)) return "Ye entry pehle se mahfooz ho chuki hai.";
  if (/collection_number/i.test(blob)) {
    return "Collection number takra gaya. Dobara koshish karein — doodh mahfooz nahi hua.";
  }
  return message || "Ye entry do dafa nahi ban sakti.";
}

export function karachiParts(now = new Date()): { year: number; month: string; day: string; hour: number } {
  const bag: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  const hour = Number(bag.hour);
  return {
    year: Number(bag.year),
    month: bag.month,
    day: bag.day,
    hour: hour === 24 ? 0 : hour,
  };
}

/** Subah 14:00 PKT se pehle morning, us ke baad evening. */
export function karachiShift(now = new Date()): "morning" | "evening" {
  return karachiParts(now).hour < 14 ? "morning" : "evening";
}

/** Collection number ka saal — do hindse, Pakistan ki taareekh se. */
export function karachiYear2(now = new Date()): number {
  return karachiParts(now).year % 100;
}

export function selfApprovalError(
  actorId: string,
  createdBy: string | null | undefined,
  alsoNot?: string | null,
  role?: string | null,
): string | null {
  if (mayDecideEntry(role, actorId, [createdBy, alsoNot])) return null;
  if (createdBy && actorId === createdBy) return "Apni entry khud manzoor nahi kar sakte.";
  if (alsoNot && actorId === alsoNot) return "Jis ne pehle verify kiya, wahi aakhri manzoori nahi de sakta.";
  return null;
}

/**
 * Tel ka rate settings se lock hai. User ka alag rate sirf tab chalta
 * hai jab wo settings ke barabar ho (form ne wahi bheja). Farq ho to
 * rok, chup chaap mehnga rate mat likho.
 */
export function lockedFuelRate(
  settingsRate: number | null | undefined,
  margin: number | null | undefined,
  submitted: number | null | undefined
): { rate: number } | { error: string } {
  if (settingsRate == null || !(Number(settingsRate) > 0)) {
    return { error: "Tel ka rate settings mein nahi. Andaza nahi lagate — pehle rate darj karein." };
  }
  const rate = Math.round((Number(settingsRate) + Number(margin ?? 0)) * 100) / 100;
  if (submitted != null && Number(submitted) > 0 && Math.abs(Number(submitted) - rate) > 0.009) {
    return { error: `Rate settings se lock hai (Rs ${rate}/L). Apna rate nahi chalega.` };
  }
  return { rate };
}

/** 0 ek sach reading hai (nayi machine). Khali khana alag baat hai. */
export function openingReadingError(raw: unknown, label: string): string | null {
  if (raw == null || String(raw).trim() === "") return `${label} zaroori hai.`;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return `${label} sahi likhein.`;
  return null;
}

export type VarianceKind = "shortage" | "excess" | "ok" | "pending";

/**
 * Chiller par field se zyada doodh bhi nishan hai. Manfi kami chhup
 * jati thi; ab hadd se zyada ziyadti bhi laal hai.
 */
export function routeVariance(field: number, chiller: number | null, thresholdPct: number): {
  shortageLiters: number | null;
  shortagePercentage: number | null;
  isRedAlert: boolean;
  varianceKind: VarianceKind;
} {
  if (chiller == null || !Number.isFinite(chiller)) {
    return { shortageLiters: null, shortagePercentage: null, isRedAlert: false, varianceKind: "pending" };
  }
  const shortageLiters = Math.round((field - chiller) * 1000) / 1000;
  const shortagePercentage = field > 0 ? Math.round((shortageLiters / field) * 100000) / 1000 : 0;
  const varianceKind: VarianceKind = shortageLiters > 0.0005 ? "shortage" : shortageLiters < -0.0005 ? "excess" : "ok";
  const isRedAlert = Math.abs(shortagePercentage) > thresholdPct;
  return { shortageLiters, shortagePercentage, isRedAlert, varianceKind };
}

/** Invoice company ke mane hue litre par hai, raw ya rejected par nahi. */
export function waselaServiceIncome(acceptedLiters: number, serviceRate: number): { liters: number; income: number } | { error: string } {
  if (!(serviceRate > 0)) return { error: "Service rate settings mein nahi. Andaza nahi lagate." };
  if (acceptedLiters < 0) return { error: "Company ke litre manfi nahi ho sakte." };
  const liters = Math.round(acceptedLiters * 1000) / 1000;
  return { liters, income: Math.round(liters * serviceRate * 100) / 100 };
}

export function payableCovers(balance: number, payout: number): string | null {
  if (!(payout > 0)) return "Amount zero se zyada honi chahiye.";
  if (Math.round(payout * 100) > Math.round(balance * 100)) {
    return `Adaigi baqaya se zyada hai. Baqaya Rs ${balance.toLocaleString("en-PK")}.`;
  }
  return null;
}

/** Public URL ya seedha path — dono se bucket ke andar ka raasta. */
export function meterObjectPath(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const trimmed = stored.trim();
  if (!trimmed) return null;
  if (!/^https?:/i.test(trimmed)) return trimmed.replace(/^\/+/, "");
  const marker = `/${METER_BUCKET}/`;
  const at = trimmed.indexOf(marker);
  if (at < 0) return null;
  return decodeURIComponent(trimmed.slice(at + marker.length).split("?")[0]);
}

/** Form ka client_action_id / client_uuid. Galat string RPC tak nahi jati. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

export function rpcError(message: string): string {
  const line = message.split("\n")[0] ?? message;
  return line.replace(/^.*ERROR:\s*/i, "").replace(/^P0001:\s*/, "").trim();
}
