import Link from "next/link";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { adminFilter, adminKpis, daysBetween, invitePreview, rs } from "@/lib/portal/customer";
import { loadAdminCustomers, loadFinanceAccounts, loadQueue, proofUrl, todayPk } from "@/lib/portal/customer-load";
import { CKpi, Code, L3, Lock, Notice, PageHead, Panel, PanelHead, Pill, STATUS_TONE, Sub, btnGhost, btnPrimary, inputCls } from "@/components/portal/customer/cust-parts";
import { GlassStyles } from "@/components/glass/glass-styles";
import { queueAction } from "./actions";
import { InviteButton } from "./invite-button";

export const dynamic = "force-dynamic";
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const KIND: Record<string, TranslationKey> = { claim: "pc_ad_k_claim", change: "pc_ad_k_change", promise: "pc_ad_k_promise", dispute: "pc_ad_k_dispute" };

export default async function AdminCustomerPortal({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const lang = getLanguageFromCookies("rm");
  const L = (k: TranslationKey) => t(k, lang);
  const { rows: all, error } = await loadAdminCustomers();
  if (error) {
    return <div className="mx-auto max-w-xl px-4 py-16 text-center"><div className="text-5xl">🔒</div><p className="mt-3 font-semibold text-surface-800 dark:text-slate-100">{L("pc_ad_denied")}</p></div>;
  }
  const [{ items }, accounts] = await Promise.all([loadQueue(), loadFinanceAccounts()]);
  const proofs = Object.fromEntries(await Promise.all(items.filter((i) => i.proof_path).slice(0, 20).map(async (i) => [i.id, await proofUrl(i.proof_path)] as const)));
  const f = ["all", "on", "over", "shop"].includes(one(searchParams?.f) ?? "") ? one(searchParams?.f)! : "all";
  const q = (one(searchParams?.q) ?? "").slice(0, 60);
  const rows = adminFilter(all, f, q);
  const k = adminKpis(all);
  const asOf = todayPk();
  const ok = one(searchParams?.ok), e = one(searchParams?.e);
  const seen = (d: string | null) => {
    if (!d) return "—";
    const n = daysBetween(d.slice(0, 10), asOf);
    return n <= 0 ? L("pc_ad_today") : `${n} ${L("pc_ad_d")}`;
  };
  const byKind = (kind: string) => items.filter((i) => i.kind === kind).length;

  return (
    <div className="gl-bg mx-auto max-w-7xl space-y-3.5 px-4 py-6 sm:px-6">
      <GlassStyles />
      <PageHead title={<L3 k="pc_ad_title" lang={lang} />} sub={L("pc_ad_sub")} />
      {ok && <Notice tone="ok">✔ {L("pc_ad_done")}</Notice>}
      {e && <Notice tone="err">{e}</Notice>}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CKpi tone="blue" icon="👥" label={<L3 k="pc_ad_customers" lang={lang} />} value={String(k.total)} sub={`${k.farmer} ${L("pc_ad_farmer_linked")} · ${k.shop} ${L("pc_ad_shop_only")}`} />
        <CKpi tone="green" icon="🔓" label={<L3 k="pc_ad_portal_active" lang={lang} />} value={String(k.active)} sub={`${k.noLogin} ${L("pc_ad_no_login")}`} />
        <CKpi tone="amber" icon="📨" label={<L3 k="pc_ad_requests" lang={lang} />} value={String(items.length)} sub={`${byKind("claim")} · ${byKind("change")} · ${byKind("promise")} · ${byKind("dispute")}`} />
        <CKpi tone="rose" icon="⚠" label={<L3 k="pc_ad_overdue" lang={lang} />} value={String(k.over)} sub={rs(k.overAmt)} />
      </div>
      <div className="grid gap-3.5 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelHead title={<L3 k="pc_ad_all" lang={lang} />} right={
            <div className="flex flex-wrap items-center gap-1.5">
              {(["all", "on", "over", "shop"] as const).map((x) => (
                <Link key={x} href={`/admin/customer-portal?f=${x}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${f === x ? "bg-gradient-to-r from-emerald-700 to-[#16356e] text-white" : "gl-act text-surface-600 dark:text-slate-200"}`}>
                  {L(x === "all" ? "pc_f_all" : x === "on" ? "pc_ad_f_on" : x === "over" ? "pc_ad_f_over" : "pc_ad_f_shop")}
                </Link>
              ))}
              <form><input type="hidden" name="f" value={f} /><input name="q" defaultValue={q} placeholder="🔍" className={`${inputCls} w-28 rounded-full px-3 py-1 text-xs`} /></form>
            </div>} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[12.5px]">
              <thead><tr className="border-b border-surface-200 text-start text-[10.5px] uppercase tracking-wide text-surface-500 dark:border-[#1e3160] dark:text-slate-400">
                <th className="py-2">{L("pc_ad_c_code")}</th><th>{L("pc_ad_c_name")}</th><th>{L("pc_ad_c_branch")}</th><th className="text-end">{L("pc_ad_c_balance")}</th><th className="ps-3">{L("pc_ad_c_portal")}</th><th>{L("pc_ad_c_seen")}</th>
              </tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-surface-500">{L("pc_empty")}</td></tr>}
                {rows.slice(0, 200).map((r) => (
                  <tr key={r.id} className="border-b border-surface-100 text-surface-800 dark:border-[#1e3160] dark:text-slate-100">
                    <td className="py-2.5"><Code>{r.code}</Code></td>
                    <td><b className="text-surface-900 dark:text-white">{r.name}</b><Sub>{r.farmer_code ? `farmer ${r.farmer_code}` : L("pc_ad_shop_only")}{r.pending ? ` · 📨 ${r.pending}` : ""}</Sub></td>
                    <td>{r.branch ?? "—"}</td>
                    <td className={`text-end font-bold ${r.balance > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>{rs(r.balance).replace("Rs ", "")}</td>
                    <td className="ps-3">
                      {r.portal === "none" ? (
                        <InviteButton label={L("pc_ad_st_none")} title={`${L("pc_ad_invite_preview")} · ${r.name}`} confirmLabel={L("pc_ad_invite_confirm")} offNote={L("pc_ad_invite_off")}
                          noPhone={r.has_phone ? null : L("pc_ad_no_phone")} preview={invitePreview(L("pc_ad_sample_invite"), r.name, "https://alranatraders.pk/login")} />
                      ) : <Pill tone={STATUS_TONE[r.portal]}>{L(r.portal === "active" ? "pc_ad_st_active" : "pc_ad_st_suspended")}</Pill>}
                    </td>
                    <td>{seen(r.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-surface-500 dark:text-slate-400">{L("pc_ad_scope")}</p>
        </Panel>
        <Panel>
          <div id="queue" />
          <PanelHead title={<L3 k="pc_ad_queue" lang={lang} />} right={<Pill tone="amber">{L("pc_ad_mc")}</Pill>} />
          {items.length === 0 && <Sub>{L("pc_ad_queue_empty")}</Sub>}
          {items.map((i) => (
            <form key={i.id} action={queueAction} className="border-b border-dashed border-surface-200 py-3 last:border-0 dark:border-[#1e3160]">
              <input type="hidden" name="kind" value={i.kind} /><input type="hidden" name="id" value={i.id} />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <b className="text-[13px] text-surface-900 dark:text-white">{L(KIND[i.kind])}{i.amount !== null ? ` · ${rs(i.amount)}` : ""}</b>
                  <Sub><Code>{i.code}</Code> {i.customer} · {i.detail}</Sub>
                </div>
                <Pill tone={STATUS_TONE[i.status] ?? "amber"}>{L(`pc_st_${i.status}` as TranslationKey)}</Pill>
              </div>
              {proofs[i.id] && <a href={proofs[i.id]!} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11.5px] font-semibold text-blue-700 dark:text-blue-300">📎 {L("pc_ad_proof")}</a>}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <input name="note" placeholder={L("pc_ad_reason")} maxLength={300} className={`${inputCls} !w-40 !py-1.5 !text-[12px]`} />
                {i.kind === "claim" && i.can_approve && (
                  <select name="finance_account" required className={`${inputCls} !w-40 !py-1.5 !text-[12px]`} aria-label={L("pc_ad_fin_acc")}>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                )}
                {i.kind === "dispute" ? (
                  <>
                    <button name="op" value="review" disabled={!i.can_check} className={btnGhost}>{L("pc_ad_review")}</button>
                    <button name="op" value="close" disabled={!i.can_check} className={btnGhost}>{L("pc_ad_close")}</button>
                  </>
                ) : (
                  <>
                    {i.status === "submitted" && <button name="op" value="check" disabled={!i.can_check} className={btnGhost}>{L("pc_ad_check")}</button>}
                    {i.status === "checked" && <button name="op" value="approve" disabled={!i.can_approve} className={btnPrimary}>{L("pc_ad_approve")}</button>}
                    <button name="op" value="reject" className={btnGhost}>{L("pc_ad_reject")}</button>
                  </>
                )}
              </div>
            </form>
          ))}
          <div className="mt-2"><Lock>{L("pc_ad_queue_lock")}</Lock></div>
        </Panel>
      </div>
    </div>
  );
}
