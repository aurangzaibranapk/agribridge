import Link from "next/link";
import { redirect } from "next/navigation";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { CHANGE_FIELDS, profileComplete, rs } from "@/lib/portal/customer";
import { customerContext, loadAnimalCount, loadRequests } from "@/lib/portal/customer-load";
import { longDate } from "@/components/portal/khata/khata-parts";
import { Field, L3, Lock, Notice, PageHead, Panel, PanelHead, Pill, Row, btnGhost, btnPrimary, inputCls } from "@/components/portal/customer/cust-parts";
import { NoCustomer } from "@/components/portal/customer/gate";
import { requestChangeAction } from "../actions";

export const dynamic = "force-dynamic";
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function Box({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="mb-3">
      <span className="mb-1 block text-[11px] font-semibold text-surface-500 dark:text-slate-400">{label}</span>
      <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-[13px] font-semibold text-surface-900 dark:border-[#1e3160] dark:bg-[#0d1a3a] dark:text-white">{value || "—"}</div>
    </div>
  );
}

/** Profile hamesha khulti hai (darwaza band ho to bhi) -- taake gahak tabdeeli maang sake. */
export default async function CustomerProfilePage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const lang = getLanguageFromCookies("rm");
  const L = (k: TranslationKey) => t(k, lang);
  const ctx = await customerContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile) {
    if (ctx.isFarmer) redirect("/portal/profile");
    return <NoCustomer lang={lang} />;
  }
  const c = ctx.profile.customers[0];
  const [req, animals] = await Promise.all([loadRequests(), ctx.isFarmer ? loadAnimalCount() : Promise.resolve(0)]);
  const pending = req.changes.filter((x) => x.status === "submitted" || x.status === "checked");
  const ok = one(searchParams?.ok), e = one(searchParams?.e);
  const complete = profileComplete(c);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHead title={<L3 k="pc_profile_title" lang={lang} />} sub={L("pc_profile_sub")} />
      {ok && <Notice tone="ok">✔ {L("pc_ok_sent")}</Notice>}
      {e && <Notice tone="err">{t(e as TranslationKey, lang)}</Notice>}
      <div className="grid gap-3.5 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelHead title={<L3 k="pc_personal" lang={lang} />} right={<Pill tone={complete ? "green" : "amber"}>{complete ? L("pc_verified") : L("pc_incomplete")}</Pill>} />
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Box label={L("pc_f_name")} value={c.name} /><Box label={L("pc_f_business")} value={c.business_name} />
            <Box label={L("pc_f_code")} value={c.code} /><Box label={L("pc_f_type")} value={c.customer_type} />
            <Box label={L("pc_f_phone")} value={c.phone} /><Box label={L("pc_f_cnic")} value={c.cnic} />
            <Box label={L("pc_f_branch")} value={c.branch} /><Box label={L("pc_f_address")} value={c.address} />
            <Box label={L("pc_f_email")} value={c.email} /><Box label={L("pc_f_contact")} value={c.contact_person} />
          </div>
          <form action={requestChangeAction} className="mt-2 rounded-xl border border-surface-200 p-3 dark:border-[#1e3160]">
            <b className="mb-2 block text-[13px] text-surface-900 dark:text-white">✏ {L("pc_req_change")}</b>
            <div className="grid gap-x-3 sm:grid-cols-2">
              <Field label={L("pc_change_field")}>
                <select name="field" className={inputCls}>{CHANGE_FIELDS.map((f) => <option key={f} value={f}>{L(`pc_fld_${f}` as TranslationKey)}</option>)}</select>
              </Field>
              <Field label={L("pc_change_new")}><input name="value" required maxLength={300} className={inputCls} /></Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={btnPrimary}>{L("pc_send")}</button>
              <Link href="/forgot-password" className={btnGhost}>🔑 {L("pc_change_password")}</Link>
            </div>
          </form>
          <div className="mt-3"><Lock>{L("pc_profile_lock")}</Lock></div>
        </Panel>
        <div className="space-y-3.5">
          <Panel>
            <PanelHead title={<L3 k="pc_terms" lang={lang} />} />
            <Row><span>{L("pc_limit")}</span><b>{rs(c.credit_limit)}</b></Row>
            <Row><span>{L("pc_pay_days")}</span><b>{c.payment_due_days ?? "—"}</b></Row>
            <Row><span>{L("pc_block_after")}</span><b>{c.overdue_block_days ? L("pc_after_days").replace("{n}", String(c.overdue_block_days)) : "—"}</b></Row>
            <Row><span>{L("pc_terms_accepted")}</span><b>{c.terms_version ? `${c.terms_version}${c.terms_at ? ` · ${longDate(c.terms_at.slice(0, 10), lang)}` : ""}` : "—"}</b></Row>
          </Panel>
          <Panel>
            <PanelHead title={<L3 k="pc_linked" lang={lang} />} />
            <Row><span>👨‍🌾 {L("pc_farmer_profile")} {c.farmer_code ?? ""}</span><Pill tone={c.farmer_code ? "violet" : "slate"}>{c.farmer_code ? L("pc_linked_b") : "—"}</Pill></Row>
            {animals > 0 && <Row><span>🐄 {L("pc_dairy")} ({animals})</span><Pill tone="green">{L("pc_ad_st_active")}</Pill></Row>}
            {pending.map((p) => <Row key={p.id}><span>📨 {L("pc_pending_change")}</span><Pill tone="amber">{L(`pc_fld_${p.field}` as TranslationKey)} · {L(`pc_st_${p.status}` as TranslationKey)}</Pill></Row>)}
            {pending.length === 0 && <Row><span>📨 {L("pc_pending_change")}</span><span>—</span></Row>}
          </Panel>
          <Panel>
            <PanelHead title={<L3 k="pc_prefs" lang={lang} />} />
            <Row><span>{L("pc_language")}</span><b>EN · Roman · <span dir="rtl">اردو</span></b></Row>
            <Row><span>{L("pc_theme")}</span><b>{L("pc_theme_v")}</b></Row>
            <Row><span>{L("pc_wa_updates")}</span><b>{L("pc_wa_optin")}</b></Row>
          </Panel>
        </div>
      </div>
    </div>
  );
}
