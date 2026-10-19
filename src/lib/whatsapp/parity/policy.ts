import type { WaKind } from "./identity";
import type { ReadIntent } from "./intents";

/**
 * Kaun kya POOCH sakta hai (Phase 1, sirf parhna). App ki rok ke ilawa
 * 613 ke functions DB mein bhi role dekhte hain.
 */
export function allowedReads(kind: WaKind, role: string | null): ReadIntent[] {
  switch (kind) {
    case "owner":
    case "admin":
      return ["today_sales", "cash_position", "pending_approvals", "my_work", "help"];
    case "staff": {
      const r: ReadIntent[] = ["my_work", "help"];
      if (role === "finance") r.push("today_sales", "cash_position");
      if (role === "manager") r.push("today_sales");
      return r;
    }
    case "farmer":
    case "customer":
      return ["my_khata", "my_bills", "my_orders", "help"];
    default:
      return [];
  }
}

export function canRead(kind: WaKind, role: string | null, intent: ReadIntent): boolean {
  return allowedReads(kind, role).includes(intent);
}

/** Meta: free-form jawab sirf aakhri inbound ke 24 ghante ke andar. 10 min hifazati faasla. */
export const WINDOW_MS = 24 * 60 * 60 * 1000;
export const WINDOW_MARGIN_MS = 10 * 60 * 1000;
export function withinReplyWindow(inboundEpochSeconds: number | string | null | undefined, nowMs: number = Date.now()): boolean {
  const s = Number(inboundEpochSeconds);
  if (!Number.isFinite(s) || s <= 0) return false;
  const age = nowMs - s * 1000;
  return age >= -5 * 60 * 1000 && age < WINDOW_MS - WINDOW_MARGIN_MS;
}
