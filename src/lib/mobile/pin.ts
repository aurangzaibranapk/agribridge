const LOCK_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

export function pinProblem(pin: string): string | null {
  if (!/^\d{4}$/.test(pin) && !/^\d{6}$/.test(pin)) return "PIN 4 ya 6 hindse ka hona chahiye.";
  if (/^(\d)\1+$/.test(pin)) return "Ek hi hinda bar bar nahi.";
  return null;
}

export function verifyPin(pin: string, salt: string, expected: string, hash: (value: string) => string): boolean {
  if (pinProblem(pin) || !salt || !expected) return false;
  return hash(`${salt}:${pin}`) === expected;
}

export function pinLock(fails: number, now: number, lockedUntil: number | null): { locked: boolean; fails: number; lockedUntil: number | null } {
  if (lockedUntil != null && now < lockedUntil) return { locked: true, fails, lockedUntil };
  const next = fails + 1;
  if (next >= LOCK_FAILS) return { locked: true, fails: next, lockedUntil: now + LOCK_MS };
  return { locked: false, fails: next, lockedUntil: null };
}
