import Link from "next/link";
import { AlertTriangle, CalendarDays, ClipboardList, Plus, Video } from "lucide-react";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils/format";
import { isLive, pktTime } from "@/lib/hr-meetings";
import type { MeetingRow } from "@/lib/hr-meetings-data";

/** Meetings ke safhon ka mushtarka saaz-o-saman (mockup 17 Oct ke mutabiq). */
export const EVENT_COLORS = ["bg-blue-600", "bg-emerald-600", "bg-pink-600", "bg-amber-500", "bg-violet-600", "bg-cyan-600"];
export function colorFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return EVENT_COLORS[h % EVENT_COLORS.length];
}
export const BORDER_COLORS: Record<string, string> = {
  "bg-blue-600": "border-blue-600", "bg-emerald-600": "border-emerald-600", "bg-pink-600": "border-pink-600",
  "bg-amber-500": "border-amber-500", "bg-violet-600": "border-violet-600", "bg-cyan-600": "border-cyan-600",
};

export function MeetingsHero({ lang, title, sub, urdu, active }: { lang: Lang; title: TranslationKey; sub: TranslationKey; urdu: string; active: "calendar" | "actions" | "new" | "detail" }) {
  const tab = (key: typeof active, href: string, label: TranslationKey, Icon: typeof CalendarDays) => (
    <Link href={href} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
      active === key ? "border-white bg-white text-violet-700" : "border-white/40 bg-white/15 text-white hover:bg-white/25")}>
      <Icon className="h-3.5 w-3.5" /> {t(label, lang)}
    </Link>
  );
  return (
    <div className="mb-6 overflow-hidden rounded-card bg-gradient-to-r from-blue-900 via-violet-700 to-pink-600 p-6 text-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/80">HR Management › {t("hm_meetings", lang)}</p>
          <h1 className="mt-1 font-display text-2xl font-bold">{t(title, lang)}</h1>
          <p className="mt-1 text-sm text-white/85">{t(sub, lang)} <span dir="rtl" className="ms-2">{urdu}</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tab("calendar", "/admin/hr/meetings", "hm_tab_calendar", CalendarDays)}
          {tab("actions", "/admin/hr/meetings/actions", "hm_tab_actions", ClipboardList)}
          {tab("new", "/admin/hr/meetings/new", "hm_new_meeting", Plus)}
        </div>
      </div>
    </div>
  );
}

const KPI = {
  violet: "from-blue-600 to-violet-600", green: "from-emerald-600 to-emerald-500",
  amber: "from-amber-500 to-orange-500", rose: "from-rose-600 to-pink-600",
} as const;
export function Kpi({ tone, label, value, hint }: { tone: keyof typeof KPI; label: string; value: string | number; hint?: string }) {
  return (
    <div className={cn("rounded-card bg-gradient-to-br p-4 text-white shadow-card", KPI[tone])}>
      <p className="text-sm font-medium text-white/90">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">{value}</p>
      {hint && <p className="text-xs text-white/85">{hint}</p>}
    </div>
  );
}

export function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-orange-300 bg-orange-50 px-3.5 py-3 text-sm text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <div>{children}</div>
    </div>
  );
}

const PILL = {
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  red: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  gray: "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300",
} as const;
export function Pill({ tone, children }: { tone: keyof typeof PILL; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold", PILL[tone])}>{children}</span>;
}

export function Avatars({ names }: { names: string[] }) {
  const shown = names.slice(0, 3);
  return (
    <div className="flex">
      {shown.map((n, i) => (
        <span key={i} title={n} className={cn("-me-1.5 inline-grid h-7 w-7 place-items-center rounded-full border-2 border-white text-[10px] font-bold text-white dark:border-surface-900", EVENT_COLORS[i % EVENT_COLORS.length])}>
          {n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
        </span>
      ))}
      {names.length > 3 && <span className="inline-grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-surface-500 text-[10px] font-bold text-white dark:border-surface-900">+{names.length - 3}</span>}
    </div>
  );
}

export function MeetingStatusPill({ m, lang }: { m: Pick<MeetingRow, "status" | "starts_at" | "duration_min">; lang: Lang }) {
  if (m.status === "held") return <Pill tone="green">{t("hm_status_held", lang)}</Pill>;
  if (m.status === "cancelled") return <Pill tone="gray">{t("hm_status_cancelled", lang)}</Pill>;
  if (isLive(m.starts_at, m.duration_min)) return <Pill tone="blue">{t("hm_status_live", lang)}</Pill>;
  if (Date.parse(m.starts_at) < Date.now()) return <Pill tone="red">{t("hm_status_pending_minutes", lang)}</Pill>;
  return <Pill tone="amber">{t("hm_status_upcoming", lang)}</Pill>;
}

export function MeetingCard({ m, lang, showDate }: { m: MeetingRow; lang: Lang; showDate?: string }) {
  const c = colorFor(m.id);
  const names = m.hr_meeting_attendees.map((a) => a.profiles?.full_name ?? "?");
  return (
    <Link href={`/admin/hr/meetings/${m.id}`} className={cn("block rounded-xl border-s-4 bg-surface-50 p-3 transition hover:shadow-md dark:bg-surface-800/60", BORDER_COLORS[c])}>
      <div className="flex items-center justify-between gap-2">
        <b className="truncate text-sm text-surface-900 dark:text-white">{showDate ? `${showDate} · ` : ""}{pktTime(m.starts_at)} · {m.title}</b>
        <MeetingStatusPill m={m} lang={lang} />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-xs text-surface-500 dark:text-surface-400">
          {m.organizer?.full_name ?? "—"} · {m.duration_min}m · {m.meet_url ? <><Video className="inline h-3 w-3" /> Google Meet</> : m.location || t("hm_no_link", lang)}
        </span>
        <Avatars names={names} />
      </div>
    </Link>
  );
}
