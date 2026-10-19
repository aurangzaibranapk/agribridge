import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { broadcastConfig } from "@/lib/broadcast/config";
import { BHero, HeroLink, Kpi, Panel, Pill, TH, TD, INPUT, BTN, BTN_O, fmtPkt, fmtTime } from "../parts";
import { approveAction, rejectAction, cancelAction, reopenAction, retrySmsAction } from "../actions";

export const dynamic = "force-dynamic";
const APPROVERS = ["owner", "super_admin", "admin"];

export default async function BroadcastDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { e?: string; ok?: string; f?: string } }) {
  const supabase = createClient();
  const db = supabase as unknown as SupabaseClient;
  const lang = getLanguageFromCookies("rm");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const { data: b } = await db.from("broadcasts").select("*").eq("id", params.id).maybeSingle();
  if (!b) notFound();
  const [{ data: tpl }, { data: recips }, { data: audit }, { data: people }] = await Promise.all([
    b.template_id ? db.from("message_templates").select("name, lang, category, body, meta_status").eq("id", b.template_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("broadcast_recipients").select("id, name, phone, channel, status, error, sent_at, delivered_at, read_at, failed_at, fallback_of").eq("broadcast_id", b.id).order("created_at").limit(5000),
    db.from("broadcast_audit").select("action, actor, detail, at").eq("broadcast_id", b.id).order("at"),
    db.from("profiles").select("id, full_name").in("id", [b.created_by, b.approved_by, b.rejected_by].filter(Boolean)),
  ]);
  const name = (id: string | null) => (people ?? []).find((p: any) => p.id === id)?.full_name ?? (id ? id.slice(0, 8) : "—");
  const R = (recips ?? []) as any[];
  const c = (s: string) => R.filter((r) => r.status === s).length;
  const delivered = c("delivered") + c("read");
  const total = R.filter((r) => r.status !== "skipped_optout").length; // fallback SMS bhi alag paighaam hai
  const isApprover = !!me && APPROVERS.includes(me.role);
  const isCreator = b.created_by === user.id;
  const cfg = broadcastConfig();
  const filt = searchParams.f;
  const shown = filt ? R.filter((r) => r.status === filt) : R;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const failReasons = new Map<string, number>();
  for (const r of R) if (r.status === "failed" || r.status === "skipped_optout") failReasons.set(r.error ?? r.status, (failReasons.get(r.error ?? r.status) ?? 0) + 1);
  const smsText = b.sms_body?.[b.lang === "pref" ? "rm" : b.lang] || b.sms_body?.rm || b.sms_body?.en || b.sms_body?.ur || "";
  const live = ["sending", "done"].includes(b.status);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5 p-4" data-testid="broadcast-detail">
      <BHero title={`${b.title} · #${b.number}`} sub={<><Pill s={b.status} /> <span className="ms-2">{t("bc_created_by", lang)}: {name(b.created_by)} · {fmtPkt(b.created_at)}</span></>}>
        <HeroLink href="/admin/broadcast">← {t("bc_history", lang)}</HeroLink>
        {live ? <HeroLink href={`/admin/broadcast/${b.id}/csv`}>{t("bc_export", lang)}</HeroLink> : null}
      </BHero>
      {searchParams.e ? <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:bg-rose-500/10 dark:text-rose-200" data-testid="action-error">{searchParams.e}</div> : null}
      {!cfg.enabled && ["approved", "sending"].includes(b.status) ? <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">⏸ {t("bc_kill_off", lang)}</div> : null}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label={t("bc_recipients", lang)} value={b.recipient_count} />
        <Kpi label="Sent" value={c("sent") + delivered + c("failed")} />
        <Kpi label={t("bc_delivered", lang)} value={delivered} tone="text-emerald-700 dark:text-emerald-300" />
        <Kpi label={t("bc_read", lang)} value={c("read")} tone="text-sky-700 dark:text-sky-300" />
        <Kpi label={t("bc_failed", lang)} value={c("failed")} tone="text-rose-700 dark:text-rose-300" />
        <Kpi label={t("bc_optouts", lang)} value={c("skipped_optout")} />
      </div>
      <div className="grid min-h-0 flex-1 gap-2.5 xl:grid-cols-[1fr_1.6fr_0.9fr]">
        <div className="flex min-h-0 flex-col gap-2.5 overflow-auto">
          <Panel title={live ? t("bc_report", lang) : t("bc_approval", lang)}>
            <table className="w-full"><tbody>
              <tr><td className={`${TD} text-surface-500`}>{t("bc_audience", lang)}</td><td className={TD}>{b.audience_role} {Object.entries(b.audience_spec ?? {}).filter(([k, v]) => k !== "role" && v && (!Array.isArray(v) || v.length)).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(" · ")}</td></tr>
              <tr><td className={`${TD} text-surface-500`}>{t("bc_channel", lang)}</td><td className={TD}>{b.channel}{tpl ? <> · {tpl.name} ({tpl.category}) <Pill s={tpl.meta_status} /></> : null}</td></tr>
              <tr><td className={`${TD} text-surface-500`}>{t("bc_schedule", lang)}</td><td className={TD}>{b.schedule_at ? fmtPkt(b.schedule_at) : t("bc_now", lang)}</td></tr>
              <tr><td className={`${TD} text-surface-500`}>{t("bc_cost", lang)}</td><td className={TD}>{b.cost_estimate_usd != null ? `$${Number(b.cost_estimate_usd).toFixed(2)}` : "—"} {b.channel !== "whatsapp" ? "+ SMS (provider rates TBD)" : ""}</td></tr>
              <tr><td className={`${TD} text-surface-500`}>{t("bc_approved_by", lang)}</td><td className={TD}>{b.approved_by ? `${name(b.approved_by)} · ${fmtPkt(b.approved_at)}` : b.rejected_by ? `✕ ${name(b.rejected_by)}: ${b.reject_reason}` : "—"}</td></tr>
            </tbody></table>
            {b.status === "pending_approval" ? (
              <div className="mt-2 space-y-2" data-testid="approval-box">
                {isApprover && !isCreator ? (<>
                  <form action={approveAction}><input type="hidden" name="id" value={b.id} /><button className={`${BTN} w-full`} data-testid="approve-btn">✓ {t("bc_approve", lang)}</button></form>
                  <form action={rejectAction} className="flex gap-1.5"><input type="hidden" name="id" value={b.id} /><input name="reason" required placeholder={t("bc_reason", lang)} className={INPUT} /><button className="rounded-xl bg-rose-100 px-3 text-sm font-semibold text-rose-800 dark:bg-rose-500/15 dark:text-rose-200">✕ {t("bc_reject", lang)}</button></form>
                </>) : (<div className="rounded-lg border border-orange-200 bg-orange-50 p-2 text-xs text-orange-900 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-200" data-testid="self-note">{t("bc_self_note", lang)}</div>)}
                {isCreator ? <form action={reopenAction}><input type="hidden" name="id" value={b.id} /><button className={`${BTN_O} w-full`}>{t("bc_reopen", lang)}</button></form> : null}
              </div>) : null}
            {["draft", "pending_approval", "approved"].includes(b.status) && (isCreator || isApprover) ? <form action={cancelAction} className="mt-2"><input type="hidden" name="id" value={b.id} /><button className={`${BTN_O} w-full`}>{t("bc_cancel", lang)}</button></form> : null}
            {live ? (<div className="mt-3 space-y-1.5" data-testid="funnel">
              {[["Sent", pct(c("sent") + delivered + c("failed")), "bg-emerald-700"], [t("bc_delivered", lang), pct(delivered), "bg-emerald-500"], [t("bc_read", lang), pct(c("read")), "bg-sky-400"], [t("bc_failed", lang), pct(c("failed")), "bg-rose-500"]].map(([l, p, cl]) => (
                <div key={String(l)}><div className="text-[11.5px] text-surface-500 dark:text-slate-400">{l} · {p}%</div><div className="h-2 overflow-hidden rounded bg-surface-100 dark:bg-white/10"><div className={`h-full ${cl}`} style={{ width: `${p}%` }} /></div></div>))}
              {[...failReasons].length ? <table className="mt-2 w-full"><tbody>{[...failReasons].map(([k, v]) => <tr key={k}><td className={TD}>{k}</td><td className={TD}>{v}</td></tr>)}</tbody></table> : null}
              {isApprover && b.channel === "both" && c("failed") > 0 ? <form action={retrySmsAction}><input type="hidden" name="id" value={b.id} /><button className={`${BTN_O} mt-1 w-full`}>{t("bc_retry_sms", lang)}</button></form> : null}
            </div>) : null}
          </Panel>
        </div>
        <Panel title={t("bc_recipients", lang)} right={<div className="flex gap-1 text-[11px]">{["", "failed", "read", "delivered", "skipped_optout"].map((f) => <Link key={f} href={`/admin/broadcast/${b.id}${f ? `?f=${f}` : ""}`} className={`rounded-full px-2 py-0.5 ${filt === f || (!filt && !f) ? "bg-emerald-700 text-white" : "bg-surface-100 text-surface-600 dark:bg-white/10 dark:text-slate-300"}`}>{f || "all"}</Link>)}</div>}>
          <table className="w-full" data-testid="recipients"><thead><tr><th className={TH}>Name</th><th className={TH}>Phone</th><th className={TH}>{t("bc_channel", lang)}</th><th className={TH}>{t("bc_status", lang)}</th><th className={TH}>PKT</th></tr></thead>
            <tbody>{shown.slice(0, 500).map((r) => (<tr key={r.id}><td className={`${TD} whitespace-nowrap`}>{r.name}</td><td className={`${TD} whitespace-nowrap`}>{String(r.phone).replace(/^(\d{4})\d+(\d{3})$/, "$1*****$2")}</td><td className={TD}>{r.channel}{r.fallback_of ? " (fallback)" : ""}</td><td className={TD}><Pill s={r.status} /></td><td className={`${TD} whitespace-nowrap`}>{fmtTime(r.read_at ?? r.delivered_at ?? r.sent_at ?? r.failed_at)}</td></tr>))}</tbody></table>
        </Panel>
        <div className="flex min-h-0 flex-col gap-2.5 overflow-auto">
          <Panel title={t("bc_message", lang)}>
            <div className="space-y-2 rounded-xl bg-[#e7ddd0] p-3 dark:bg-[#0d1b2a]">
              {tpl ? <div className="whitespace-pre-line rounded-lg bg-[#dcf8c6] px-3 py-2 text-[13px] text-surface-900 dark:bg-[#005c4b] dark:text-emerald-50"><b>WhatsApp</b>{"\n"}{tpl.body}{"\n"}<span className="text-[11px] opacity-70">{(b.template_vars ?? []).map((v: string, i: number) => `{{${i + 1}}}=${v}`).join(" ")}</span></div> : null}
              {smsText ? <div className="whitespace-pre-line rounded-lg bg-white px-3 py-2 text-[13px] text-surface-900 dark:bg-[#111a2e] dark:text-slate-100"><b>SMS</b>{"\n"}{smsText}</div> : null}
            </div>
          </Panel>
          <Panel title={t("bc_audit", lang)}>
            <ul className="text-xs" data-testid="audit">{(audit ?? []).map((a: any, i: number) => <li key={i} className="border-b border-dashed border-surface-200 py-1.5 dark:border-white/10 dark:text-slate-300">{fmtPkt(a.at)} · <b>{a.action}</b> · {a.actor ? name(a.actor) : "system"} {a.detail && Object.keys(a.detail).length ? <span className="text-surface-400">{JSON.stringify(a.detail)}</span> : null}</li>)}</ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
