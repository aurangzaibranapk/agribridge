/**
 * Dobara click se timeline ki doosri line nahi banti.
 * Status pehle se wahi ho, ya interview ki wohi tareekh ho, to naya event nahi.
 */

export function shouldLogStatusChange(current: string | null | undefined, target: string): boolean {
  return (current ?? "") !== target;
}

/** `date` column ya `YYYY-MM-DD` se shuru hone wali string — din ka hissa. */
export function interviewDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function isDuplicateInterviewSchedule(
  existing: { status?: string | null; interview_date?: string | null } | null | undefined,
  nextDate: string,
): boolean {
  if (!existing || existing.status !== "interview_scheduled") return false;
  const prev = interviewDay(existing.interview_date);
  const next = interviewDay(nextDate);
  return !!prev && prev === next;
}
