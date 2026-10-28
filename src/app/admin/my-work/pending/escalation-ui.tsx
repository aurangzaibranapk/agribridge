"use client";
import { useState } from "react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { catLabelKey } from "@/lib/pending/categories";
import { escalationReason, type PendingTimelineEvent } from "@/lib/pending/escalation";
import { saveDelayNote, saveEscalationSla } from "./actions";

function when(iso: string | null | undefined, lang: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(lang === "ur" ? "ur-PK" : "en-PK", { dateStyle: "medium", timeStyle: "short" });
}

function waitText(seconds: number | null | undefined) {
  if (seconds == null || seconds < 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 48) return `${Math.floor(h / 24)} din`;
  if (h >= 1) return `${h} ghante ${m} min`;
  return `${m} min`;
}

export function EscalatedBadge() {
  const lang = useLang();
  return (
    <span data-escalated-badge className="mt-1 inline-flex rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-orange-700 dark:text-orange-300">
      {t("apb_badge_escalated", lang)}
    </span>
  );
}

export function TimelinePanel({
  category,
  itemId,
  level,
  since,
  slaHours,
  events,
  canNote,
}: {
  category: string;
  itemId: string;
  level: "manager" | "escalated";
  since: string | null;
  slaHours: number;
  events: PendingTimelineEvent[];
  canNote: boolean;
}) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const who = level === "escalated" ? t("apb_level_admin_owner", lang) : t("apb_level_manager", lang);
  const hasJump = events.some((e) => e.kind === "escalated");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("category", category);
    fd.set("id", itemId);
    fd.set("note", note);
    const res = await saveDelayNote(fd);
    setBusy(false);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setNote("");
    setMsg(t("apb_done", lang));
  }

  return (
    <div data-escalation-timeline={itemId} className="mt-1">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-[11px] font-bold text-blue-700 underline dark:text-blue-300">
        {open ? t("apb_timeline_hide", lang) : t("apb_timeline", lang)}
      </button>
      {open && (
        <ol className="mt-2 space-y-1.5 border-l-2 border-orange-300 pl-3 text-[11.5px] text-surface-700 dark:text-surface-200">
          <li>
            <b>{t("apb_level_manager", lang)}</b>
            <span className="text-surface-500"> — {t("apb_with_since", lang).replace("{who}", t("apb_level_manager", lang)).replace("{when}", when(events.find((e) => e.kind === "opened")?.created_at ?? since, lang))}</span>
          </li>
          {events.filter((e) => e.kind === "escalated").map((e) => (
            <li key={e.id} data-escalation-event="escalated">
              <b>{t("apb_badge_escalated", lang)}</b>
              <span> — {e.reason || escalationReason(slaHours)}</span>
              <span className="text-surface-500"> · {t("apb_waited", lang).replace("{wait}", waitText(e.waited_seconds))} · {when(e.created_at, lang)}</span>
            </li>
          ))}
          {!hasJump && level === "escalated" && (
            <li data-escalation-event="due">
              <b>{t("apb_badge_escalated", lang)}</b>
              <span> — {escalationReason(slaHours)}</span>
            </li>
          )}
          {level === "escalated" && (
            <li>
              <b>{who}</b>
              <span className="text-surface-500"> — {t("apb_with_since", lang).replace("{who}", who).replace("{when}", when(since, lang))}</span>
            </li>
          )}
          {events.filter((e) => e.kind === "delay_note" || e.kind === "self_decision").map((e) => (
            <li key={e.id} data-escalation-event={e.kind}>
              <b>{e.kind === "self_decision" ? e.reason : t("apb_delay_placeholder", lang)}</b>
              {e.note ? <span> — {e.note}</span> : null}
              <span className="text-surface-500"> · {e.actor_name ?? ""} · {when(e.created_at, lang)}</span>
            </li>
          ))}
          {canNote && (
            <li>
              <form onSubmit={save} className="flex flex-wrap items-center gap-1.5">
                <input
                  value={note}
                  onChange={(ev) => setNote(ev.target.value)}
                  minLength={3}
                  maxLength={500}
                  placeholder={t("apb_delay_placeholder", lang)}
                  className="min-w-[12rem] flex-1 rounded-lg border border-surface-200 px-2 py-1 text-[12px] dark:border-white/10 dark:bg-white/5"
                />
                <button type="submit" disabled={busy} className="rounded-lg bg-surface-900 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-60 dark:bg-white dark:text-surface-900">
                  {t("apb_delay_save", lang)}
                </button>
              </form>
              {msg && <p className="mt-1 text-[11px] font-semibold text-amber-700">{msg}</p>}
            </li>
          )}
        </ol>
      )}
    </div>
  );
}

