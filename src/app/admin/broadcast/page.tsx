import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { broadcastConfig } from "@/lib/broadcast/config";
import { BHero, HeroLink, Kpi, Panel, Pill, TH, TD, INPUT, BTN, fmtPkt } from "./parts";
import { addTemplateAction, addDndAction } from "./actions";

export const dynamic = "force-dynamic";
const CREATORS = ["owner", "super_admin", "admin", "manager"];
const APPROVERS = ["owner", "super_admin", "admin"];

export default async function BroadcastListPage({ searchParams }: { searchParams: { e?: string; ok?: string } }) {
  const supabase = createClient();
  const db = supabase as unknown as SupabaseClient;
  const lang = getLanguageFromCookies("rm");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!me || !CREATORS.includes(me.role)) return <div className="p-8 text-center text-surface-600 dark:text-slate-300">{t("bc_no_access", lang)}</div>;
  const approver = APPROVERS.includes(me.role);
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const [{ data: rows }, { data: tpls }, { count: optouts }, { count: dnd }, { data: recent }] = await Promise.all([
    db.from("broadcasts").select("id, number, title, audience_role, channel, status, recipient_count, created_at, schedule_at, created_by").order("created_at", { ascending: false }).limit(200),
    db.from("message_templates").select("id, name, lang, category, meta_status").order("name"),
    db.from("messaging_optouts").select("phone", { count: "exact", head: true }),
    db.from("messaging_dnd").select("phone", { count: "exact", head: true }),
    db.from("broadcast_recipients").select("broadcast_id, status").gte("created_at", since).limit(50000),
  ]);
  const st = (s: string) => (recent ?? []).filter((r: any) => r.status === s).length;
  const delivered = st("delivered") + st("read");
  const perB = new Map<string, { d: number; n: number }>();
  for (const r of (recent ?? []) as any[]) { const x = perB.get(r.broadcast_id) ?? { d: 0, n: 0 }; x.n++; if (["delivered", "read"].includes(r.status)) x.d++; perB.set(r.broadcast_id, x); }
  const cfg = broadcastConfig();
  const role = (r: string) => t((({ farmers: "bc_farmers", customers: "bc_customers", staff: "bc_staff", all: "bc_all", custom: "bc_custom" } as const)[r as "farmers"] ?? "bc_all"), lang);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5 p-4" data-testid="broadcast-list">
      <BHero title={t("bc_title", lang)} sub={`${t("bc_sub", lang)} · ${cfg.ratePerSec}/s · ${cfg.quietStartHour}:00–${cfg.quietEndHour}:00 PKT`}>
        <HeroLink href="/admin/broadcast/new">＋ {t("bc_new", lang)}</HeroLink>
      </BHero>
      <div className={`rounded-xl px-3 py-2 text-xs font-medium ${cfg.enabled ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"}`} data-testid="kill-switch">
        {cfg.enabled ? `● ${t("bc_kill_on", lang)}` : `⏸ ${t("bc_kill_off", lang)}`} · {t("bc_sandbox", lang)}
      </div>
      {searchParams.e ? <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">{searchParams.e}</div> : null}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label={t("bc_sent30", lang)} value={st("sent") + delivered + st("failed")} />
        <Kpi label={t("bc_delivered", lang)} value={delivered} tone="text-emerald-700 dark:text-emerald-300" />
        <Kpi label={t("bc_read", lang)} value={st("read")} tone="text-sky-700 dark:text-sky-300" />
        <Kpi label={t("bc_failed", lang)} value={st("failed")} tone="text-rose-700 dark:text-rose-300" />
        <Kpi label={t("bc_pending", lang)} value={(rows ?? []).filter((r: any) => r.status === "pending_approval").length} tone="text-amber-700 dark:text-amber-300" />
        <Kpi label={t("bc_optouts", lang)} value={`${optouts ?? 0} · DND ${dnd ?? 0}`} />
      </div>
      <div className="grid min-h-0 flex-1 gap-2.5 xl:grid-cols-[2.2fr_1fr]">
        <Panel title={t("bc_history", lang)}>
          {(rows ?? []).length === 0 ? <p className="py-10 text-center text-sm text-surface-400">{t("bc_none", lang)}</p> : (
            <table className="w-full"><thead><tr><th className={TH}>#</th><th className={TH}>{t("bc_title_f", lang)}</th><th className={TH}>{t("bc_audience", lang)}</th><th className={TH}>{t("bc_channel", lang)}</th><th className={TH}>{t("bc_recipients", lang)}</th><th className={TH}>{t("bc_status", lang)}</th><th className={TH}>{t("bc_delivered", lang)}</th><th className={TH}>{t("bc_schedule", lang)}</th></tr></thead>
              <tbody>{(rows ?? []).map((r: any) => { const p = perB.get(r.id); return (
                <tr key={r.id} className="hover:bg-surface-50 dark:hover:bg-white/5"><td className={TD}>{r.number}</td><td className={TD}><Link className="font-semibold text-emerald-800 hover:underline dark:text-emerald-300" href={`/admin/broadcast/${r.id}`}>{r.title}</Link></td>
                  <td className={TD}>{role(r.audience_role)}</td><td className={TD}>{r.channel === "both" ? "WA+SMS" : r.channel === "whatsapp" ? "WhatsApp" : "SMS"}</td><td className={TD}>{r.recipient_count}</td>
                  <td className={TD}><Pill s={r.status} /></td><td className={TD}>{p && p.n && ["sending", "done"].includes(r.status) ? `${Math.round((p.d / p.n) * 100)}%` : "—"}</td><td className={TD}>{fmtPkt(r.schedule_at ?? r.created_at)}</td></tr>); })}</tbody></table>)}
        </Panel>
        <div className="flex min-h-0 flex-col gap-2.5 overflow-auto">
          <Panel title={t("bc_templates", lang)}>
            <table className="w-full"><tbody>{(tpls ?? []).map((x: any) => (<tr key={x.id}><td className={TD}>{x.name} <span className="text-surface-400">· {x.lang}</span></td><td className={TD}>{x.category}</td><td className={TD}><Pill s={x.meta_status} /></td></tr>))}</tbody></table>
            {approver ? (
              <form action={addTemplateAction} className="mt-2 grid grid-cols-2 gap-1.5" data-testid="template-form">
                <input name="name" placeholder="general_notice" className={INPUT} required /><input name="lang" defaultValue="ur" className={INPUT} />
                <select name="category" className={INPUT}><option>UTILITY</option><option>MARKETING</option></select>
                <select name="meta_status" className={INPUT}><option>PENDING</option><option>APPROVED</option><option>REJECTED</option><option>PAUSED</option></select>
                <textarea name="body" placeholder="Assalam o alaikum {{1}} ..." className={`${INPUT} col-span-2`} rows={2} required />
                <button className={`${BTN} col-span-2`}>{t("bc_add_tpl", lang)}</button>
              </form>) : null}
          </Panel>
          <Panel title={t("bc_dnd", lang)}>
            <p className="text-xs text-surface-500 dark:text-slate-400">STOP / “band karo” → {optouts ?? 0} · DND {dnd ?? 0}</p>
            {approver ? (<form action={addDndAction} className="mt-2 flex gap-1.5"><input name="phone" placeholder="0300-1234567" className={INPUT} required /><input name="reason" placeholder={t("bc_reason", lang)} className={INPUT} /><button className={BTN}>{t("bc_add_dnd", lang)}</button></form>) : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}
