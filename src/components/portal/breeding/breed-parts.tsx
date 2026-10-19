import Link from "next/link";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";
import { EVENT_COLOR, TASK_STYLE, relDays, type CalItem, type DueTask } from "@/lib/portal/breeding";
import { shortDate } from "@/components/portal/khata/khata-parts";

const OTHERS: Record<Lang, Lang[]> = { en: ["rm", "ur"], rm: ["en", "ur"], ur: ["en", "rm"] };
/** Doosri do zabanein chhote harf mein (mockup jaisa). */
export function Sub2({ k, lang, className = "" }: { k: TranslationKey; lang: Lang; className?: string }) {
  return (
    <span className={className}>
      {OTHERS[lang].map((o, i) => <span key={o}>{i ? " · " : ""}<span dir={o === "ur" ? "rtl" : undefined}>{t(k, o)}</span></span>)}
    </span>
  );
}
const TONES: Record<string, string> = {
  violet: "from-violet-500 to-violet-700", indigo: "from-indigo-500 to-indigo-700", sky: "from-sky-500 to-cyan-700", rose: "from-rose-500 to-rose-700",
  teal: "from-teal-500 to-teal-700", amber: "from-amber-500 to-orange-700", green: "from-green-500 to-green-700", lime: "from-lime-500 to-lime-700",
};
export function BKpi({ tone, k, lang, value, sub }: { tone: string; k: TranslationKey; lang: Lang; value: string; sub: string }) {
  return (
    <div className={`relative min-h-[118px] overflow-hidden rounded-2xl bg-gradient-to-br ${TONES[tone]} p-4 text-white shadow-[0_8px_20px_-10px_rgba(0,0,0,.45)]`}>
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-white/90">{t(k, lang)}</span>
      <Sub2 k={k} lang={lang} className="block truncate text-[10.5px] text-white/80" />
      <p className="mt-2 text-2xl font-bold tracking-tight"><span dir="ltr" className="ltr-iso">{value}</span></p>
      <p className="mt-1 truncate text-[11.5px] text-white/90" title={sub}>{sub}</p>
      <span className="pointer-events-none absolute -bottom-6 -end-5 h-20 w-20 rounded-full bg-white/10" />
    </div>
  );
}
export function BHero({ title, sub, children, admin }: { title: React.ReactNode; sub: string; children?: React.ReactNode; admin?: boolean }) {
  return (
    <section className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-lg ${admin ? "bg-gradient-to-r from-blue-900 via-teal-700 to-yellow-600" : "bg-gradient-to-r from-emerald-800 via-green-700 to-yellow-600 dark:from-emerald-950 dark:via-green-900 dark:to-yellow-800"}`}>
      <span className="pointer-events-none absolute -end-16 -top-20 h-72 w-72 rounded-full bg-white/10" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight">{title}</h1><p className="mt-1 text-sm text-white/85">{sub}</p></div>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    </section>
  );
}
export function H3({ k, lang, right }: { k: TranslationKey; lang: Lang; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 className="text-[15px] font-semibold text-surface-900 dark:text-white">{t(k, lang)}</h3>
        <Sub2 k={k} lang={lang} className="text-xs text-surface-500 dark:text-slate-400" />
      </div>
      {right}
    </div>
  );
}

/** Kaam ka unwan + tafseel (zaban ke hisaab se). */
export function taskTitle(task: DueTask, lang: Lang): string { return t(`bh_t_${task.task}` as TranslationKey, lang); }
export function taskDetail(task: DueTask, lang: Lang, asOf: string): string {
  const L = (k: TranslationKey) => t(k, lang);
  const who = task.tag_no ? `#${task.tag_no}${task.animal_name ? ` ${task.animal_name}` : ""}` : "";
  const i = task.info as Record<string, string | number | boolean | null>;
  const d = (x: unknown) => (x ? shortDate(String(x), lang, Number(asOf.slice(0, 4))) : "—");
  switch (task.task) {
    case "dry_off": return `${who} · ${L("bh_d_calving_in")} ${relDays(String(i.expected ?? task.until_date ?? task.due_date), asOf)} ${L("bh_days")}`;
    case "calving": return `${who} · ${L("bh_d_expected")} ${d(task.due_date)} (${i.days ?? 283} ${L("bh_days")})`;
    case "pd_due": return `${who} · AI ${d(i.service_date)} · 35-45 ${L("bh_days")}: ${d(task.due_date)} - ${d(task.until_date)}`;
    case "heat_watch": return `${who} · ${L("bh_d_cycle")}${Number(i.services) >= 3 ? ` · ${L("bh_d_repeat")}` : ""}`;
    case "no_heat": return `${who} · ${L("bh_d_noheat")} (${i.dim ?? "—"} DIM)`;
    case "vaccine": return `${String(i.code)} · ${i.count} ${L("bh_animals")}`;
    case "vaccine_gap": return `${String(i.code)} · ${i.count} ${L("bh_d_missing")}`;
    case "withheld": return `${who} · ${i.medicine ?? ""} · ${d(task.due_date)} ${L("bh_d_until_nosell")}`;
    case "deworm": return `${L("bh_d_all_animals")} · ${L("bh_d_last")} ${d(i.last)}`;
  }
}
export function whenBadge(task: DueTask, lang: Lang, asOf: string): { text: string; tone: string } {
  const n = relDays(task.due_date, asOf);
  if (task.task === "withheld") return { text: `${n} ${t("bh_days_left", lang)}`, tone: "rose" };
  if (task.task === "pd_due" && n <= 0 && task.until_date && task.until_date >= asOf) return { text: t("bh_today", lang), tone: "amber" };
  if (n < 0) return { text: `${t("bh_overdue", lang)} ${-n} ${t("bh_days", lang)}`, tone: "rose" };
  if (n === 0) return { text: t("bh_today", lang), tone: "amber" };
  return { text: `${n} ${t("bh_days_later", lang)}`, tone: n <= 7 ? "indigo" : "slate" };
}
const BADGE: Record<string, string> = {
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200", amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200", slate: "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-slate-200",
  green: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-200", violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200",
};
export function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${BADGE[tone] ?? BADGE.slate}`}>{children}</span>;
}
export function AlertRow({ task, lang, asOf, children }: { task: DueTask; lang: Lang; asOf: string; children?: React.ReactNode }) {
  const st = TASK_STYLE[task.task];
  const b = whenBadge(task, lang, asOf);
  const href = task.animal_id ? `/portal/dairy/breeding/animal/${task.animal_id}` : task.task.startsWith("vaccine") || task.task === "deworm" ? "/portal/dairy/health" : undefined;
  const body = (
    <div className="min-w-0 flex-1">
      <b className="text-surface-900 dark:text-white">{taskTitle(task, lang)}</b>{" "}
      {lang !== "ur" && <span dir="rtl" className="text-xs text-surface-500 dark:text-slate-400">{t(`bh_t_${task.task}` as TranslationKey, "ur")}</span>}
      <div className="truncate text-xs text-surface-500 dark:text-slate-400">{taskDetail(task, lang, asOf)}</div>
    </div>
  );
  return (
    <div className="mb-2 flex items-center gap-3 rounded-xl border border-s-4 border-surface-200 bg-surface-50 px-3 py-2.5 text-[13px] dark:border-surface-700 dark:bg-surface-800/60" style={{ borderInlineStartColor: st.color }}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-surface-200 bg-white text-base dark:border-surface-700 dark:bg-surface-900">{st.icon}</span>
      {href ? <Link href={href} className="min-w-0 flex-1">{body}</Link> : body}
      <div className="flex shrink-0 items-center gap-1.5"><Pill tone={b.tone}>{b.text}</Pill>{children}</div>
    </div>
  );
}

const LEG: [string, TranslationKey][] = [["heat", "bh_lg_heat"], ["ai", "bh_lg_ai"], ["pd", "bh_lg_pd"], ["calving", "bh_lg_calving"], ["dry_off", "bh_lg_dry"], ["vaccine", "bh_lg_vaccine"], ["deworm", "bh_lg_deworm"], ["treatment", "bh_lg_treatment"]];
export function Legend({ lang }: { lang: Lang }) {
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-[11.5px] text-surface-500 dark:text-slate-400">
      {LEG.map(([k, key]) => <span key={k}><span className="me-1.5 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ background: EVENT_COLOR[k] }} />{t(key, lang)}</span>)}
    </div>
  );
}
const DOW: TranslationKey[] = ["bh_dow_mon", "bh_dow_tue", "bh_dow_wed", "bh_dow_thu", "bh_dow_fri", "bh_dow_sat", "bh_dow_sun"];
export function Calendar({ cells, items, asOf, lang }: { cells: { date: string; inMonth: boolean }[]; items: CalItem[]; asOf: string; lang: Lang }) {
  const by = new Map<string, CalItem[]>();
  for (const i of items) { const l = by.get(i.date) ?? []; l.push(i); by.set(i.date, l); }
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {DOW.map((d) => <div key={d} className="py-0.5 text-center text-[10.5px] font-bold uppercase tracking-wider text-surface-500 dark:text-slate-400">{t(d, lang)}</div>)}
      {cells.map((c) => {
        const list = by.get(c.date) ?? [];
        const today = c.date === asOf;
        return (
          <div key={c.date} className={`flex min-h-[78px] flex-col gap-1 rounded-lg border p-1.5 text-[11px] ${today ? "border-2 border-green-600 shadow-[0_0_0_3px_rgba(22,163,74,.15)]" : "border-surface-200 dark:border-surface-700"} ${c.inMonth ? "bg-surface-50 dark:bg-surface-800/60" : "bg-surface-50/40 opacity-40 dark:bg-surface-800/30"}`}>
            <span className="text-[11.5px] font-bold text-surface-800 dark:text-slate-100">{Number(c.date.slice(8))}{!c.inMonth ? ` ${shortDate(c.date, lang).split(" ")[1] ?? ""}` : ""}{today ? ` · ${t("bh_today", lang)}` : ""}</span>
            {list.slice(0, 3).map((i, n) => (
              <span key={n} className="truncate rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: EVENT_COLOR[i.type] ?? "#64748b" }} title={i.label}>{i.label}</span>
            ))}
            {list.length > 3 && <span className="text-[10px] text-surface-500">+{list.length - 3}</span>}
          </div>
        );
      })}
    </div>
  );
}
export function Ring({ pct, color }: { pct: number | null; color: string }) {
  const p = pct ?? 0;
  return (
    <span className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${color} ${p}%, rgba(148,163,184,.25) 0)` }}>
      <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-[11.5px] font-extrabold text-surface-900 dark:bg-surface-900 dark:text-white">{pct === null ? "—" : `${p}%`}</span>
    </span>
  );
}
export function TLItem({ color, date, title, sub }: { color: string; date: string; title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="relative pb-4">
      <span className="absolute -start-[23px] top-0.5 h-3.5 w-3.5 rounded-full ring-[3px] ring-white dark:ring-surface-900" style={{ background: color, boxShadow: `0 0 0 5px ${color}33` }} />
      <span className="float-end text-[11.5px] text-surface-500 dark:text-slate-400">{date}</span>
      <b className="text-[13px] text-surface-900 dark:text-white">{title}</b>
      {sub && <p className="mt-0.5 text-xs text-surface-500 dark:text-slate-400">{sub}</p>}
    </div>
  );
}
export function Bar({ pct, color }: { pct: number; color: string }) {
  return <div className="h-2 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} /></div>;
}
export function monthLabel(month: string, lang: Lang): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "ur" ? "ur-PK" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));
}
/** ?e= sirf asal bh_/dy_ key ho to dikhao. */
export function BErrorNote({ e, lang }: { e?: string; lang: Lang }) {
  if (!e) return null;
  const ok = /^(bh|dy|dy2)_err_[a-z_]+$/.test(e) && t(e as TranslationKey, lang) !== e;
  return <p className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">{t((ok ? e : "bh_err_generic") as TranslationKey, lang)}</p>;
}
