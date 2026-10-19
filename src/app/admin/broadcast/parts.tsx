import Link from "next/link";
import type { ReactNode } from "react";

export const STATUS_TONE: Record<string, string> = {
  draft: "bg-surface-100 text-surface-700 dark:bg-white/10 dark:text-slate-300",
  pending_approval: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  approved: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  sending: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  cancelled: "bg-surface-100 text-surface-500 dark:bg-white/5 dark:text-slate-400",
  queued: "bg-surface-100 text-surface-700 dark:bg-white/10 dark:text-slate-300",
  skipped_optout: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300",
  sent: "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  read: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  failed: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  REJECTED: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  PAUSED: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300",
  DISABLED: "bg-surface-100 text-surface-500 dark:bg-white/5 dark:text-slate-400",
};

export function Pill({ s, label }: { s: string; label?: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[s] ?? STATUS_TONE.draft}`}>{label ?? s.replace(/_/g, " ")}</span>;
}

export function BHero({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-700 to-emerald-500 px-5 py-3.5 text-white shadow-sm dark:from-[#0b2a4a] dark:via-[#0e3a5c] dark:to-[#0f5c4c]">
      <div><h1 className="text-lg font-bold">📢 {title}</h1>{sub ? <p className="text-xs text-white/80">{sub}</p> : null}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function HeroLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-emerald-900 shadow-sm hover:bg-emerald-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/20">{children}</Link>;
}

export function Kpi({ label, value, tone = "" }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white px-3.5 py-2.5 dark:border-white/10 dark:bg-[#111a2e]">
      <div className="text-[11.5px] text-surface-500 dark:text-slate-400">{label}</div>
      <div className={`mt-0.5 text-xl font-bold text-surface-900 dark:text-white ${tone}`}>{value}</div>
    </div>
  );
}

export function Panel({ title, right, children, className = "" }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex min-h-0 flex-col rounded-2xl border border-surface-200 bg-white p-3.5 dark:border-white/10 dark:bg-[#111a2e] ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-[13.5px] font-semibold text-surface-900 dark:text-white">{title}</h2>{right}</div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  );
}

export const TH = "sticky top-0 bg-surface-50 px-2 py-1.5 text-start text-[11.5px] font-semibold text-surface-500 dark:bg-[#0f1729] dark:text-slate-400";
export const TD = "border-b border-surface-100 px-2 py-1.5 text-[12.5px] text-surface-800 dark:border-white/5 dark:text-slate-200";
export const INPUT = "w-full rounded-lg border border-surface-300 bg-white px-2.5 py-1.5 text-sm text-surface-900 dark:border-white/15 dark:bg-[#0f1729] dark:text-white";
export const BTN = "rounded-xl bg-emerald-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50";
export const BTN_O = "rounded-xl border border-surface-300 px-3.5 py-2 text-sm font-semibold text-surface-700 hover:bg-surface-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5";
export const fmtPkt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) + " PKT" : "—");
export const fmtTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
