import Link from "next/link";
import type { CSSProperties } from "react";
import { Banknote, Box, CalendarClock, FileText, MessageCircle, Plus, Scale, TrendingDown, TrendingUp, Wallet, Leaf, User, Link2 } from "lucide-react";
import type { Party360Data, Tone, Kpi, Section, AgingBuckets } from "@/lib/intelligence/party360/core";
import { ROLE_LABEL } from "@/lib/intelligence/party360/activity";
import type { CreditPosition } from "@/lib/recovery/credit-position";
import { CreditPositionStrip } from "@/components/recovery/credit-position-strip";
import { ACCENT, kpiIcon, short } from "./theme";
import type { CreditReport } from "@/lib/recovery/credit-report-load";
import { CreditReportCard } from "./credit-report-card";

/* Theme A (light premium) + Theme B (soft dark pro) — Tailwind `dark` class se. */
const PAGE = "bg-[#F6F7FB] text-slate-900 dark:bg-[#172033] dark:text-slate-100";
const CARD = "rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_-12px_rgba(16,24,40,.12)] dark:border-white/10 dark:bg-[#24324a] dark:shadow-[0_8px_24px_-12px_rgba(0,0,0,.45)]";
const MUTE = "text-slate-500 dark:text-slate-400";
const TITLE = "text-sm font-semibold text-slate-900 dark:text-slate-100";
const ROW = "border-t border-slate-100 dark:border-white/[0.06]";
const TXT: Record<Tone, string> = { neutral: "", good: "text-emerald-600 dark:text-emerald-400", bad: "text-red-600 dark:text-red-400", warn: "text-amber-600 dark:text-amber-400", info: "text-blue-600 dark:text-blue-400" };
const TONEHEX: Record<Tone, string> = { neutral: "#64748B", good: "#059669", bad: "#DC2626", warn: "#D97706", info: "#2563EB" };
const LABEL: Record<Party360Data["type"], string> = { farmer: "Kisan", customer: "Customer", dealer: "Dealer", supplier: "Supplier", buyer: "Grain buyer" };
const ICONS = { rs: Banknote, box: Box, scale: Scale, up: TrendingUp, down: TrendingDown, clock: CalendarClock, cash: Wallet, leaf: Leaf, user: User } as const;
const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;
const fmt = (k: Kpi) => k.value == null ? "—" : typeof k.value === "string" ? k.value : k.fmt === "rs" ? rs(k.value) : k.fmt === "kg" ? `${Math.round(k.value).toLocaleString("en-PK")} kg` : Math.round(k.value).toLocaleString("en-PK");

