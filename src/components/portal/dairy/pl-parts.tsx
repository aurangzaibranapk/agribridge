import { CAT_COLOR, CAT_ICON, rs, type ExpenseCat } from "@/lib/portal/dairy-pl";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";

/** Aamdani (hara) vs kharcha (laal) -- group bars. */
/** Screen reader ke liye chart ka seedha jumla: "Oct: Aamdani Rs 72,800, Kharcha Rs 54,400; ..." */
export function chartSummary(groups: { label: string; a: number; b: number }[], names: [string, string]): string {
  if (!groups.length) return `${names[0]} / ${names[1]}: —`;
  return groups.map((g) => `${g.label}: ${names[0]} ${rs(g.a)}, ${names[1]} ${rs(g.b)}`).join("; ");
}
export function GroupBars({ groups, names, height = 250 }: { groups: { label: string; a: number; b: number }[]; names: [string, string]; height?: number }) {
  const W = 760, H = height, n = Math.max(1, groups.length);
  const max = Math.max(1, ...groups.flatMap((g) => [g.a, g.b])) * 1.15;
  const bw = (W - 56) / n;
  const short = (v: number) => (v >= 100000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={chartSummary(groups, names)}>
        {[0, 1, 2, 3, 4].map((k) => {
          const y = H - 24 - (k * (H - 40)) / 4;
          return (<g key={k}><line x1={46} x2={W - 6} y1={y} y2={y} className="stroke-surface-200 dark:stroke-surface-800" /><text x={40} y={y + 4} fontSize={10} textAnchor="end" className="fill-surface-500 dark:fill-slate-400">{short((max * k) / 4)}</text></g>);
        })}
        {groups.map((g, i) => {
          const x = 52 + i * bw, w = (bw - 18) / 2;
          const ha = (g.a / max) * (H - 40), hb = (g.b / max) * (H - 40);
          return (
            <g key={g.label + i}>
              <rect x={x} y={H - 24 - ha} width={w} height={ha} rx={4} fill="#22c55e"><title>{rs(g.a)}</title></rect>
              <rect x={x + w + 4} y={H - 24 - hb} width={w} height={hb} rx={4} fill="#f43f5e"><title>{rs(g.b)}</title></rect>
              <text x={x + w + 2} y={H - 6} fontSize={10} textAnchor="middle" className="fill-surface-500 dark:fill-slate-400">{g.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-surface-500 dark:text-slate-400">
        <span><span className="me-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-green-500" />{names[0]}</span>
        <span><span className="me-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-rose-500" />{names[1]}</span>
      </div>
    </div>
  );
}
export function CategoryRows({ rows, lang, showPct = true }: { rows: { cat: ExpenseCat; amount: number; pct: number }[]; lang: Lang; showPct?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return (
    <div>
      {rows.map((r) => (
        <div key={r.cat} className="flex items-center gap-2.5 border-b border-surface-100 py-2.5 text-[13px] last:border-0 dark:border-surface-800">
          <span className="h-3 w-3 shrink-0 rounded" style={{ background: CAT_COLOR[r.cat] }} />
          <div className="min-w-0 flex-1">
            <span className="text-surface-800 dark:text-slate-100">{CAT_ICON[r.cat]} {t(`cat_${r.cat}` as TranslationKey, lang)}</span>
            {lang !== "ur" && <span className="ms-1.5 text-[11px] text-surface-500" dir="rtl">{t(`cat_${r.cat}` as TranslationKey, "ur")}</span>}
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800"><div className="h-full rounded-full" style={{ width: `${(r.amount / max) * 100}%`, background: CAT_COLOR[r.cat] }} /></div>
          </div>
          <b className="text-surface-900 dark:text-white">{rs(r.amount)}</b>
          {showPct && <span className="w-9 text-end text-xs text-surface-500">{r.pct}%</span>}
        </div>
      ))}
    </div>
  );
}
export function Money({ v, className = "" }: { v: number; className?: string }) {
  return <span dir="ltr" className={`ltr-iso font-bold ${v >= 0 ? "text-green-600 dark:text-green-400" : "text-rose-600 dark:text-rose-400"} ${className}`}>{v < 0 ? "-" : ""}{rs(Math.abs(v))}</span>;
}
export function Chips({ items }: { items: { href: string; label: string; on: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <a key={i.href} href={i.href} className={`rounded-full border px-3 py-1.5 text-xs ${i.on ? "border-green-600 bg-green-600 text-white" : "border-surface-200 bg-white text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:bg-surface-900 dark:text-slate-200"}`}>{i.label}</a>
      ))}
    </div>
  );
}
