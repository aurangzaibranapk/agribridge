import Link from "next/link";
import type { Party360Data, Tone, Kpi, Section, AgingBuckets } from "@/lib/intelligence/party360/core";
import { ROLE_LABEL } from "@/lib/intelligence/party360/activity";
import type { CreditPosition } from "@/lib/recovery/credit-position";
import { CreditPositionStrip } from "@/components/recovery/credit-position-strip";

const TONE: Record<Tone, string> = {
  neutral: "bg-surface-100 text-surface-700", good: "bg-emerald-100 text-emerald-800", bad: "bg-red-100 text-red-700",
  warn: "bg-amber-100 text-amber-800", info: "bg-blue-100 text-blue-800",
};
const TXT: Record<Tone, string> = { neutral: "", good: "text-emerald-700", bad: "text-red-700", warn: "text-amber-700", info: "text-blue-700" };
const HEAD: Record<Party360Data["type"], string> = { farmer: "bg-gradient-to-br from-green-600 to-green-800", customer: "bg-gradient-to-br from-blue-600 to-blue-800", dealer: "bg-gradient-to-br from-purple-600 to-purple-800", supplier: "bg-gradient-to-br from-orange-500 to-orange-700", buyer: "bg-gradient-to-br from-amber-600 to-amber-800" };
const STRIPE: Record<Party360Data["type"], string> = { farmer: "bg-gradient-to-r from-green-500 via-green-700 to-emerald-600", customer: "bg-gradient-to-r from-blue-500 via-blue-700 to-indigo-600", dealer: "bg-gradient-to-r from-purple-500 via-purple-700 to-fuchsia-600", supplier: "bg-gradient-to-r from-orange-400 via-orange-600 to-red-500", buyer: "bg-gradient-to-r from-amber-500 via-amber-700 to-yellow-600" };
const short = (n: number) => n >= 1e7 ? `${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n));
const LABEL: Record<Party360Data["type"], string> = { farmer: "Kisan", customer: "Customer", dealer: "Dealer", supplier: "Supplier / Vendor", buyer: "Grain buyer" };
const rs = (n: number) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;
const fmt = (k: Kpi) => k.value == null ? "—" : typeof k.value === "string" ? k.value : k.fmt === "rs" ? rs(k.value) : k.fmt === "kg" ? `${Math.round(k.value).toLocaleString("en-PK")} kg` : Math.round(k.value).toLocaleString("en-PK");
const box = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-surface-700 dark:bg-surface-900";

function Bars({ months, series }: { months: string[]; series: { name: string; values: number[]; color: string }[] }) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  return (
    <div>
      <div className="flex h-40 items-end gap-2">
        {months.map((m, i) => (
          <div key={m + i} className="flex flex-1 flex-col items-center">
            <div className="flex h-32 w-full items-end justify-center gap-0.5">
              {series.map((s) => <div key={s.name} className="flex w-full flex-col items-center justify-end" style={{ maxWidth: series.length > 1 ? 22 : undefined }}><div className="mb-0.5 text-[9px] tabular-nums text-slate-500">{s.values[i] ? short(s.values[i]) : ""}</div><div title={`${s.name}: ${rs(s.values[i])}`} className={`w-full rounded-t ${s.color}`} style={{ height: `${Math.max(3, (s.values[i] / max) * 100)}px` }} /></div>)}
            </div>
            <div className="mt-1 text-[10px] text-surface-500">{m}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-surface-500">{series.map((s) => <span key={s.name}><span className={`mr-1 inline-block h-2 w-2 rounded ${s.color}`} />{s.name}</span>)}</div>
    </div>
  );
}

function Aging({ a, note }: { a: AgingBuckets; note?: string }) {
  const parts: [string, number, string][] = [["0-30", a.d0_30, "bg-emerald-500"], ["31-60", a.d31_60, "bg-yellow-400"], ["61-90", a.d61_90, "bg-orange-500"], ["90+", a.d90p, "bg-red-600"]];
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">{parts.map(([l, v, c]) => <div key={l} className={c} style={{ width: `${a.total ? (v / a.total) * 100 : 0}%` }} />)}</div>
      <div className="mt-2 grid grid-cols-4 text-[11px]">{parts.map(([l, v, c]) => <div key={l}><span className={`mr-1 inline-block h-2 w-2 rounded ${c}`} />{l} din<br /><b className="tabular-nums">{rs(v)}</b></div>)}</div>
      {note && <p className="mt-1 text-[10px] text-surface-400">{note}</p>}
    </div>
  );
}

function SectionCard({ s }: { s: Section }) {
  return (
    <div className={box}>
      <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-surface-200">{s.title}</h3>
      {s.note && <p className="mb-2 text-[11px] text-surface-500">{s.note}</p>}
      {s.rows.length ? (
        <div className="overflow-x-auto"><table className="w-full text-xs">
          {s.columns.some(Boolean) && <thead><tr className="border-b text-left text-surface-500">{s.columns.map((c, i) => <th key={i} className="py-1 pr-2 font-medium">{c}</th>)}</tr></thead>}
          <tbody className="divide-y divide-surface-100">{s.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="py-1.5 pr-2 tabular-nums">{c ?? "—"}</td>)}</tr>)}</tbody>
        </table></div>
      ) : <p className="text-xs text-surface-400">{s.empty ?? "Kuch nahi."}</p>}
    </div>
  );
}

export function Party360View({ d, credit }: { d: Party360Data; credit: CreditPosition | null }) {
  const act = d.activity;
  const links = [...(act?.links ?? []), ...(d.links ?? [])];
  return (
    <div className="-m-2 space-y-4 rounded-2xl bg-slate-100 p-4 font-sans dark:bg-surface-950">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-surface-700 dark:bg-surface-900">
        <div className={`h-2 ${STRIPE[d.type]}`} />
        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white shadow-md ring-4 ring-white ${HEAD[d.type]}`}>{(d.name || "?").slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-bold">{d.name}</h1><span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">{LABEL[d.type]} 360</span></div>
            <p className="text-xs text-surface-500">{d.sub.join(" · ")}</p>
            {act && act.roles.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-1"><span className="text-[10px] font-semibold uppercase text-surface-400">Roles:</span>
                {act.roles.map((r) => <span key={r} className="rounded-full border border-surface-300 px-2 py-0.5 text-[11px] font-semibold">{ROLE_LABEL[r]}</span>)}</div>
            )}
            <div className="mt-1 flex flex-wrap gap-1">{d.badges.map((b) => <span key={b.label} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONE[b.tone]}`}>{b.label}</span>)}</div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {d.actions.map((a) => {
              const cls = `rounded-lg px-3 py-1.5 text-xs font-semibold ${a.primary ? "bg-green-800 text-white shadow-sm hover:bg-green-900" : "border border-slate-300 bg-white shadow-sm hover:bg-slate-50 dark:bg-surface-800"}`;
              return a.href.startsWith("http") ? <a key={a.label} href={a.href} target="_blank" rel="noreferrer" className={cls}>{a.label}</a> : <Link key={a.label} href={a.href} className={cls}>{a.label}</Link>;
            })}
          </div>
        </div>
      </div>

      {d.empty && <div className="rounded-xl border border-dashed border-surface-300 p-6 text-center text-sm text-surface-500">{d.empty}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {d.kpis.map((k) => (
          <div key={k.label} className={box + " p-3"}>
            <p className="text-[11px] font-medium text-slate-500">{k.label}</p>
            <p className={`text-lg font-bold tabular-nums ${k.value == null ? "text-surface-400" : TXT[k.tone ?? "neutral"]}`}>{fmt(k)}</p>
            {k.hint && <p className="text-[10px] text-surface-400">{k.hint}</p>}
          </div>
        ))}
      </div>

      {credit && <div className={box}><h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-surface-200">Udhaar halat</h3><CreditPositionStrip position={credit} /></div>}

      <div className="grid gap-4 lg:grid-cols-3">
        {d.monthly && <div className={box + " lg:col-span-2"}><h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-surface-200">{d.monthly.title}</h3><Bars months={d.monthly.months} series={d.monthly.series} /></div>}
        <div className={box}><h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-surface-200">Baqaya kitna purana (aging)</h3>{d.aging ? <Aging a={d.aging} note={d.agingNote} /> : <p className="text-xs text-surface-400">Koi baqaya nahi.</p>}</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">{d.sections.map((s) => <SectionCard key={s.title} s={s} />)}</div>

      {act && (
        <div className="space-y-4 rounded-2xl border-2 border-dashed border-surface-300 p-4">
          <div><h2 className="text-base font-bold">Sab kaam humare saath</h2><p className="text-[11px] text-surface-500">Doodh, Vets, Karyana, Dukan, Procurement, khaad credit, bookings aur waade — sirf pakke (explicit) links se jude records.</p></div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className={box + " p-3"}><p className="text-[11px] text-surface-500">Unhon ne humein dena</p><p className="text-xl font-bold text-amber-700 tabular-nums">{rs(act.net.theyOwe)}</p></div>
            <div className={box + " p-3"}><p className="text-[11px] text-surface-500">Hum ne unhein dena</p><p className="text-xl font-bold text-red-700 tabular-nums">{rs(act.net.weOwe)}</p></div>
            <div className={box + " p-3"}><p className="text-[11px] text-surface-500">Net</p><p className={`text-xl font-bold tabular-nums ${act.net.net > 0 ? "text-amber-700" : act.net.net < 0 ? "text-red-700" : "text-emerald-700"}`}>{rs(Math.abs(act.net.net))}</p><p className="text-[10px] text-surface-400">{act.net.net > 0 ? "party ne dena" : act.net.net < 0 ? "hum ne dena" : "barabar"}</p></div>
          </div>
          <div className={box}>
            <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-surface-200">Dukan / shoba wise</h3>
            {act.shops.length ? <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b text-left text-surface-500"><th className="py-1">Shoba</th><th>Unhon ne liya (maal/khidmat)</th><th>Unhon ne diya (maal: doodh/fasal/bill)</th><th>Paisa humein mila</th><th>Paisa hum ne diya</th><th>Baqi (+ wo dein / − hum dein)</th></tr></thead>
              <tbody className="divide-y divide-surface-100">{act.shops.map((l) => <tr key={l.key}><td className="py-1.5">{l.label}{l.note && <span className="ml-1 text-[10px] text-surface-400">({l.note})</span>}</td><td className="tabular-nums">{rs(l.weSold)}</td><td className="tabular-nums">{rs(l.weBought)}</td><td className="tabular-nums">{rs(l.received)}</td><td className="tabular-nums">{rs(l.paid)}</td><td className={`tabular-nums font-semibold ${l.balance > 0 ? "text-amber-700" : l.balance < 0 ? "text-red-700" : ""}`}>{l.balance ? (l.balance > 0 ? "+" : "−") + rs(Math.abs(l.balance)) : "—"}</td></tr>)}</tbody></table></div>
              : <p className="text-xs text-surface-400">Kisi shoba mein koi kaam nahi.</p>}
          </div>
          <div className={box}><h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-surface-200">Mahana: sab shobay</h3>{act.monthly.series.length ? <Bars months={act.monthly.months} series={act.monthly.series} /> : <p className="text-xs text-slate-400">Pichle 6 mahine mein koi activity nahi.</p>}</div>
          <div className="grid gap-4 lg:grid-cols-2">{act.sections.map((s) => <SectionCard key={s.title} s={s} />)}</div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={box + " lg:col-span-2"}>
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-surface-200">Timeline</h3>
          {(() => { const tl = [...d.timeline, ...(act?.timeline ?? [])].filter((t, i, a) => a.findIndex((x) => x.date === t.date && x.label === t.label && x.amount === t.amount) === i).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);
            return tl.length ? <ol className="space-y-2 text-xs">{tl.map((t, i) => <li key={i} className="flex gap-2"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${TONE[t.tone ?? "neutral"]}`} /><div className="flex-1"><span className="font-medium">{t.label}</span>{t.amount ? <span className="ml-2 tabular-nums text-surface-600">{rs(t.amount)}</span> : null}<div className="text-surface-400">{new Date(t.date.length === 10 ? `${t.date}T00:00:00+05:00` : t.date).toLocaleString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "medium" })}</div></div></li>)}</ol> : <p className="text-xs text-surface-400">Koi activity nahi.</p>; })()}
        </div>
        <div className={box}>
          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-surface-200">Jude hue records</h3>
          {links.length ? <ul className="space-y-1 text-xs">{links.map((l) => <li key={l.href + l.label}><Link href={l.href} className="text-brand-700 underline">{l.label}</Link></li>)}</ul> : <p className="text-xs text-surface-400">Koi pakka link nahi.</p>}
        </div>
      </div>
      {d.notes.length > 0 && <p className="text-[10px] text-surface-400">Notes: {d.notes.join(" · ")}</p>}
      <p className="text-[10px] text-surface-400"><Link href={`?type=${d.type}&id=${d.id}&view=classic`} className="underline">Purana (classic) view</Link></p>
    </div>
  );
}
