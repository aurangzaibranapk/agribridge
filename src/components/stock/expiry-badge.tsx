// Read-only expiry highlight. Display only: never changes stock or ledger.
export type ExpiryState = "expired" | "soon" | null;

export const EXPIRY_SOON_DAYS = 30;

/** Days from today (local) to the given YYYY-MM-DD date; null when no date. */
export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function expiryState(date: string | null | undefined, daysLeft?: number | null): ExpiryState {
  const left = daysLeft ?? daysUntil(date);
  if (left == null) return null;
  if (left < 0) return "expired";
  if (left <= EXPIRY_SOON_DAYS) return "soon";
  return null;
}

export function ExpiryBadge({ date, daysLeft, className = "" }: { date: string | null | undefined; daysLeft?: number | null; className?: string }) {
  const left = daysLeft ?? daysUntil(date);
  const state = expiryState(date, left);
  if (!state) return null;
  const title = date ? `Expiry: ${String(date).slice(0, 10)}` : undefined;
  if (state === "expired") {
    return <span title={title} className={`inline-flex items-center rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white ${className}`}>Expired</span>;
  }
  return <span title={title} className={`inline-flex items-center rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950 ${className}`}>Expiring soon{left != null ? ` (${left}d)` : ""}</span>;
}
