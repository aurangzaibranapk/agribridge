"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  tx, pendingText, pendingUrgent, windowState, hoursMinutes, draftAllowed, canLink, rs, FILTERS,
  type InboxLang, type InboxFilter, type ConversationRow, type MessageRow, type Party360, type TemplateRow, type DraftKind,
} from "@/lib/whatsapp/inbox/model";

export interface InboxActions {
  send: (fd: FormData) => Promise<{ ok: boolean; error?: string }>;
  assign: (fd: FormData) => Promise<{ ok: boolean; error?: string }>;
  draft: (fd: FormData) => Promise<{ ok: boolean; error?: string; info?: Record<string, unknown> }>;
  link: (fd: FormData) => Promise<{ ok: boolean; error?: string }>;
}
export interface InboxProps {
  lang: InboxLang;
  filter: InboxFilter;
  search: string;
  counts: Partial<Record<InboxFilter, number>>;
  conversations: ConversationRow[];
  selected: ConversationRow | null;
  messages: MessageRow[];
  party: Party360 | null;
  templates: TemplateRow[];
  staff: { id: string; name: string }[];
  isAdmin: boolean;
  now: number;
  basePath: string;
  preview?: boolean;
  actions?: InboxActions;
  /** sirf screenshot ke liye: mobile par 360 sheet khuli dikhana */
  initialSheet?: boolean;
}

const KIND_COLOR: Record<string, string> = {
  farmer: "bg-[#3f6b4a]", customer: "bg-[#1e3a8a]", staff: "bg-[#0e7490]", admin: "bg-[#0e7490]", owner: "bg-[#0e7490]",
  unknown: "bg-slate-500", ambiguous: "bg-amber-600",
};
const initials = (t: string) => (t.startsWith("+") ? "?" : t.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase());
const fmtTime = (s: string) => new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" });
const ago = (s: string | null, now: number) => {
  if (!s) return "";
  const m = Math.floor((now - Date.parse(s)) / 60000);
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
};

