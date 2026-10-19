import Link from "next/link";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";

const OTHERS: Record<Lang, Lang[]> = { en: ["rm", "ur"], rm: ["en", "ur"], ur: ["en", "rm"] };
/** Ek line: chuni zaban + chhote mein baqi do (mockup jaisa). */
export function L3({ k, lang, className = "" }: { k: TranslationKey; lang: Lang; className?: string }) {
  return (
    <span className={className}>
      {t(k, lang)}{" "}
      <span className="text-[10.5px] font-normal opacity-70">
        · {OTHERS[lang].map((o, i) => <span key={o}>{i ? " · " : ""}<span dir={o === "ur" ? "rtl" : undefined}>{t(k, o)}</span></span>)}
      </span>
    </span>
  );
}
export function PageHead({ title, sub }: { title: React.ReactNode; sub: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-extrabold tracking-tight text-surface-900 dark:text-white">{title}</h1>
      <p className="mt-1 text-[13px] text-surface-500 dark:text-slate-400">{sub}</p>
    </div>
  );
}
export function CHero({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="relative mb-4 overflow-hidden rounded-[20px] bg-gradient-to-r from-blue-700 via-violet-600 to-pink-600 p-6 text-white shadow-[0_14px_34px_rgba(76,29,149,.25)] dark:from-blue-900 dark:via-violet-800 dark:to-pink-800">
      <span className="pointer-events-none absolute -right-16 -top-16 h-60 w-60 rounded-full bg-white/10" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div>{children}</div>
        <div className="flex flex-wrap gap-2">{right}</div>
      </div>
    </section>
  );
}
export function HBtn({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link href={href} className={primary ? "rounded-xl bg-white px-4 py-2.5 text-[12.5px] font-bold text-indigo-950 shadow hover:bg-indigo-50" : "rounded-xl border border-white/35 bg-white/15 px-4 py-2.5 text-[12.5px] font-bold text-white hover:bg-white/25"}>
      {children}
    </Link>
  );
}
const BAR: Record<string, string> = { blue: "bg-blue-600", green: "bg-emerald-600", amber: "bg-amber-500", pink: "bg-pink-600", violet: "bg-violet-600", rose: "bg-rose-600", slate: "bg-slate-500" };
const ICBG: Record<string, string> = { blue: "bg-blue-100 dark:bg-blue-500/20", green: "bg-emerald-100 dark:bg-emerald-500/20", amber: "bg-amber-100 dark:bg-amber-500/20", pink: "bg-pink-100 dark:bg-pink-500/20", violet: "bg-violet-100 dark:bg-violet-500/20", rose: "bg-rose-100 dark:bg-rose-500/20", slate: "bg-slate-100 dark:bg-slate-500/20" };
export function CKpi({ tone, icon, label, value, sub }: { tone: string; icon: string; label: React.ReactNode; value: string; sub: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-surface-200 bg-white p-4 shadow-sm dark:border-[#1e3160] dark:bg-[#101f42]">
      <span className={`absolute inset-y-0 left-0 w-1 ${BAR[tone] ?? BAR.blue}`} />
      <span className={`float-right grid h-9 w-9 place-items-center rounded-xl text-lg ${ICBG[tone] ?? ICBG.blue}`}>{icon}</span>
      <div className="text-[11.5px] font-semibold text-surface-500 dark:text-slate-400">{label}</div>
      <div className="mt-1.5 text-[22px] font-extrabold text-surface-900 dark:text-white">{value}</div>
      <div className="mt-0.5 truncate text-[11px] text-surface-500 dark:text-slate-400" title={sub}>{sub}</div>
    </div>
  );
}
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-surface-200 bg-white p-4 shadow-sm sm:p-5 dark:border-[#1e3160] dark:bg-[#101f42] ${className}`}>{children}</div>;
}
export function PanelHead({ title, right }: { title: React.ReactNode; right?: React.ReactNode }) {
  return <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><b className="text-[14px] text-surface-900 dark:text-white">{title}</b>{right}</div>;
}
const BADGE: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/70 dark:text-amber-200",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/70 dark:text-blue-200",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-900/70 dark:text-rose-200",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-900/70 dark:text-violet-200",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};
export function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${BADGE[tone] ?? BADGE.slate}`}>{children}</span>;
}
export const STATUS_TONE: Record<string, string> = {
  done: "green", completed: "green", delivered: "green", approved: "green", verified: "green", kept: "green", closed: "slate", reviewed: "blue",
  submitted: "amber", checked: "violet", pending: "amber", open: "amber", dispatched: "blue", partly: "rose", broken: "rose", rejected: "rose",
  returned: "violet", partially_returned: "violet", none: "blue", active: "green", suspended: "rose",
};
export function Lock({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50 px-3 py-2.5 text-[11.5px] text-surface-500 dark:border-[#1e3160] dark:bg-[#0d1a3a] dark:text-slate-400">🔐 {children}</div>;
}
export function Code({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono text-[11px] text-indigo-900 dark:bg-[#1a2c58] dark:text-indigo-100">{children}</span>;
}
export function Steps({ labels, done }: { labels: string[]; done: number }) {
  return (
    <div className="my-3 flex">
      {labels.map((l, i) => (
        <div key={l} className="flex-1 text-center text-[10.5px] text-surface-500 dark:text-slate-400">
          <span className={`mx-auto mb-1.5 block h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-[#101f42] ${i < done ? "bg-emerald-500" : i === done ? "bg-amber-500" : "bg-surface-200 dark:bg-[#1e3160]"}`} />
          {l}
        </div>
      ))}
    </div>
  );
}
/** 12 maheene: khareedari bars (violet->blue) + adaigi line (green). */
export function BuyPayChart({ data, height = 150 }: { data: { month: string; buy: number; paid: number }[]; height?: number }) {
  const W = 440, H = 130, max = Math.max(1, ...data.map((d) => Math.max(d.buy, d.paid)));
  const step = W / Math.max(1, data.length);
  const y = (v: number) => H - 6 - (v / max) * (H - 16);
  const pts = data.map((d, i) => `${i * step + step / 2},${y(d.paid)}`).join(" ");
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="chart">
      <defs><linearGradient id="cpbar" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#7c3aed" /><stop offset="1" stopColor="#2563eb" /></linearGradient></defs>
      {data.map((d, i) => <rect key={d.month} x={i * step + step * 0.2} y={y(d.buy)} width={step * 0.6} height={Math.max(0, H - 6 - y(d.buy))} rx={5} fill="url(#cpbar)"><title>{d.month}</title></rect>)}
      <polyline fill="none" stroke="#10b981" strokeWidth={3} points={pts} />
    </svg>
  );
}
export function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 border-b border-dashed border-surface-200 py-2.5 text-[13px] last:border-0 dark:border-[#1e3160]">{children}</div>;
}
export function Sub({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] text-surface-500 dark:text-slate-400">{children}</div>;
}
export function Notice({ tone, children }: { tone: "ok" | "err"; children: React.ReactNode }) {
  return <div className={`mb-4 rounded-xl px-4 py-2.5 text-sm font-semibold ${tone === "ok" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-rose-50 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"}`}>{children}</div>;
}
export const inputCls = "w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-[13px] font-semibold text-surface-900 dark:border-[#1e3160] dark:bg-[#0d1a3a] dark:text-white";
export const btnPrimary = "rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-[12.5px] font-bold text-white shadow hover:opacity-95 disabled:opacity-50";
export const btnGhost = "rounded-xl border border-surface-200 bg-white px-3.5 py-2 text-[12px] font-bold text-surface-800 hover:bg-surface-50 dark:border-[#1e3160] dark:bg-[#101f42] dark:text-slate-100";
export function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <label className="mb-3 block"><span className="mb-1 block text-[11px] font-semibold text-surface-500 dark:text-slate-400">{label}</span>{children}</label>;
}
