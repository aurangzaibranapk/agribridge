import type { Lang } from "@/lib/i18n/translations";

const MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_UR = ["جنوری", "فروری", "مارچ", "اپریل", "مئی", "جون", "جولائی", "اگست", "ستمبر", "اکتوبر", "نومبر", "دسمبر"];
const MON_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const parts = (iso: string | null) => {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? { y: +m[1], mo: +m[2] - 1, d: +m[3] } : null;
};
/** "12 Oct" (saal sirf jab as_of ke saal se mukhtalif ho). */
export function shortDate(iso: string | null, lang: Lang, thisYear?: number): string {
  const p = parts(iso);
  if (!p) return "—";
  const mon = lang === "ur" ? MON_UR[p.mo] : MON_EN[p.mo];
  return `${p.d} ${mon}${thisYear && p.y !== thisYear ? ` ${p.y}` : ""}`;
}
export function longDate(iso: string | null, lang: Lang): string {
  const p = parts(iso);
  if (!p) return "—";
  return `${p.d} ${lang === "ur" ? MON_UR[p.mo] : MON_FULL[p.mo]} ${p.y}`;
}

export function Card({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <div id={id} className={`rounded-2xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900 ${className}`}>
      {children}
    </div>
  );
}

export function CardHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-[15px] font-semibold text-surface-900 dark:text-white">{title}</h3>
        {sub && <p className="text-xs text-surface-500 dark:text-slate-400">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

const BADGE: Record<string, string> = {
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200",
  slate: "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-slate-200",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
};
export function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${BADGE[tone] ?? BADGE.slate}`}>{children}</span>;
}

export function HeroPill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/15 px-3 py-1">{children}</span>;
}

const TONES: Record<string, string> = {
  rose: "from-rose-500 to-rose-700",
  sky: "from-sky-500 to-cyan-700",
  lime: "from-lime-500 to-green-700",
  violet: "from-violet-500 to-indigo-700",
};
export function SourceCard({ tone, label, value, sub, href }: { tone: string; label: string; value: string; sub: string; href?: string }) {
  const body = (
    <>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/85">{label}</span>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 truncate text-[11.5px] text-white/90" title={sub}>{sub}</p>
      <span className="pointer-events-none absolute -bottom-6 -right-5 h-20 w-20 rounded-full bg-white/10" />
    </>
  );
  const cls = `relative block min-h-[104px] overflow-hidden rounded-2xl bg-gradient-to-br ${TONES[tone]} p-4 text-white shadow-[0_8px_20px_-10px_rgba(0,0,0,.45)]`;
  return href ? <a href={href} className={`${cls} transition hover:-translate-y-0.5`}>{body}</a> : <div className={cls}>{body}</div>;
}
