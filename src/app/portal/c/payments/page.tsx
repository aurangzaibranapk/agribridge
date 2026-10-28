import { redirect } from "next/navigation";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { METHODS, addDaysIso, promiseState, promisesKept, rs } from "@/lib/portal/customer";
import { custGate, customerContext, loadPayments, loadPromises, loadRequests, todayPk } from "@/lib/portal/customer-load";
import { shortDate } from "@/components/portal/khata/khata-parts";
import { CKpi, Field, L3, Lock, Notice, PageHead, Panel, PanelHead, Pill, STATUS_TONE, Sub, btnGhost, btnPrimary, inputCls } from "@/components/portal/customer/cust-parts";
import { CustGate, NoCustomer } from "@/components/portal/customer/gate";
import { requestPromiseAction, submitClaimAction } from "../actions";

export const dynamic = "force-dynamic";
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CustomerPayments({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const lang = getLanguageFromCookies("rm");
  const L = (k: TranslationKey) => t(k, lang);
  const ctx = await customerContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile && !ctx.isFarmer) return <NoCustomer lang={lang} />;
  const gate = await custGate(ctx);
  if (!gate.allowed) return <CustGate lang={lang} farmerReason={gate.farmerReason} />;
  const asOf = todayPk();
  const year = Number(asOf.slice(0, 4));
  const [payments, promises, req] = await Promise.all([loadPayments(`${year}-01-01`, asOf), loadPromises(), ctx.profile ? loadRequests() : Promise.resolve(null)]);
  const paidYear = payments.reduce((a, p) => a + p.amount, 0);
  const active = promises.filter((p) => p.status === "open").sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const kept = promisesKept(promises);
  const ok = one(searchParams?.ok), e = one(searchParams?.e);
  const canAsk = !!ctx.profile;
  // Tasdeeq shuda (khata) + apni zer-e-ghor / rad darkhwastein -- ek list
  const hist = [
    ...payments.map((p) => ({ key: `p${p.date}${p.ref}${p.amount}`, date: p.date, method: p.kind || "—", ref: p.ref ?? "—", amount: p.amount, status: "verified" })),
    ...(req?.claims ?? []).filter((c) => c.status !== "approved").map((c) => ({ key: c.id, date: c.paid_on, method: L(`pc_m_${c.method}` as TranslationKey), ref: c.reference ?? "—", amount: c.amount, status: c.status })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));
  const pend = (req?.promises ?? []).filter((p) => p.status === "submitted" || p.status === "checked" || p.status === "rejected");
  const stK = (s: string) => `pc_st_${s}` as TranslationKey;

  return (
    <div className="pf-fit mx-auto w-full max-w-[1760px] px-4 py-6 sm:px-6 fit:gap-2.5 fit:py-3">
      <PageHead title={<L3 k="pc_pay_title" lang={lang} />} sub={L("pc_pay_sub")} />
      {ok && <Notice tone="ok">✔ {L("pc_ok_sent")}</Notice>}
      {e && <Notice tone="err">{t(e as TranslationKey, lang)}</Notice>}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 fit:grid-cols-4 fit:gap-2.5">
        <CKpi tone="violet" icon="👛" label={<L3 k="pc_k_wallet" lang={lang} />} value="Rs 0" sub={L("pc_no_advance")} />
        <CKpi tone="green" icon="💵" label={<L3 k="pc_k_paid_year" lang={lang} />} value={rs(paidYear)} sub={`${payments.length} ${L("pc_payments_n")}`} />
        <CKpi tone="amber" icon="🤝" label={<L3 k="pc_k_active_promise" lang={lang} />} value={active ? rs(active.amount) : L("pc_none")} sub={active ? shortDate(active.date, lang, year) : "—"} />
        <CKpi tone="blue" icon="✅" label={<L3 k="pc_k_kept" lang={lang} />} value={kept.closed ? `${kept.kept} / ${kept.closed}` : "—"} sub={kept.closed ? `${Math.round((kept.kept / kept.closed) * 100)}%` : "—"} />
      </div>
      <div className="pf-grow pf-grid mt-3.5 grid gap-3.5 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_1.25fr] fit:mt-0 fit:gap-2.5">
        <Panel className="pf-panel pf-navy fit:p-3.5">
          <div id="proof" />
          <PanelHead title={<L3 k="pc_pay_proof" lang={lang} />} right={<Pill tone="blue">{L("pc_request_only")}</Pill>} />
          {canAsk ? (
            <form action={submitClaimAction} className="pf-body">
              <div className="grid gap-x-3 sm:grid-cols-2">
                <Field label={L("pc_f_amount")}><input name="amount" required inputMode="decimal" className={inputCls} placeholder="40000" /></Field>
                <Field label={L("pc_f_method")}>
                  <select name="method" className={inputCls} defaultValue="bank">{METHODS.map((m) => <option key={m} value={m}>{L(`pc_m_${m}` as TranslationKey)}</option>)}</select>
                </Field>
                <Field label={L("pc_f_ref")}><input name="reference" maxLength={80} className={inputCls} /></Field>
                <Field label={L("pc_f_paid_on")}><input type="date" name="paid_on" defaultValue={asOf} max={asOf} min={addDaysIso(asOf, -90)} className={inputCls} /></Field>
              </div>
              <Field label={L("pc_f_proof")}><input type="file" name="proof" accept="image/jpeg,image/png,image/webp,application/pdf" className={inputCls} /></Field>
              <Field label={L("pc_f_note")}><input name="note" maxLength={300} className={inputCls} /></Field>
              <button className={btnPrimary}>{L("pc_send_verify")}</button>
              <div className="mt-3"><Lock>{L("pc_claim_lock")}</Lock></div>
            </form>
          ) : <Sub>{L("pc_no_customer")}</Sub>}
        </Panel>
        <Panel className="pf-panel pf-navy fit:p-3.5">
          <div id="promise" />
          <PanelHead title={<L3 k="pc_my_promises" lang={lang} />} />
          <div className="pf-body">
          <table className="w-full text-[12.5px]">
            <thead><tr className="border-b border-surface-200 text-start text-[10.5px] uppercase tracking-wide text-surface-500 dark:border-[#1e3160] dark:text-slate-400">
              <th className="py-2">{L("pc_c_date")}</th><th className="text-end">{L("pc_c_amount")}</th><th className="text-end">{L("pc_c_paid")}</th><th className="ps-3">{L("pc_c_status")}</th>
            </tr></thead>
            <tbody>
              {pend.map((p) => (
                <tr key={p.id} className="border-b border-surface-100 text-surface-800 dark:border-[#1e3160] dark:text-slate-100">
                  <td className="py-2.5">{shortDate(p.promise_date, lang, year)}</td><td className="text-end">{rs(p.amount).replace("Rs ", "")}</td><td className="text-end">—</td>
                  <td className="ps-3"><Pill tone={STATUS_TONE[p.status] ?? "amber"}>{L(stK(p.status))}</Pill></td>
                </tr>
              ))}
              {promises.slice(0, 8).map((p) => {
                const st = promiseState(p);
                return (
                  <tr key={p.id} className="border-b border-surface-100 text-surface-800 dark:border-[#1e3160] dark:text-slate-100">
                    <td className="py-2.5">{shortDate(p.date, lang, year)}</td><td className="text-end">{rs(p.amount).replace("Rs ", "")}</td>
                    <td className={`text-end ${p.fulfilled > 0 ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}`}>{rs(p.fulfilled).replace("Rs ", "")}</td>
                    <td className="ps-3"><Pill tone={STATUS_TONE[st] ?? "amber"}>{L(stK(st))}</Pill></td>
                  </tr>
                );
              })}
              {promises.length + pend.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-surface-500">{L("pc_empty")}</td></tr>}
            </tbody>
          </table>
          {canAsk && (
            <form action={requestPromiseAction} className="gl-sec mt-4 p-3">
              <b className="mb-2 block text-[13px] text-surface-900 dark:text-white">+ {L("pc_new_promise")}</b>
              <div className="grid gap-x-3 sm:grid-cols-2">
                <Field label={L("pc_f_amount")}><input name="amount" required inputMode="decimal" className={inputCls} /></Field>
                <Field label={L("pc_promise_date")}><input type="date" name="promise_date" required min={asOf} max={addDaysIso(asOf, 30)} className={inputCls} /></Field>
              </div>
              <label className="mb-3 flex items-center gap-2 text-[12px] text-surface-700 dark:text-slate-200"><input type="checkbox" name="accept" required /> {L("pc_promise_terms")} (v3)</label>
              <button className={btnGhost}>{L("pc_send")}</button>
              <p className="mt-2 text-[11px] text-surface-500 dark:text-slate-400">📜 {L("pc_promise_note")}</p>
            </form>
          )}
          </div>
        </Panel>
      <Panel className="pf-panel pf-navy mt-3.5 lg:col-span-2 xl:col-span-1 xl:mt-0 fit:mt-0 fit:p-3.5">
        <div id="history" />
        <PanelHead title={<L3 k="pc_history" lang={lang} />} right={<Sub>{L("pc_history_sub")}</Sub>} />
        <div className="pf-body overflow-x-auto">
          <table className="w-full min-w-[520px] fit:min-w-0 text-[12.5px]">
            <thead><tr className="border-b border-surface-200 text-start text-[10.5px] uppercase tracking-wide text-surface-500 dark:border-[#1e3160] dark:text-slate-400">
              <th className="py-2">{L("pc_c_date")}</th><th>{L("pc_c_method")}</th><th>{L("pc_c_ref")}</th><th className="text-end">{L("pc_c_amount")}</th><th className="ps-3">{L("pc_c_status")}</th>
            </tr></thead>
            <tbody>
              {hist.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-surface-500">{L("pc_empty")}</td></tr>}
              {hist.slice(0, 40).map((h) => (
                <tr key={h.key} className="border-b border-surface-100 text-surface-800 dark:border-[#1e3160] dark:text-slate-100">
                  <td className="py-2.5">{shortDate(h.date, lang, year)}</td><td>{h.method}</td><td className="max-w-[9rem] truncate" title={h.ref}>{h.ref}</td>
                  <td className={`text-end ${h.status === "verified" ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}`}>{rs(h.amount).replace("Rs ", "")}</td>
                  <td className="ps-3"><Pill tone={STATUS_TONE[h.status] ?? "amber"}>{L(stK(h.status))}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      </div>
    </div>
  );
}