export function OwnerEscalationSummary({
  count,
  oldest,
  byPerson,
}: {
  count: number;
  oldest: string | null;
  byPerson: { name: string; count: number; oldest: string }[];
}) {
  const lang = useLang();
  return (
    <section data-escalation-summary className="rounded-2xl border border-orange-300/70 bg-orange-500/10 p-4">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-orange-800 dark:text-orange-200">{t("apb_esc_summary", lang)}</p>
      <div className="mt-2 flex flex-wrap gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase text-surface-500">{t("apb_esc_count", lang)}</p>
          <p className="font-display text-2xl font-extrabold tabular-nums text-orange-700 dark:text-orange-300">{count}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-surface-500">{t("apb_esc_oldest", lang)}</p>
          <p className="text-sm font-bold text-surface-800 dark:text-white">{when(oldest, lang)}</p>
        </div>
        <div className="min-w-[14rem] flex-1">
          <p className="text-[10px] font-bold uppercase text-surface-500">{t("apb_esc_by_person", lang)}</p>
          {byPerson.length === 0 ? (
            <p className="text-sm text-surface-500">{t("apb_esc_none", lang)}</p>
          ) : (
            <ul className="mt-1 space-y-0.5 text-[12.5px]">
              {byPerson.slice(0, 8).map((p) => (
                <li key={p.name} className="flex justify-between gap-3">
                  <span className="truncate font-semibold">{p.name}</span>
                  <span className="tabular-nums text-surface-500">{p.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export function SlaSettings({ options }: { options: { category: string; hours: number }[] }) {
  const lang = useLang();
  const [category, setCategory] = useState(options[0]?.category ?? "cash_handover");
  const current = options.find((o) => o.category === category)?.hours ?? 24;
  const [hours, setHours] = useState(String(current));
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("category", category);
    fd.set("hours", hours);
    const res = await saveEscalationSla(fd);
    setBusy(false);
    setMsg(res.ok ? t("apb_done", lang) : res.error);
  }

  return (
    <form data-escalation-sla onSubmit={save} className="flex flex-wrap items-end gap-2 rounded-2xl border border-surface-200 bg-white p-3 dark:border-white/10 dark:bg-[#0f1b3d]">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-surface-500">{t("apb_sla_title", lang)}</p>
        <p className="max-w-xl text-[11.5px] text-surface-500">{t("apb_sla_hint", lang)}</p>
      </div>
      <select
        value={category}
        onChange={(e) => {
          setCategory(e.target.value);
          const h = options.find((o) => o.category === e.target.value)?.hours ?? 24;
          setHours(String(h));
        }}
        className="rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-white/5"
      >
        {options.map((o) => (
          <option key={o.category} value={o.category}>{t(catLabelKey(o.category), lang)}</option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        max={720}
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        className="w-24 rounded-lg border border-surface-200 px-2 py-1.5 text-sm dark:border-white/10 dark:bg-white/5"
      />
      <button type="submit" disabled={busy} className="rounded-lg bg-[#1e3a8a] px-3 py-1.5 text-sm font-bold text-white disabled:opacity-60">
        {t("apb_sla_save", lang)}
      </button>
      {msg && <span className="text-xs font-semibold text-amber-700">{msg}</span>}
    </form>
  );
}
