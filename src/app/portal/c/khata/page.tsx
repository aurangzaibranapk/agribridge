import Link from "next/link";
import { redirect } from "next/navigation";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { qs, rangePresets, statementTotals } from "@/lib/portal/khata";
import { rs } from "@/lib/portal/customer";
import { custGate, customerContext, loadKhata, loadRequests, todayPk } from "@/lib/portal/customer-load";
import { shortDate } from "@/components/portal/khata/khata-parts";
import { StatementTable } from "@/components/portal/khata/statement-table";
import { CKpi, Field, L3, Notice, PageHead, Panel, PanelHead, Pill, Row, STATUS_TONE, Sub, btnGhost, btnPrimary, inputCls } from "@/components/portal/customer/cust-parts";
import { CustGate, NoCustomer } from "@/components/portal/customer/gate";
import { openDisputeAction } from "../actions";

export const dynamic = "force-dynamic";
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CustomerKhata({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const lang = getLanguageFromCookies("rm");
  const L = (k: TranslationKey) => t(k, lang);
  const ctx = await customerContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile && !ctx.isFarmer) return <NoCustomer lang={lang} />;
  const gate = await custGate(ctx);
  if (!gate.allowed) return <CustGate lang={lang} farmerReason={gate.farmerReason} />;
  const asOf = todayPk();
  const presets = rangePresets(asOf);
  const lastStart = new Date(Date.UTC(Number(asOf.slice(0, 4)), Number(asOf.slice(5, 7)) - 2, 1)).toISOString().slice(0, 10);
  const lastEnd = new Date(Date.UTC(Number(asOf.slice(0, 4)), Number(asOf.slice(5, 7)) - 1, 0)).toISOString().slice(0, 10);
  const P: Record<string, { from: string | null; to: string | null }> = {
    month: presets[0], last: { from: lastStart, to: lastEnd }, "3m": presets[1], all: presets[3],
  };
  const pk = one(searchParams?.p) ?? "month";
  const per = P[pk] ?? P.month;
  const [{ rows }, req] = await Promise.all([loadKhata(per.from, per.to), ctx.profile ? loadRequests() : Promise.resolve(null)]);
  const tot = statementTotals(rows);
  const body = rows.filter((r) => !r.is_opening);
  const nDr = body.filter((r) => r.udhaar > 0).length, nCr = body.filter((r) => r.adaigi > 0).length;
  const year = Number(asOf.slice(0, 4));
  const ok = one(searchParams?.ok), e = one(searchParams?.e);
  const exp = `/portal/c/khata/export${qs({ from: per.from, to: per.to })}`;

  return (
    <div className="pf-fit mx-auto w-full max-w-[1760px] px-4 py-6 sm:px-6 fit:gap-2.5 fit:py-3">
      <PageHead title={<L3 k="pc_khata_title" lang={lang} />} sub={L("pc_khata_sub")} />
      {ok && <Notice tone="ok">✔ {L("pc_ok_sent")}</Notice>}
      {e && <Notice tone="err">{t(e as TranslationKey, lang)}</Notice>}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 fit:grid-cols-4 fit:gap-2.5">
        <CKpi tone="slate" icon="📂" label={<L3 k="pc_opening" lang={lang} />} value={rs(tot.opening)} sub={per.from ? shortDate(per.from, lang, year) : "—"} />
        <CKpi tone="rose" icon="⬆" label={<L3 k="pc_debit" lang={lang} />} value={rs(tot.udhaar)} sub={`${nDr} ${L("pc_entries")}`} />
        <CKpi tone="green" icon="⬇" label={<L3 k="pc_credit" lang={lang} />} value={rs(tot.adaigi)} sub={`${nCr} ${L("pc_entries")}`} />
        <CKpi tone="violet" icon="🧮" label={<L3 k="pc_closing" lang={lang} />} value={rs(tot.closing)} sub={shortDate(per.to ?? asOf, lang, year)} />
      </div>
      <div className={`pf-grow pf-grid mt-3.5 grid gap-3.5 fit:mt-0 fit:gap-2.5 ${ctx.profile ? "fit:grid-cols-[2fr_1fr]" : ""}`}>
      <Panel className="pf-panel pf-navy fit:p-3.5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(["month", "last", "3m", "all"] as const).map((k) => (
              <Link key={k} href={`/portal/c/khata?p=${k}`} className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold ${pk === k ? "bg-gradient-to-r from-emerald-700 to-[#16356e] text-white" : "gl-act text-surface-600 dark:text-slate-200"}`}>
                {L(`pc_p_${k === "3m" ? "3m" : k}` as TranslationKey)}
              </Link>
            ))}
          </div>
          <div className="flex gap-2">
            <a href={exp} className={btnGhost}>⬇ {L("pc_csv")}</a>
            <Link href={`/portal/c/khata/print${qs({ from: per.from, to: per.to })}`} className={btnPrimary}>📄 {L("pc_btn_pdf")}</Link>
          </div>
        </div>
        {body.length === 0 ? <Sub>{L("pc_empty")}</Sub> : <div className="pf-body"><StatementTable rows={rows} totals={tot} lang={lang} year={year} /></div>}
        <p className="mt-3 text-[11px] text-surface-500 dark:text-slate-400 fit:mt-2">ℹ {L("pc_signs")}</p>
      </Panel>
      {ctx.profile && (
        <div id="dispute" className="pf-scroll mt-3.5 grid content-start gap-3.5 lg:grid-cols-2 fit:mt-0 fit:grid-cols-1 fit:gap-2.5">
          <Panel>
            <PanelHead title={<L3 k="pc_dispute" lang={lang} />} right={<Pill tone="blue">{L("pc_request_only")}</Pill>} />
            <form action={openDisputeAction}>
              <Field label={L("pc_dispute_ref")}><input name="ref" maxLength={60} className={inputCls} placeholder="POS-…" /></Field>
              <Field label={L("pc_dispute_msg")}><textarea name="message" required minLength={3} maxLength={500} rows={3} className={inputCls} /></Field>
              <button className={btnPrimary}>{L("pc_send")}</button>
              <p className="mt-2 text-[11px] text-surface-500 dark:text-slate-400">{L("pc_dispute_help")}</p>
            </form>
          </Panel>
          <Panel>
            <PanelHead title={<L3 k="pc_my_disputes" lang={lang} />} />
            {(req?.disputes ?? []).length === 0 && <Sub>{L("pc_empty")}</Sub>}
            {(req?.disputes ?? []).slice(0, 6).map((d) => (
              <Row key={d.id}>
                <div><span className="text-surface-900 dark:text-white">{d.ref ? `${d.ref} · ` : ""}{d.message}</span>{d.staff_note && <Sub>↳ {d.staff_note}</Sub>}</div>
                <Pill tone={STATUS_TONE[d.status] ?? "slate"}>{L(`pc_st_${d.status}` as TranslationKey)}</Pill>
              </Row>
            ))}
          </Panel>
        </div>
      )}
      </div>
    </div>
  );
}