export function InboxShell(p: InboxProps) {
  const L = (k: Parameters<typeof tx>[1], v?: Record<string, string | number>) => tx(p.lang, k, v);
  const rtl = p.lang === "ur";
  const [sheet, setSheet] = useState(!!p.initialSheet);
  const [busy, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const lastDraft = useMemo(() => [...p.messages].reverse().find((m) => m.direction === "in" && m.ai_draft)?.ai_draft ?? "", [p.messages]);
  const [text, setText] = useState(lastDraft);
  const [tpl, setTpl] = useState<string>("");
  const [qa, setQa] = useState<DraftKind | "link" | "assign" | null>(null);
  const sel = p.selected;
  const win = windowState(sel?.last_inbound_at ?? null, p.now);
  const hm = hoursMinutes(win.msLeft);
  const tplRow = p.templates.find((t) => t.key === tpl) ?? null;
  const href = (o: Record<string, string | null>) => {
    const u = new URLSearchParams();
    const v = { f: p.filter, q: p.search || null, c: sel?.id ?? null, ...o };
    for (const [k, x] of Object.entries(v)) if (x) u.set(k, x);
    return `${p.basePath}?${u.toString()}`;
  };
  const run = (fn: ((fd: FormData) => Promise<{ ok: boolean; error?: string; info?: Record<string, unknown> }>) | undefined, fd: FormData, okMsg: string) => {
    if (p.preview || !fn) { setNote(L("sample")); return; }
    start(async () => {
      const r = await fn(fd);
      setNote(r.ok ? okMsg + (r.info?.number ? ` · ${r.info.number}` : "") : `✖ ${r.error}`);
      if (r.ok) setQa(null);
    });
  };

  const list = (
    <section className={`flex min-h-0 w-full flex-col border-slate-200 bg-white dark:border-[#1e2a44] dark:bg-[#111c33] md:w-[340px] md:shrink-0 ${rtl ? "md:border-l" : "md:border-r"} ${sel ? "hidden md:flex" : "flex"}`}>
      <div className="px-4 pb-2 pt-4">
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{L("title")}</h1>
        <form action={p.basePath} className="mt-2">
          <input type="hidden" name="f" value={p.filter} />
          <input name="q" defaultValue={p.search} placeholder={L("search")}
            className="w-full rounded-xl border-0 bg-[#f1f5f0] px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 dark:bg-[#152240] dark:text-slate-100" />
        </form>
      </div>
      <nav className="flex flex-wrap gap-1.5 px-4 pb-2" aria-label="filters">
        {FILTERS.map((f) => (
          <Link key={f} href={href({ f, c: null })}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] ${p.filter === f ? "border-[#3f6b4a] bg-[#3f6b4a] text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-[#06210f]" : "border-slate-200 text-slate-500 dark:border-[#1e2a44] dark:text-slate-400"}`}>
            {L(`f_${f}` as Parameters<typeof tx>[1])}{p.counts[f] != null && <b className="ms-1">{p.counts[f]}</b>}
          </Link>
        ))}
      </nav>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {p.conversations.length === 0 && <li className="p-6 text-center text-sm text-slate-400">{L("none")}</li>}
        {p.conversations.map((c) => {
          const pend = pendingText(p.lang, c.pending_since, p.now);
          return (
            <li key={c.id}>
              <Link href={href({ c: c.id })} data-testid="conv"
                className={`relative flex gap-3 border-t border-slate-100 px-4 py-2.5 dark:border-[#1e2a44] ${sel?.id === c.id ? "bg-[#eaf2e7] dark:bg-[#1a2a4a]" : "hover:bg-slate-50 dark:hover:bg-[#152240]"}`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white ${KIND_COLOR[c.party_kind]}`}>{initials(c.title)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex justify-between gap-2"><b className="truncate text-[13px] text-slate-900 dark:text-slate-100">{c.title}</b><small className="text-[10.5px] text-slate-400">{ago(c.last_inbound_at, p.now)}</small></span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{c.last_preview}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {c.is_naya && <i className="rounded-md bg-blue-100 px-1.5 text-[9.5px] font-bold not-italic text-blue-700">{L("naya")}</i>}
                    {pend && <i className={`rounded-md px-1.5 text-[9.5px] font-bold not-italic ${pendingUrgent(c.pending_since, p.now) ? "bg-red-600 text-white" : "bg-red-100 text-red-700"}`}>{pend}</i>}
                    {pend && c.stuck_with && <i className="rounded-md bg-slate-100 px-1.5 text-[9.5px] font-semibold not-italic text-slate-500 dark:bg-[#152240] dark:text-slate-400">{L("with")} {c.stuck_with}</i>}
                    {(c.party_kind === "unknown" || c.party_kind === "ambiguous") && <i className="rounded-md bg-amber-100 px-1.5 text-[9.5px] font-semibold not-italic text-amber-800">{L("f_unknown")}</i>}
                  </span>
                </span>
                {c.unread_count > 0 && <b className="absolute bottom-3 end-4 rounded-full bg-[#3f6b4a] px-1.5 text-[10px] text-white dark:bg-emerald-500 dark:text-[#06210f]">{c.unread_count}</b>}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );

  const party360 = sel && (
    <div className="flex flex-col gap-2.5 text-slate-800 dark:text-slate-100">
      <h3 className="text-sm font-bold">{L("p360")} · {sel.title}</h3>
      {!p.party || (sel.party_kind === "unknown" || sel.party_kind === "ambiguous") ? (
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-[#3a2a07] dark:text-amber-300">{L("unlinked")}</p>
      ) : (
        <>
          <div className="rounded-xl bg-[#f1f5f0] p-3 dark:bg-[#152240]">
            <div className="text-[10.5px] text-slate-500">{L("kh")}</div>
            <div className={`text-xl font-extrabold ${p.party.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>{rs(p.party.balance)}</div>
            {p.party.credit_limit != null && <div className="text-[10.5px] text-slate-500">{L("limit")} {rs(p.party.credit_limit)}</div>}
          </div>
          <div className="rounded-xl bg-[#f1f5f0] p-3 text-xs dark:bg-[#152240]">
            <div className="mb-1 text-[10.5px] text-slate-500">{L("bills")}</div>
            {[...p.party.orders, ...p.party.bills].slice(0, 5).map((b, i) => (
              <div key={i} className="flex justify-between border-b border-slate-200 py-1 last:border-0 dark:border-[#1e2a44]"><span>{b.ref} · {b.status}</span><span>{rs(b.amount)}</span></div>
            ))}
            {p.party.orders.length + p.party.bills.length === 0 && <div className="text-slate-400">{L("none")}</div>}
          </div>
          <div className="rounded-xl bg-[#f1f5f0] p-3 text-xs dark:bg-[#152240]">
            <div className="mb-1 text-[10.5px] text-slate-500">{L("season")}</div>
            {p.party.season.map((s, i) => <div key={i} className="flex justify-between py-0.5"><span>{s.campaign} · {s.crop}</span><span>{s.acres} acre · {s.status}</span></div>)}
            {p.party.season.length === 0 && <div className="text-slate-400">{L("none")}</div>}
          </div>
          <div className="rounded-xl bg-[#f1f5f0] p-3 text-xs dark:bg-[#152240]">
            <div className="mb-1 text-[10.5px] text-slate-500">{L("prom")}</div>
            {p.party.promises.map((s, i) => (
              <div key={i} className="flex justify-between py-0.5"><span>{rs(s.amount)} · {s.date}</span>
                <span className={s.status === "broken" ? "font-bold text-red-600" : s.status === "fulfilled" ? "font-bold text-emerald-600" : "text-slate-500"}>{s.status}</span></div>
            ))}
            {p.party.promises.length === 0 && <div className="text-slate-400">{L("none")}</div>}
          </div>
        </>
      )}
    </div>
  );

  const field = "w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-[#1e2a44] dark:bg-[#0c1528] dark:text-slate-100";
  const qaForm = sel && qa && (
    <form className="mx-3 mb-2 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-[#1e2a44] dark:bg-[#111c33] md:mx-4 md:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (qa === "link") run(p.actions?.link, fd, "✔ linked");
        else if (qa === "assign") run(p.actions?.assign, fd, "✔ assigned");
        else run(p.actions?.draft, fd, "✔ draft → Approvals");
      }}>
      <input type="hidden" name="conversation_id" value={sel.id} />
      {qa === "order" && <><input type="hidden" name="kind" value="order" /><input name="items" required placeholder="Urea 50kg × 10" className={`${field} col-span-2`} /><input name="amount" placeholder="Rs" className={field} /></>}
      {qa === "payment" && <><input type="hidden" name="kind" value="payment" /><input name="amount" required placeholder="Rs" className={field} /><input name="note" placeholder="Easypaisa / cash" className={`${field} col-span-2`} /></>}
      {qa === "demand" && <><input type="hidden" name="kind" value="demand" /><input name="product_name" required placeholder="Urea 50kg" className={field} /><input name="quantity" required placeholder="10" className={field} /><input name="unit" placeholder="bori" className={field} /></>}
      {qa === "link" && <><select name="party" className={field}><option value="farmer">Farmer</option><option value="customer">Customer</option></select><input name="party_id" required placeholder="FRM / customer id" className={`${field} col-span-2`} /></>}
      {qa === "assign" && <>
        <select name="to_profile_id" className={field}><option value="">—</option>{p.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <input name="department_key" placeholder="dept (recovery, agronomy…)" className={field} />
        <select name="mode" className={field}><option value="assign">{L("assign")}</option><option value="transfer">{L("transfer")}</option></select>
        <input name="reason" placeholder={L("reason")} className={field} />
      </>}
      <button disabled={busy} className="rounded-lg bg-[#3f6b4a] px-3 py-1.5 font-bold text-white dark:bg-emerald-500 dark:text-[#06210f]">✔</button>
      {qa !== "link" && qa !== "assign" && <p className="col-span-full text-[10.5px] text-slate-500">{L("to_app")}</p>}
    </form>
  );

  const chat = (
    <section className={`min-h-0 min-w-0 flex-1 flex-col bg-[#eef2ec] dark:bg-[#0c1528] ${sel ? "flex" : "hidden md:flex"}`}>
      {!sel ? <div className="m-auto text-sm text-slate-400">{L("pick")}</div> : <>
        <header className="flex items-center gap-2.5 border-b border-slate-200 bg-white px-3 py-2.5 dark:border-[#1e2a44] dark:bg-[#111c33] md:px-4">
          <Link href={href({ c: null })} className="text-lg text-slate-500 md:hidden" aria-label={L("back")}>{rtl ? "›" : "‹"}</Link>
          <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-extrabold text-white ${KIND_COLOR[sel.party_kind]}`}>{initials(sel.title)}</span>
          <div className="min-w-0 flex-1">
            <b className="text-sm text-slate-900 dark:text-slate-100">{sel.title}</b>
            <div className="truncate text-[11px] text-slate-500">{sel.phone_display ?? "+92 " + sel.phone_key} · {sel.party_kind} · {sel.assigned_name ?? sel.department_key ?? L("unassigned")}</div>
          </div>
          <button onClick={() => setQa(qa === "assign" ? null : "assign")} className="hidden rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold dark:border-[#1e2a44] dark:text-slate-200 md:block">👤 {L("assign")} / {L("transfer")}</button>
          <button onClick={() => setSheet(true)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold dark:border-[#1e2a44] dark:text-slate-200 lg:hidden">360</button>
        </header>
        <div className={`mx-3 mt-2 flex flex-wrap justify-between gap-1 rounded-lg px-3 py-1.5 text-[11.5px] md:mx-4 ${win.open ? "bg-emerald-50 text-emerald-800 dark:bg-[#0f2e22] dark:text-emerald-300" : "bg-amber-50 text-amber-800 dark:bg-[#3a2a07] dark:text-amber-300"}`} data-testid="window">
          <span>{win.open ? "🟢 " + L("win_open", { h: hm.h, m: hm.m }) : "⏳ " + L("win_closed")}</span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3 md:px-4">
          {p.messages.map((m) => (
            <div key={m.id} className={`max-w-[85%] rounded-xl px-3 pb-1 pt-2 text-[12.5px] leading-relaxed shadow-sm md:max-w-[68%] ${m.direction === "in" ? "self-start bg-white text-slate-800 dark:bg-[#16233f] dark:text-slate-100" : "self-end bg-[#dcefd9] text-slate-800 dark:bg-[#173a33] dark:text-slate-100"}`}>
              {m.msg_type === "image" && (m.media_url
                ? <img src={m.media_url} alt="" className="mb-1 max-h-48 rounded-lg" />
                : <div className="mb-1 h-32 w-56 rounded-lg bg-gradient-to-br from-[#5b8a3c] via-[#a3b84a] to-[#7a5c2e]" aria-label="image" />)}
              {m.msg_type === "audio" && (
                <div>
                  {m.media_url ? <audio controls src={m.media_url} className="h-8 w-60" /> :
                    <div className="flex min-w-[220px] items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#3f6b4a] text-[10px] text-white">▶</span><span className="h-4 flex-1 bg-[repeating-linear-gradient(90deg,#94a3b8_0_2px,transparent_2px_5px)]" /></div>}
                  {m.transcript && <div className="mt-1.5 border-s-[3px] border-[#3f6b4a] ps-2 text-xs dark:border-emerald-500"><b className="text-[#3f6b4a] dark:text-emerald-400">🎙 {L("heard")}:</b> “{m.transcript}”</div>}
                </div>
              )}
              {m.body && <div className="whitespace-pre-line">{m.body}</div>}
              <small className="block text-end text-[9.5px] text-slate-400">
                {fmtTime(m.created_at)}{m.direction === "out" && m.sent_by_name ? ` · ${L("sent_by")} ${m.sent_by_name}` : ""}{m.direction === "out" ? (m.send_status === "failed" ? " ✖" : " ✓✓") : ""}{m.ai_intent ? ` · AI: ${m.ai_intent}` : ""}
              </small>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2 text-[11px] md:px-4">
          <b className="text-slate-600 dark:text-slate-300">{L("qa")}:</b>
          {(["order", "payment", "demand"] as DraftKind[]).map((k) => draftAllowed(k, sel.party_kind, !!sel.farmer_id) && (
            <button key={k} onClick={() => setQa(qa === k ? null : k)} className={`rounded-lg border px-2 py-1 ${qa === k ? "border-[#3f6b4a] bg-[#eaf2e7] dark:bg-[#1a2a4a]" : "border-slate-200 bg-white dark:border-[#1e2a44] dark:bg-[#111c33] dark:text-slate-200"}`}>
              {k === "order" ? "🧾 " + L("q_order") : k === "payment" ? "💵 " + L("q_payment") : "🌾 " + L("q_demand")}
            </button>
          ))}
          {canLink(sel.party_kind, p.isAdmin) && <button onClick={() => setQa(qa === "link" ? null : "link")} className="rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-[#1e2a44] dark:bg-[#111c33] dark:text-slate-200">🔗 {L("q_link")}</button>}
          <button onClick={() => setQa(qa === "assign" ? null : "assign")} className="rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-[#1e2a44] dark:bg-[#111c33] dark:text-slate-200 md:hidden">👤 {L("assign")}</button>
          <span className="text-slate-400">{L("to_app")}</span>
        </div>
        {qaForm}
        <form className="mx-3 mb-3 rounded-xl border-[1.5px] border-dashed border-[#3f6b4a] bg-white p-2.5 dark:border-emerald-500 dark:bg-[#111c33] md:mx-4"
          onSubmit={(e) => { e.preventDefault(); run(p.actions?.send, new FormData(e.currentTarget), "✔ sent"); }}>
          <input type="hidden" name="intent" value="bhejo" />
          <input type="hidden" name="conversation_id" value={sel.id} />
          <input type="hidden" name="ai_draft" value={lastDraft} />
          <input type="hidden" name="last_inbound_at" value={sel.last_inbound_at ?? ""} />
          <div className="flex justify-between text-[11px] font-bold text-[#3f6b4a] dark:text-emerald-400"><span>✨ {L("draft")}</span>
            <select value={tpl} onChange={(e) => setTpl(e.target.value)} name="template_key" className="rounded border border-slate-200 bg-transparent px-1 text-[11px] font-normal dark:border-[#1e2a44]">
              <option value="">{win.open ? "—" : L("template") + " ▾"}</option>
              {p.templates.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          {tplRow ? (
            <div className="my-1.5 text-xs text-slate-700 dark:text-slate-200">
              <input type="hidden" name="template_param_count" value={tplRow.param_count} />
              <p className="mb-1 rounded bg-[#f1f5f0] p-2 dark:bg-[#152240]">{tplRow.body_preview}</p>
              {Array.from({ length: tplRow.param_count }).map((_, i) => <input key={i} name="param" required placeholder={`{{${i + 1}}}`} className={`${field} mb-1`} />)}
            </div>
          ) : (
            <textarea name="text" value={text} onChange={(e) => setText(e.target.value)} rows={3} disabled={!win.open}
              placeholder={win.open ? "" : p.templates.length ? L("win_closed") : L("no_tpl")}
              className="my-1.5 w-full resize-none rounded-lg bg-transparent text-[12.5px] leading-relaxed text-slate-800 outline-none disabled:opacity-50 dark:text-slate-100" />
          )}
          <div className="flex items-center justify-between">
            <small className="text-[10.5px] text-slate-500">🔒 {L("nosend")}{note ? ` · ${note}` : ""}</small>
            <button type="submit" disabled={busy || (!tplRow && (!win.open || !text.trim()))}
              className="rounded-lg bg-[#3f6b4a] px-4 py-1.5 text-sm font-extrabold text-white disabled:opacity-40 dark:bg-emerald-500 dark:text-[#06210f]">{L("send")} ➤</button>
          </div>
        </form>
      </>}
    </section>
  );

  return (
    <div dir={rtl ? "rtl" : "ltr"} className={`relative flex h-[calc(100dvh-4rem)] min-h-[560px] overflow-hidden rounded-xl border border-slate-200 bg-[#f4f6f3] dark:border-[#1e2a44] dark:bg-[#0b1220] ${rtl ? "font-[Noto_Nastaliq_Urdu,Noto_Sans_Arabic,sans-serif]" : ""}`} data-testid="wa-inbox">
      {list}
      {chat}
      {sel && <aside className={`hidden w-[290px] shrink-0 overflow-y-auto border-slate-200 bg-white p-4 dark:border-[#1e2a44] dark:bg-[#111c33] lg:block ${rtl ? "border-r" : "border-l"}`}>{party360}</aside>}
      {sel && sheet && (
        <div className="absolute inset-0 z-20 flex items-end bg-black/30 lg:hidden" onClick={() => setSheet(false)} data-testid="sheet">
          <div className="max-h-[75%] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl dark:bg-[#111c33]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300" />
            {party360}
          </div>
        </div>
      )}
      {p.preview && <span className="absolute bottom-1 start-2 z-30 rounded bg-amber-100 px-1.5 text-[9.5px] text-amber-800">{L("sample")}</span>}
    </div>
  );
}
