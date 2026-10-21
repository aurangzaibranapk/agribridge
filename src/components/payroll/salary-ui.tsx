import type { ReactNode } from "react";

/**
 * 691: Bharti / barhotri / slip ke manzoor shuda mockup ki shakl -- Tailwind ke
 * asal green/amber/red/blue tokens (mockup ke #dcfce7/#15803d waghera yahi hain).
 */
export const SO_PAGE = "space-y-4 text-gray-800 dark:text-slate-100";
export const SO_CARD = "rounded-[14px] border border-gray-200 bg-white p-[18px] shadow-sm dark:border-white/10 dark:bg-[#111c33]";
export const SO_H3 = "mb-3 flex items-center gap-2 text-[15px] font-bold";
export const SO_LABEL = "mb-1 block text-xs text-gray-500 dark:text-slate-400";
export const SO_INPUT = "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm dark:border-white/15 dark:bg-[#0b1324]";
export const SO_BTN = "inline-flex items-center gap-1 rounded-[9px] bg-green-600 px-4 py-[9px] text-[13px] font-semibold text-white hover:bg-green-700 disabled:opacity-50";
export const SO_BTN2 = "inline-flex items-center gap-1 rounded-[9px] border border-green-600 bg-white px-4 py-[9px] text-[13px] font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50 dark:bg-transparent dark:text-green-300";
export const SO_TH = "border-b border-gray-200 p-2 text-left text-[13px] font-semibold text-gray-500 dark:border-white/10 dark:text-slate-400";
export const SO_TD = "border-b border-gray-100 p-2 text-[13px] dark:border-white/[0.06]";
export const SO_MUTED = "text-xs text-gray-500 dark:text-slate-400";

export type ChipTone = "gr" | "rd" | "am" | "bl" | "gy";
const CHIP: Record<ChipTone, string> = {
  gr: "bg-green-100 text-green-700 dark:bg-green-400/15 dark:text-green-300",
  rd: "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-300",
  am: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  bl: "bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  gy: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-slate-300",
};
export function Chip({ tone = "gy", children }: { tone?: ChipTone; children: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold ${CHIP[tone]}`}>{children}</span>;
}

const BOX = {
  exp: "border-blue-200 bg-blue-50 dark:border-blue-400/30 dark:bg-blue-400/10",
  off: "border-amber-200 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-400/10",
  acc: "border-green-300 bg-green-50 dark:border-green-400/30 dark:bg-green-400/10",
};
export function MoneyBox({ kind, chip, value, sub, small }: { kind: keyof typeof BOX; chip: ReactNode; value: ReactNode; sub?: ReactNode; small?: boolean }) {
  return (
    <div className={`rounded-xl border p-3.5 ${BOX[kind]}`}>
      {small ? <div className="text-xs text-gray-500 dark:text-slate-400">{chip}</div> : chip}
      <div className={`${small ? "text-lg" : "text-[22px]"} font-bold tabular-nums`}>{value}</div>
      {sub && <div className={SO_MUTED}>{sub}</div>}
    </div>
  );
}

export function Timeline({ items }: { items: ReactNode[] }) {
  return (
    <div className="ml-2 border-l-[3px] border-green-300 pl-4">
      {items.map((it, i) => (
        <div key={i} className="relative mb-3.5 last:mb-0 before:absolute before:-left-[23px] before:top-1 before:h-[11px] before:w-[11px] before:rounded-full before:bg-green-600 before:content-['']">{it}</div>
      ))}
    </div>
  );
}

export function PageTop({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-[22px] font-bold">{title}</h2>
        {sub && <p className="mt-1 text-[13px] text-gray-500 dark:text-slate-400">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2 print:hidden">{children}</div>}
    </div>
  );
}

export function StatCard({ label, value, tone, extra }: { label: string; value: ReactNode; tone?: "blue" | "green" | "red" | "amber"; extra?: ReactNode }) {
  const c = tone === "blue" ? "text-blue-700 dark:text-blue-300" : tone === "green" ? "text-green-700 dark:text-green-300" : tone === "red" ? "text-red-700 dark:text-red-300" : tone === "amber" ? "text-amber-700 dark:text-amber-300" : "";
  return (
    <div className={SO_CARD}>
      <div className={SO_MUTED}>{label}</div>
      <div className={`text-[22px] font-bold tabular-nums ${c}`}>{value}</div>
      {extra}
    </div>
  );
}

export function SchemaPending({ what }: { what: string }) {
  return <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">{what} ke liye database migration 691 abhi Live par nahi chali. Purana hissa chalta rahega.</p>;
}
