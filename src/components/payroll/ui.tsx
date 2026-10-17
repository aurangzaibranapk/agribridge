"use client";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { pkr } from "@/lib/recovery/credit-report";

export const PAGE = "space-y-5 bg-[#F6F7FB] p-1 text-slate-900 dark:bg-[#0b1324] dark:text-slate-100";
export const CARD = "rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#111c33]";
export const TH = "px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-400";
export const TD = "px-3 py-2.5 border-t border-slate-100 dark:border-white/[0.06]";
export const INPUT = "rounded-lg border border-slate-200 bg-[#F6F7FB] px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0b1324]";
export const BTN = "rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5 disabled:opacity-50";
export const BTN_P = "rounded-xl bg-[#0f6e4f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0c5a41] dark:bg-emerald-400 dark:text-[#062a1e] disabled:opacity-50";

export const rs = (n: number | null | undefined) => `Rs ${pkr(n)}`;
export { pkr };

type Tone = "green" | "amber" | "red" | "blue" | "gray";
const TONE: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  red: "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300",
  gray: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
};
export function Pill({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[tone]}`}>{children}</span>;
}
export const STATUS_TONE: Record<string, Tone> = {
  draft: "gray", submitted: "amber", approved: "blue", paid: "green", cancelled: "gray", rejected: "red", requested: "amber",
  active: "green", paused: "amber", completed: "blue", written_off: "red", due: "blue", partial: "amber", overdue: "red", due_today: "amber", upcoming: "gray", closed: "gray",
};
export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "red" | "green" }) {
  return (
    <div className={CARD}>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tone === "red" ? "text-red-600 dark:text-red-400" : tone === "green" ? "text-emerald-700 dark:text-emerald-300" : ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
    </div>
  );
}
export function Header({ crumb, title, children }: { crumb: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><div className="text-xs text-slate-500 dark:text-slate-400">{crumb}</div><h1 className="text-xl font-bold">{title}</h1></div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
export function Msg({ state }: { state: { error?: string; success?: string } }) {
  if (state.error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>;
  if (state.success) return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{state.success}</p>;
  return null;
}
export function Submit({ label, primary = true, name, value }: { label: string; primary?: boolean; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" name={name} value={value} disabled={pending} className={primary ? BTN_P : BTN}>{pending ? "..." : label}</button>;
}
