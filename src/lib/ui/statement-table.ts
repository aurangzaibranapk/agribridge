/**
 * Bank-statement jaisi tables ka SHARED style (malik, 20 Oct 2026):
 * Debit / Credit / Balance ke beech saaf faasla, raqam right (RTL mein end)
 * par, tabular-nums, hazaar ke comma, Dr/Cr ke sath balance, halki line /
 * zebra, aur mobile par horizontal scroll. Test: npm run test:statement-table
 */
export const ST = {
  /** Table ka wrapper — mobile par side scroll. */
  wrap: "overflow-x-auto rounded-lg border border-surface-200 dark:border-surface-800",
  table: "w-full min-w-[760px] border-collapse text-sm",
  thead: "bg-surface-50 dark:bg-surface-800/60",
  /** Text header (date, tafseel). */
  th: "px-4 py-2.5 text-start text-xs font-bold uppercase tracking-wide text-surface-600 dark:text-surface-300",
  /** Amount header — bold, right/end aligned, fixed min width. */
  thAmt: "[direction:ltr] min-w-[140px] w-[140px] border-s border-surface-200 px-4 py-2.5 text-end text-xs font-bold uppercase tracking-wide text-surface-600 dark:border-surface-700 dark:text-surface-300",
  /** Zebra rows. */
  tr: "border-t border-surface-100 odd:bg-white even:bg-surface-50/70 dark:border-surface-800 dark:odd:bg-transparent dark:even:bg-white/[0.03]",
  td: "px-4 py-2 text-start align-top",
  /** Amount cell (LTR andar se, taake RTL Urdu mein bhi "45,000 Cr" sahi parhe) — divider, padding, tabular-nums, end aligned, no wrap. */
  tdAmt: "[direction:ltr] min-w-[140px] w-[140px] whitespace-nowrap border-s border-surface-100 px-4 py-2 text-end tabular-nums dark:border-surface-800",
  tdBal: "[direction:ltr] min-w-[150px] w-[150px] whitespace-nowrap border-s border-surface-200 px-4 py-2 text-end font-semibold tabular-nums dark:border-surface-700",
  tfoot: "border-t-2 border-surface-300 bg-surface-50 font-semibold dark:border-surface-600 dark:bg-surface-800/60",
} as const;

/** Hazaar ke comma ke sath, Latin digits (RTL Urdu mein bhi barabar column). Khali/0 -> "—". */
export function fmtAmt(n: number | null | undefined, opts: { blankZero?: boolean } = { blankZero: true }): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || (opts.blankZero !== false && v === 0)) return "—";
  return v.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Balance + Dr/Cr. `positiveIs` batata hai ke musbat balance kis taraf hai:
 * customer / asset khata -> "Dr" (wo dega), supplier / liability -> "Cr" (hum denge).
 */
export function fmtBal(n: number | null | undefined, positiveIs: "Dr" | "Cr" = "Dr"): string {
  const v = Math.round(Number(n ?? 0) * 100) / 100;
  if (!Number.isFinite(v) || v === 0) return "0";
  const side = v > 0 ? positiveIs : positiveIs === "Dr" ? "Cr" : "Dr";
  return `${Math.abs(v).toLocaleString("en-PK", { maximumFractionDigits: 2 })} ${side}`;
}