function Bars({ months, series, acc }: { months: string[]; series: { name: string; values: number[]; color: string }[]; acc: [string, string] }) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const multi = series.length > 1;
  return (
    <div>
      <div className="mt-10 flex h-52 items-end gap-4">
        {months.map((m, i) => (
          <div key={m + i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <div className="flex h-full w-full items-end justify-center gap-1">
              {series.map((s, si) => {
                const v = s.values[i];
                const bg = multi ? undefined : `linear-gradient(180deg, ${acc[0]}, ${acc[1]})`;
                return (
                  <div key={s.name} className="group relative flex h-full w-full max-w-[46px] items-end">
                    <div className={`w-full rounded-b-[4px] rounded-t-[10px] transition-all duration-200 group-hover:opacity-100 group-hover:brightness-110 ${multi ? s.color : ""} ${v ? "opacity-85" : "opacity-25"}`} style={{ height: `${Math.max(4, (v / max) * 100)}%`, background: bg }} />
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg group-hover:block dark:bg-white dark:text-slate-900">
                      <div className="font-semibold">{m}</div>{s.name}: {rs(v)}
                    </div>
                    {si === 0 && !multi && v > 0 && <span className={`absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] tabular-nums ${MUTE}`}>{short(v)}</span>}
                  </div>
                );
              })}
            </div>
            <div className={`text-[11px] ${MUTE}`}>{m}</div>
          </div>
        ))}
      </div>
      {multi && <div className={`mt-3 flex flex-wrap gap-4 text-[11px] ${MUTE}`}>{series.map((s) => <span key={s.name} className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${s.color}`} />{s.name}</span>)}</div>}
    </div>
  );
}

function Aging({ a, note }: { a: AgingBuckets; note?: string }) {
  const parts: [string, number, string][] = [["0–30 din", a.d0_30, "#10B981"], ["31–60", a.d31_60, "#F59E0B"], ["61–90", a.d61_90, "#F97316"], ["90+", a.d90p, "#EF4444"]];
  return (
    <div>
      {note && <p className={`text-[12px] ${MUTE}`}>{note}</p>}
      <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">{parts.map(([l, v, c]) => <div key={l} style={{ width: `${a.total ? (v / a.total) * 100 : 0}%`, background: c }} />)}</div>
      <div className="mt-5 grid grid-cols-2 gap-4">{parts.map(([l, v, c]) => <div key={l}><div className={`flex items-center gap-1.5 text-[11px] ${MUTE}`}><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</div><div className="text-sm font-semibold tabular-nums">{rs(v)}</div></div>)}</div>
    </div>
  );
}

function SectionCard({ s }: { s: Section }) {
  return (
    <div className={`${CARD} p-6`}>
      <h3 className={TITLE}>{s.title}</h3>
      {s.note && <p className={`mt-0.5 text-[12px] ${MUTE}`}>{s.note}</p>}
      {s.rows.length ? (
        <div className="mt-3 overflow-x-auto"><table className="w-full text-[13px]">
          {s.columns.some(Boolean) && <thead><tr>{s.columns.map((c, i) => <th key={i} className={`pb-2 pr-3 text-left text-[11px] font-medium uppercase tracking-wider ${MUTE}`}>{c}</th>)}</tr></thead>}
          <tbody>{s.rows.map((r, i) => <tr key={i} className={ROW}>{r.map((c, j) => <td key={j} className="py-2.5 pr-3 tabular-nums">{c ?? "—"}</td>)}</tr>)}</tbody>
        </table></div>
      ) : <p className={`mt-3 text-[13px] ${MUTE}`}>{s.empty ?? "Kuch nahi."}</p>}
    </div>
  );
}

export function Party360View({ d, credit, report }: { d: Party360Data; credit: CreditPosition | null; report?: CreditReport | null }) {
  const act = d.activity;
  const acc = ACCENT[d.type];
  const links = [...(act?.links ?? []), ...(d.links ?? [])];
  const glow: CSSProperties = { backgroundImage: `radial-gradient(900px 260px at 0% -30%, ${acc[0]}38, transparent), radial-gradient(700px 260px at 100% -40%, ${acc[1]}38, transparent)` };
  const tl = [...d.timeline, ...(act?.timeline ?? [])].filter((t, i, a) => a.findIndex((x) => x.date === t.date && x.label === t.label && x.amount === t.amount) === i).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);
  return (
    <div className={`-m-4 space-y-6 p-4 font-sans antialiased sm:-m-6 sm:p-8 ${PAGE}`} data-party360-theme>
      {/* Glassy header */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_20px_50px_-20px_rgba(16,24,40,.25)] dark:border-white/10 dark:bg-[#1e293b]">
        <div className="pointer-events-none absolute inset-0" style={glow} />
        <div className="relative flex flex-wrap items-center gap-5 p-7 backdrop-blur-xl">
          <div className="grid h-16 w-16 place-items-center rounded-2xl text-2xl font-semibold text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${acc[0]}, ${acc[1]})` }}>{(d.name || "?").slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[26px] font-semibold tracking-tight">{d.name}</h1>
              <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest" style={{ background: `${acc[0]}1f`, color: acc[0] }}>{LABEL[d.type]} 360</span>
            </div>
            <p className={`mt-0.5 text-[13px] ${MUTE}`}>{d.sub.join(" · ")}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {act?.roles.map((r) => <span key={r} className="rounded-full bg-slate-900/[0.04] px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-900/10 dark:bg-white/10 dark:text-slate-200 dark:ring-white/10">{ROLE_LABEL[r]}</span>)}
              {act?.roles.length ? <span className={`mx-1 ${MUTE}`}>·</span> : null}
              {d.badges.map((b) => <span key={b.label} className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: `${TONEHEX[b.tone]}22`, color: TONEHEX[b.tone] }}>{b.label}</span>)}
            </div>
          </div>
          <div className="flex max-w-xl flex-wrap justify-end gap-2">
            {d.actions.map((a) => {
              const Icon = /statement/i.test(a.label) ? FileText : /whatsapp/i.test(a.label) ? MessageCircle : /naya|nayi|new/i.test(a.label) ? Plus : /wasool|payment/i.test(a.label) ? Wallet : User;
              const inner = <><Icon className="h-4 w-4" />{a.label}</>;
              const cls = a.primary ? "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-medium text-white shadow-sm transition hover:brightness-110" : "inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[13px] font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-white/5 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-white/10";
              const st = a.primary ? { background: `linear-gradient(180deg, ${acc[0]}, ${acc[1]})` } : undefined;
              return a.href.startsWith("http") ? <a key={a.label} href={a.href} target="_blank" rel="noreferrer" className={cls} style={st}>{inner}</a> : <Link key={a.label} href={a.href} className={cls} style={st}>{inner}</Link>;
            })}
          </div>
        </div>
      </div>

      {d.empty && <div className={`${CARD} border-dashed p-8 text-center text-sm ${MUTE}`}>{d.empty}</div>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {d.kpis.map((k) => { const Icon = ICONS[kpiIcon(k.label)]; return (
          <div key={k.label} className={`${CARD} p-4`}>
            <div className={`flex items-center gap-2 text-[12px] ${MUTE}`}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${acc[0]}1f`, color: acc[0] }}><Icon className="h-4 w-4" /></span><span className="truncate">{k.label}</span></div>
            <div className={`mt-3 text-[22px] font-semibold tracking-tight tabular-nums ${k.value == null ? "text-slate-400" : TXT[k.tone ?? "neutral"]}`}>{fmt(k)}</div>
            {k.hint && <div className={`truncate text-[11px] ${MUTE}`}>{k.hint}</div>}
          </div>
        ); })}
      </div>

      {credit && <div className={`${CARD} p-6`}><h3 className={`${TITLE} mb-3`}>Udhaar halat</h3><CreditPositionStrip position={credit} /></div>}
      {report && <CreditReportCard r={report} lateAmount={credit?.lateAmount} />}

      <div className="grid gap-4 lg:grid-cols-3">
        {d.monthly && <div className={`${CARD} p-6 lg:col-span-2`}><div className={TITLE}>{d.monthly.title}</div><div className={`text-[12px] ${MUTE}`}>Pichle 6 mahine</div><Bars months={d.monthly.months} series={d.monthly.series} acc={acc} /></div>}
        <div className={`${CARD} p-6`}>
          <div className={TITLE}>Aging</div>
          {d.aging ? <Aging a={d.aging} note={d.agingNote} /> : <p className={`mt-2 text-[13px] ${MUTE}`}>Koi baqaya nahi.</p>}
          {act && <div className="mt-6 rounded-xl p-4" style={{ background: `${acc[0]}14` }}><div className={`text-[12px] ${MUTE}`}>Net position</div><div className="text-xl font-semibold tabular-nums" style={{ color: acc[0] }}>{act.net.net < 0 ? "− " : ""}{rs(Math.abs(act.net.net))}</div><div className={`text-[11px] ${MUTE}`}>{act.net.net > 0 ? "party ne dena" : act.net.net < 0 ? "hum ne dena" : "barabar"}</div></div>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">{d.sections.map((s) => <SectionCard key={s.title} s={s} />)}</div>

      {act && (
        <div className="space-y-4">
          <div><h2 className="text-lg font-semibold tracking-tight">Sab kaam humare saath</h2><p className={`text-[12px] ${MUTE}`}>Doodh, Vets, Karyana, Dukan, Procurement, khaad credit, bookings aur waade — sirf pakke (explicit) links se.</p></div>
          <div className="grid gap-4 md:grid-cols-3">
            {([["Unhon ne humein dena", act.net.theyOwe, "warn"], ["Hum ne unhein dena", act.net.weOwe, "bad"], ["Net", Math.abs(act.net.net), act.net.net > 0 ? "warn" : act.net.net < 0 ? "bad" : "good"]] as [string, number, Tone][]).map(([l, v, t]) => (
              <div key={l} className={`${CARD} p-5`}><div className={`text-[12px] ${MUTE}`}>{l}</div><div className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${TXT[t]}`}>{rs(v)}</div>{l === "Net" && <div className={`text-[11px] ${MUTE}`}>{act.net.net > 0 ? "party ne dena" : act.net.net < 0 ? "hum ne dena" : "barabar"}</div>}</div>
            ))}
          </div>
          <div className={`${CARD} p-6`}>
            <h3 className={TITLE}>Shoba-wise</h3>
            {act.shops.length ? <div className="mt-3 overflow-x-auto"><table className="w-full text-[13px]"><thead><tr>{["Shoba", "Unhon ne liya (maal/khidmat)", "Unhon ne diya (maal: doodh/fasal/bill)", "Paisa humein mila", "Paisa hum ne diya", "Baqi (+ wo dein / − hum dein)"].map((h) => <th key={h} className={`pb-2 pr-3 text-left text-[11px] font-medium uppercase tracking-wider ${MUTE}`}>{h}</th>)}</tr></thead>
              <tbody>{act.shops.map((l) => <tr key={l.key} className={ROW}><td className="py-2.5 pr-3"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: l.balance > 0 ? "#D97706" : l.balance < 0 ? "#DC2626" : acc[0] }} />{l.label}</span>{l.note && <span className={`ml-1 text-[10px] ${MUTE}`}>({l.note})</span>}</td><td className="tabular-nums">{rs(l.weSold)}</td><td className="tabular-nums">{rs(l.weBought)}</td><td className="tabular-nums">{rs(l.received)}</td><td className="tabular-nums">{rs(l.paid)}</td><td className={`font-semibold tabular-nums ${l.balance > 0 ? TXT.warn : l.balance < 0 ? TXT.bad : ""}`}>{l.balance ? (l.balance > 0 ? "+" : "−") + rs(Math.abs(l.balance)) : "—"}</td></tr>)}</tbody></table></div>
              : <p className={`mt-2 text-[13px] ${MUTE}`}>Kisi shoba mein koi kaam nahi.</p>}
          </div>
          <div className={`${CARD} p-6`}><div className={TITLE}>Mahana: sab shobay</div><div className={`text-[12px] ${MUTE}`}>Pichle 6 mahine · bar par hover karein</div>{act.monthly.series.length ? <Bars months={act.monthly.months} series={act.monthly.series} acc={acc} /> : <p className={`mt-3 text-[13px] ${MUTE}`}>Pichle 6 mahine mein koi activity nahi.</p>}</div>
          <div className="grid gap-4 lg:grid-cols-2">{act.sections.map((s) => <SectionCard key={s.title} s={s} />)}</div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${CARD} p-6 lg:col-span-2`}>
          <h3 className={`${TITLE} mb-4`}>Timeline</h3>
          {tl.length ? <ol className="ml-1 border-l border-slate-200 dark:border-white/10">{tl.map((t, i) => (
            <li key={i} className="relative pb-4 pl-6"><span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-[#24324a]" style={{ background: TONEHEX[t.tone ?? "neutral"] }} />
              <div className="text-sm font-medium">{t.label}</div>
              <div className={`text-[11px] ${MUTE}`}>{new Date(t.date.length === 10 ? `${t.date}T00:00:00+05:00` : t.date).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" })}{t.amount ? ` · ${rs(t.amount)}` : ""}</div></li>
          ))}</ol> : <p className={`text-[13px] ${MUTE}`}>Koi activity nahi.</p>}
        </div>
        <div className={`${CARD} p-6`}>
          <h3 className={`${TITLE} mb-3`}>Jude hue records</h3>
          {links.length ? <ul className="space-y-2 text-[13px]">{links.map((l) => <li key={l.href + l.label}><Link href={l.href} className="inline-flex items-center gap-1.5 hover:underline" style={{ color: acc[0] }}><Link2 className="h-3.5 w-3.5" />{l.label}</Link></li>)}</ul> : <p className={`text-[13px] ${MUTE}`}>Koi pakka link nahi.</p>}
        </div>
      </div>
      {d.notes.length > 0 && <p className={`text-[10px] ${MUTE}`}>Notes: {d.notes.join(" · ")}</p>}
      <p className={`text-[10px] ${MUTE}`}><Link href={`?type=${d.type}&id=${d.id}&view=classic`} className="underline">Purana (classic) view</Link></p>
    </div>
  );
}
