/** Andaroni credit report (tasdeeq) -- pure helpers. Test: npm run test:promise-credit */
export type Band = "low" | "bronze" | "silver" | "gold" | "platinum";
export type Trust = "trusted" | "watch" | "risky" | "default" | "building";
export const TERMS_VERSION = "waada-v1-2026-10";
export const STAFF_MAX_PROMISE_DAYS = 30;
export const TERMS: string[] = [
  "Waade ki tareekh tak poori raqam jama na hui to udhaar fauran band ho jayega.",
  "Toota hua waada hamari andaroni credit report (tasdeeq) mein \"Default\" darj hoga.",
  "Default 12 mahine baad halka hota hai, magar record kabhi mitta nahi.",
  "Dobara udhaar sirf Admin ki manzoori se.",
];
export const BANDS: { band: Band; label: string; min: number; max: number }[] = [
  { band: "low", label: "Low", min: 0, max: 20 }, { band: "bronze", label: "Bronze", min: 21, max: 40 },
  { band: "silver", label: "Silver", min: 41, max: 60 }, { band: "gold", label: "Gold", min: 61, max: 80 },
  { band: "platinum", label: "Platinum", min: 81, max: 100 },
];
/** en-PK lakh grouping: 1622723 -> "16,22,723". */
export function pkr(n: number | null | undefined): string {
  if (n == null || !isFinite(Number(n))) return "—";
  const neg = n < 0; const s = String(Math.round(Math.abs(n)));
  const out = s.length <= 3 ? s : `${s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${s.slice(-3)}`;
  return `${neg ? "-" : ""}${out}`;
}
export const rsPk = (n: number | null | undefined) => `Rs ${pkr(n)}`;
export function trustOf(input: { band: Band | null; defaultActive: boolean; state?: string | null }): Trust {
  if (input.defaultActive) return "default";
  if (!input.band || (input.state && input.state !== "active")) return "building";
  if (input.band === "gold" || input.band === "platinum") return "trusted";
  if (input.band === "silver") return "watch";
  return "risky";
}
export const TRUST_LABEL: Record<Trust, string> = {
  trusted: "Bharosemand", watch: "Nigrani (Watch)", risky: "Khatra (Risky)", default: "Default", building: "Ban raha",
};
export function nextBand(score: number | null): { band: Band; label: string; need: number } | null {
  if (score == null) return null;
  const nb = BANDS.find((b) => b.min > score);
  return nb ? { band: nb.band, label: nb.label, need: nb.min - score } : null;
}
/** "Darja kaise behtar ho" -- seedhe qadam. */
export function improvementSteps(r: { score: number | null; lateAmount?: number; defaultActive: boolean; openPromise?: boolean }): string[] {
  const out: string[] = [];
  if ((r.lateAmount ?? 0) > 0) out.push(`Late ${rsPk(r.lateAmount)} jama karein — overdue hatega`);
  if (r.openPromise) out.push("Chalu waada tareekh se pehle poora karein (+8)");
  const nb = nextBand(r.score);
  if (nb) out.push(`${nb.label} tak pohnchne ke liye ${nb.need} point aur — 3 waade waqt par poore karein`);
  if (r.defaultActive) out.push("Default 12 mahine baad halka hoga, mitega nahi");
  if (r.score == null) out.push("Abhi record ban raha hai — waqt par adaigi se darja banega");
  return out;
}
/** Staff ka promise form validation (server bhi yahi chalata hai). */
export function promiseFormError(i: { days: number; isAdmin: boolean; termsAccepted: boolean }): string | null {
  if (!i.termsAccepted) return "Sharaait ki tasdeeq zaroori hai: customer ne zubani maan li -- checkbox lagayein.";
  if (!(i.days >= 1)) return "Waade ke din 1 ya zyada hon.";
  if (!i.isAdmin && i.days > STAFF_MAX_PROMISE_DAYS) return "Staff zyada se zyada 30 din ka waada darj kar sakta hai.";
  return null;
}
