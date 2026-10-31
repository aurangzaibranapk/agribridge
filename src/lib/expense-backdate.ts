/**
 * Guzri hui tareekh ka kharcha — kitab tab tak nahi, jab tak wajah na ho.
 *
 * `post_journal_atomic` purani tareekh par `backdateReason` ke baghair
 * ruk jata hai ("Backdate reason required"). Manzoori us se pehle
 * poochhe, aur posting fail ho to hara paigham na dikhaye.
 */

export const EXPENSE_BACKDATE_MIN = 10;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function expenseDay(value: string | null | undefined): string | null {
  const day = String(value ?? "").slice(0, 10);
  return DAY.test(day) ? day : null;
}

/** Pakistan ke aaj se pehle ki tareekh. Aaj aur aage wali backdate nahi. */
export function expenseDateIsBackdated(expenseDate: string | null | undefined, today: string): boolean {
  const day = expenseDay(expenseDate);
  const now = expenseDay(today);
  if (!day || !now) return false;
  return day < now;
}

export function parseExpenseBackdateReason(
  raw: string | null | undefined,
  expenseDate: string | null | undefined,
  today: string
): { ok: true; reason: string | null } | { ok: false; error: string } {
  if (!expenseDateIsBackdated(expenseDate, today)) return { ok: true, reason: null };
  const reason = String(raw ?? "").trim().slice(0, 300);
  if (reason.length < EXPENSE_BACKDATE_MIN) {
    return {
      ok: false,
      error:
        "Ye kharcha guzri hui tareekh ka hai. Kitab mein likhne se pehle wajah likhein — kam az kam das harf. Manzoori nahi hui, halat waisi hi hai.",
    };
  }
  return { ok: true, reason };
}

/**
 * Ek faisle ka jawab: ya to hara paigham, ya ek error.
 * Posting fail par purani tasdeeq ka hara paigham na rahe, aur wahi
 * error toast par dobara na aaye.
 */
export function approvalUiAfterResult(
  res: { ok: true; message: string } | { ok: false; error: string }
): { info: string | null; error: string | null; toastError: null } {
  if (!res.ok) return { info: null, error: res.error, toastError: null };
  return { info: res.message, error: null, toastError: null };
}

/** Manzoori fail ho to us se pehle ki tasdeeq ka hara paigham chhupao. */
export function hideStaleVerifySuccess(verifyMessage: string | undefined, approveError: string | undefined): string | undefined {
  if (approveError) return undefined;
  return verifyMessage;
}
