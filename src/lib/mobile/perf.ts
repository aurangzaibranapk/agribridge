export interface Mark {
  name: string;
  at: number;
}

export function elapsed(marks: Mark[], from: string, to: string): number | null {
  const a = marks.find((mark) => mark.name === from);
  const b = marks.find((mark) => mark.name === to);
  if (!a || !b) return null;
  return Math.max(0, b.at - a.at);
}

/** CI bundle ki hadd, bytes. Expo ka android JS bundle is se upar na ho. */
export const MOBILE_BUNDLE_BUDGET_BYTES = 8_000_000;

export function withinBudget(bytes: number, budget = MOBILE_BUNDLE_BUDGET_BYTES): boolean {
  return Number.isFinite(bytes) && bytes >= 0 && bytes <= budget;
}
