export interface BranchExemption {
  id: string;
  branch_id: string;
  reason: string;
  valid_from: string;
  valid_until: string;
  approved_by: string | null;
  revoked_at: string | null;
}

/** Abhi chalti chhoot (sab se der tak wali), warna null. */
export function activeExemption(rows: BranchExemption[], now: Date = new Date()): BranchExemption | null {
  const t = now.getTime();
  const live = rows.filter(
    (r) => !r.revoked_at && Date.parse(r.valid_from) <= t && Date.parse(r.valid_until) > t
  );
  live.sort((a, b) => Date.parse(b.valid_until) - Date.parse(a.valid_until));
  return live[0] ?? null;
}

/** "YYYY-MM-DD" (PKT) din ke aakhir tak -> UTC ISO. */
export function pkEndOfDayIso(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const ms = Date.parse(`${day}T23:59:59+05:00`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export const EXEMPTION_MAX_DAYS = 90;

export function validateGrant(input: { reason: string; untilIso: string | null; now?: Date }): string | null {
  const now = (input.now ?? new Date()).getTime();
  if ((input.reason ?? "").trim().length < 3) return "Wajah saaf likhein.";
  if (!input.untilIso) return "Aakhri tareekh durust nahi.";
  const u = Date.parse(input.untilIso);
  if (u <= now) return "Aakhri tareekh aaj ke baad honi chahiye.";
  if (u > now + EXEMPTION_MAX_DAYS * 86_400_000) return `Chhoot ${EXEMPTION_MAX_DAYS} din se zyada nahi ho sakti.`;
  return null;
}
