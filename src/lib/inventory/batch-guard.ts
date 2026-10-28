export function todayPkt(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Expiry ke din tak bikri chal sakti hai. Us ke baad band. Khali expiry = koi rok nahi. */
export function batchIsSellable(expiry: string | null | undefined, today = todayPkt()): boolean {
  if (!expiry) return true;
  const day = String(expiry).slice(0, 10);
  return day >= today;
}

export function batchRemainingWithinInitial(remaining: number | null | undefined, initial: number | null | undefined): boolean {
  if (remaining == null || initial == null) return true;
  return Number(remaining) >= 0 && Number(remaining) <= Number(initial);
}

/**
 * Ek batch se kitna nikalna hai.
 * Remaining seedha `read - take` se nahi likhte — database row lock
 * `remaining - take` karti hai. Ye sirf usool ka hisaab hai.
 */
export function batchDeductPlan(remaining: number, initial: number | null, qty: number): { ok: true; next: number } | { ok: false; error: string } {
  const have = Number(remaining);
  const take = Number(qty);
  if (!(take > 0)) return { ok: false, error: "Miqdar sifar se zyada honi chahiye." };
  if (!(have >= take)) return { ok: false, error: "Batch stock kam hai." };
  const next = have - take;
  if (next < 0) return { ok: false, error: "Batch remaining manfi nahi ho sakti." };
  if (initial != null && have <= Number(initial) && next > Number(initial)) {
    return { ok: false, error: "Batch remaining initial se zyada nahi ho sakti." };
  }
  if (initial != null && have > Number(initial)) {
    return { ok: false, error: "Batch remaining initial se zyada hai — pehle reconciliation." };
  }
  return { ok: true, next };
}

export function canCancelTransfer(status: string | null | undefined): boolean {
  return status !== "completed" && status !== "cancelled" && Boolean(status);
}
