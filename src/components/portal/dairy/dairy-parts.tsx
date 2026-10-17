import Link from "next/link";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";
import type { DayRow } from "@/lib/portal/dairy";
import { shortDate } from "@/components/portal/khata/khata-parts";

const OTHERS: Record<Lang, Lang[]> = { en: ["rm", "ur"], rm: ["en", "ur"], ur: ["en", "rm"] };
/** Mockup jaisa: bara label chuni zaban mein, neeche baqi do zabanein. */
export function Tri({ k, lang, className = "" }: { k: TranslationKey; lang: Lang; className?: string }) {
  return (
    <span className={className}>
      <span className="block">{t(k, lang)}</span>
      <span className="mt-0.5 block text-[11px] font-normal text-surface-500 dark:text-slate-400">
        {OTHERS[lang].map((o, i) => (
          <span key={o}>{i ? " · " : ""}<span dir={o === "ur" ? "rtl" : undefined}>{t(k, o)}</span></span>
        ))}
      </span>
    </span>
  );
}

const KPI: Record<string, string> = {
  sky: "from-sky-500 to-cyan-700", green: "from-green-500 to-green-700", violet: "from-violet-500 to-violet-700",
  amber: "from-amber-500 to-orange-700", teal: "from-teal-500 to-teal-700", rose: "from-rose-500 to-rose-700",
};
export function Kpi({ tone, label, value, sub }: { tone: string; label: string; value: string; sub: string }) {
  return (
    <div className={`relative min-h-[112px] overflow-hidden rounded-2xl bg-gradient-to-br ${KPI[tone]} p-4 text-white shadow-[0_8px_20px_-10px_rgba(0,0,0,.45)]`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/85">{label}</span>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 truncate text-[11.5px] text-white/90" title={sub}>{sub}</p>
      <span className="pointer-events-none absolute -bottom-6 -right-5 h-20 w-20 rounded-full bg-white/10" />
    </div>
  );
}

export function Hero({ title, sub, children }: { title: React.ReactNode; sub: string; children?: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-800 via-green-700 to-yellow-600 p-6 text-white shadow-lg dark:from-emerald-950 dark:via-green-900 dark:to-yellow-800">
      <span className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/10" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-white/85">{sub}</p>
        </div>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    </section>
  );
}
export function HeroBtn({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <Link href={href} className={primary ? "rounded-xl bg-white px-4 py-2 text-sm font-semibold text-green-900 shadow hover:bg-green-50" : "rounded-xl border border-white/35 bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25"}>
      {children}
    </Link>
  );
}
export function TagChip({ tag }: { tag: string }) {
  return <span className="rounded-md border border-yellow-300 bg-yellow-100 px-1.5 py-0.5 font-mono text-xs font-bold text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">#{tag}</span>;
}
export function Tabs({ items }: { items: { href: string; label: string; on: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <Link key={i.href} href={i.href} scroll={false} className={`rounded-full border px-3 py-1 text-xs ${i.on ? "border-green-600 bg-green-600 text-white" : "border-surface-200 text-surface-500 hover:bg-surface-50 dark:border-surface-700 dark:text-slate-400 dark:hover:bg-surface-800"}`}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}

/** Subah (neela) + shaam upar jama (jamni) area chart. */
export function MilkChart({ series, lang, height = 250 }: { series: DayRow[]; lang: Lang; height?: number }) {
  const W = 760, H = height, n = series.length;
  const max = Math.max(1, ...series.map((d) => d.total)) * 1.15;
  const X = (i: number) => 40 + (n <= 1 ? 0 : (i * (W - 52)) / (n - 1));
  const Y = (v: number) => H - 24 - (v / max) * (H - 40);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
  const am = series.map((d) => d.am), tot = series.map((d) => d.total);
  const base = `L${X(n - 1)},${H - 24} L${X(0)},${H - 24}Z`;
  const step = Math.max(1, Math.round(n / 6));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="milk chart">
      <defs>
        <linearGradient id="dyAm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0ea5e9" stopOpacity=".35" /><stop offset="1" stopColor="#0ea5e9" stopOpacity="0" /></linearGradient>
        <linearGradient id="dyPm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a855f7" stopOpacity=".25" /><stop offset="1" stopColor="#a855f7" stopOpacity="0" /></linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((k) => {
        const y = H - 24 - (k * (H - 40)) / 4;
        return (
          <g key={k}>
            <line x1={40} x2={W - 10} y1={y} y2={y} className="stroke-surface-200 dark:stroke-surface-800" />
            <text x={34} y={y + 4} fontSize={10} textAnchor="end" className="fill-surface-500 dark:fill-slate-400">{Math.round((max * k) / 4)}</text>
          </g>
        );
      })}
      {n > 1 && (
        <>
          <path d={`${path(tot)} ${base}`} fill="url(#dyPm)" />
          <path d={path(tot)} stroke="#a855f7" strokeWidth={2} fill="none" />
          <path d={`${path(am)} ${base}`} fill="url(#dyAm)" />
          <path d={path(am)} stroke="#0ea5e9" strokeWidth={2.5} fill="none" />
        </>
      )}
      {series.map((d, i) => (i % step === 0 || i === n - 1) && (
        <text key={d.date} x={X(i)} y={H - 6} fontSize={10} textAnchor="middle" className="fill-surface-500 dark:fill-slate-400">{shortDate(d.date, lang)}</text>
      ))}
    </svg>
  );
}
export function ChartLegend({ lang }: { lang: Lang }) {
  return (
    <div className="mt-1 flex flex-wrap gap-4 text-xs text-surface-500 dark:text-slate-400">
      <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-sky-500" />{t("dy_morning", lang)} (AM)</span>
      <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-violet-500" />{t("dy_evening", lang)} (PM) · {t("dy_stack_note", lang)}</span>
    </div>
  );
}

export function Donut({ parts, size = 170, centre, word }: { parts: { label: string; value: number; color: string }[]; size?: number; centre: number; word: string }) {
  const T = parts.reduce((s, p) => s + p.value, 0) || 1, r = size / 2 - 14, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width={size} height={size}>
        <circle r={r} cx={size / 2} cy={size / 2} fill="none" strokeWidth={20} className="stroke-surface-100 dark:stroke-surface-800" />
        {parts.map((p) => {
          const l = (p.value / T) * c;
          const el = <circle key={p.label} r={r} cx={size / 2} cy={size / 2} fill="none" stroke={p.color} strokeWidth={20} strokeDasharray={`${l} ${c - l}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
          acc += l;
          return el;
        })}
        <text x={size / 2} y={size / 2} textAnchor="middle" fontSize={22} fontWeight={800} className="fill-surface-900 dark:fill-white">{centre}</text>
        <text x={size / 2} y={size / 2 + 16} textAnchor="middle" fontSize={10} className="fill-surface-500 dark:fill-slate-400">{word}</text>
      </svg>
      <div className="grid gap-2 text-[13px] text-surface-700 dark:text-slate-200">
        {parts.map((p) => (
          <div key={p.label}><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />{p.label} <b>{p.value}</b></div>
        ))}
      </div>
    </div>
  );
}
export function Spark({ values }: { values: number[] }) {
  if (!values.some((v) => v > 0)) return <span className="text-surface-400">—</span>;
  const mx = Math.max(...values), mn = Math.min(...values) - 1;
  const down = values[values.length - 1] < (values.find((v) => v > 0) ?? 0);
  const d = values.map((x, i) => `${i ? "L" : "M"}${(4 + (i * 82) / (values.length - 1)).toFixed(1)},${(22 - ((x - mn) / (mx - mn || 1)) * 18).toFixed(1)}`).join("");
  return <svg width={90} height={26}><path d={d} stroke={down ? "#f43f5e" : "#22c55e"} strokeWidth={2} fill="none" /></svg>;
}
export const STATUS_COLOR: Record<string, string> = { milking: "#22c55e", pregnant: "#a855f7", dry: "#f59e0b", heifer: "#0ea5e9", calf: "#38bdf8", bull: "#64748b" };
export function Footer({ lang }: { lang: Lang }) {
  return <p className="text-center text-[11px] text-surface-500 dark:text-slate-400">{t("dy_footer", lang)}</p>;
}
export const fmtL = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("en-IN")} L`;
