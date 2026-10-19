import Link from "next/link";
import { redirect } from "next/navigation";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { creditUse, tafseelText } from "@/lib/portal/khata";
import { daysBetween, limitUsedPct, monthTotals, monthlySeries, orderOpen, rs } from "@/lib/portal/customer";
import { custGate, customerContext, loadAnimalCount, loadBills, loadKhata, loadOrders, loadPayments, loadPromises, todayPk } from "@/lib/portal/customer-load";
import { shortDate } from "@/components/portal/khata/khata-parts";
import { BuyPayChart, CHero, CKpi, Code, HBtn, L3, Panel, PanelHead, Pill, Row, STATUS_TONE, Sub } from "@/components/portal/customer/cust-parts";
import { CustGate, NoCustomer } from "@/components/portal/customer/gate";

export const dynamic = "force-dynamic";

export default async function CustomerDashboard() {
  const lang = getLanguageFromCookies("rm");
  const L = (k: TranslationKey) => t(k, lang);
  const ctx = await customerContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile && !ctx.isFarmer) return <NoCustomer lang={lang} />;
  const gate = await custGate(ctx);
  if (!gate.allowed) return <CustGate lang={lang} farmerReason={gate.farmerReason} />;
  const asOf = todayPk();
  const [{ summary: s, rows }, bills, payments, promises, orders, animals] = await Promise.all([
    loadKhata(null, null), loadBills(`${asOf.slice(0, 4)}-01-01`, asOf), loadPayments(null, null), loadPromises(), loadOrders(20),
    ctx.isFarmer ? loadAnimalCount() : Promise.resolve(0),
  ]);
  const c = ctx.profile?.customers[0];
  const owed = s?.owed ?? 0;
  const cu = s ? creditUse(s) : { limit: c?.credit_limit ?? 0, used: Math.max(0, owed), available: 0, pct: 0 };
  const mt = monthTotals(bills, payments, asOf);
  const series = monthlySeries(rows, asOf);
  const nextP = promises.filter((p) => p.status === "open" && p.date >= asOf).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const dueIn = c?.payment_due_days && s?.aging.oldest_days != null ? c.payment_due_days - s.aging.oldest_days : null;
  const pct = limitUsedPct(owed, cu.limit);
  const recent = rows.filter((r) => !r.is_opening).slice(-4).reverse();
  const open = orders.filter(orderOpen).slice(0, 3);
  const first = (c?.name ?? "").split(" ")[0];
  const year = Number(asOf.slice(0, 4));

  return (
    <div className="pf-fit mx-auto w-full max-w-[1760px] px-4 py-6 sm:px-6 fit:gap-2.5 fit:py-3">
      <div className="mb-4 fit:mb-0">
        <h1 className="text-2xl fit:text-xl font-extrabold tracking-tight text-surface-900 dark:text-white">{L("pc_hello")}{first ? `, ${first}` : ""} 👋</h1>
        <p className="mt-1 text-[13px] text-surface-500 dark:text-slate-400"><L3 k="pc_dash_sub" lang={lang} /></p>
      </div>
      <div className="fit:grid fit:grid-cols-[1.15fr_1.6fr] fit:gap-2.5">
      <CHero right={<>
        <HBtn href="/portal/c/khata/print" primary>📄 {L("pc_btn_pdf")}</HBtn>
        <HBtn href="/portal/c/payments#promise">🤝 {L("pc_btn_promise")}</HBtn>
        <HBtn href="/portal/c/payments#proof">💵 {L("pc_btn_pay")}</HBtn>
      </>}>
        <div className="text-[12px] text-white/85"><L3 k={owed >= 0 ? "pc_owe" : "pc_we_owe"} lang={lang} /></div>
        <div className="mt-1 text-[32px] font-extrabold fit:mt-0 fit:text-[28px]" data-testid="owed">{rs(Math.abs(owed))}</div>
        <div className="text-[12px] text-white/85">
          {L("pc_limit")} {rs(cu.limit)} · {L("pc_available")} {rs(cu.available)}
          {dueIn !== null && <> · {L("pc_due_in")} {Math.max(0, dueIn)} {L("pc_days")}</>}
        </div>
      </CHero>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 fit:grid-cols-2 fit:gap-2.5">
        <CKpi tone="blue" icon="🧾" label={<L3 k="pc_k_month_buy" lang={lang} />} value={rs(mt.buy)} sub={`${mt.bills} ${L("pc_bills_n")} · ${mt.products} ${L("pc_c_items").toLowerCase()}`} />
        <CKpi tone="green" icon="💵" label={<L3 k="pc_k_month_paid" lang={lang} />} value={rs(mt.paid)} sub={`${mt.payments} ${L("pc_payments_n")}${mt.lastPaid ? ` · ${L("pc_last")} ${shortDate(mt.lastPaid, lang)}` : ""}`} />
        <CKpi tone="amber" icon="🤝" label={<L3 k="pc_k_next_promise" lang={lang} />} value={nextP ? rs(nextP.amount) : L("pc_none")} sub={nextP ? `${shortDate(nextP.date, lang, year)} · ${daysBetween(asOf, nextP.date)} ${L("pc_days")}` : "—"} />
        <CKpi tone="pink" icon="⭐" label={<L3 k="pc_k_score" lang={lang} />} value={s?.score?.score != null ? `${s.score.score}${s.score.band ? ` · ${s.score.band}` : ""}` : "—"} sub={s?.score?.snapshot_date ? shortDate(s.score.snapshot_date, lang, year) : "—"} />
      </div>
      </div>
      <div className="pf-grow pf-grid mt-3.5 grid gap-3.5 lg:grid-cols-[1.4fr_1fr] fit:mt-0 fit:grid-cols-[1.4fr_1fr_1fr] fit:grid-rows-2 fit:gap-2.5">
        <Panel className="pf-panel pf-navy fit:row-span-2 fit:p-3.5">
          <PanelHead title={<L3 k="pc_chart" lang={lang} />} right={<Sub>{series[0]?.month} → {series[series.length - 1]?.month}</Sub>} />
          <div className="pf-body"><BuyPayChart data={series} height={200} /></div>
          <Sub>■ <span className="text-violet-600 dark:text-violet-300">{L("pc_purchases")}</span> &nbsp; — <span className="text-emerald-600 dark:text-emerald-300">{L("pc_payments")}</span></Sub>
        </Panel>
        <Panel className="pf-panel pf-navy fit:p-3.5">
          <PanelHead title={<L3 k="pc_recent" lang={lang} />} right={<Link href="/portal/c/khata" className="text-[11px] text-surface-500 dark:text-slate-400">{L("pc_view_all")} →</Link>} />
          <div className="pf-body">
          {recent.length === 0 && <Sub>{L("pc_empty")}</Sub>}
          {recent.map((r, i) => (
            <Row key={i}>
              <div>
                <span className="font-semibold text-surface-900 dark:text-white">{tafseelText(r.tafseel, (k) => t(k as TranslationKey, lang), lang)}</span> {r.ref && <Code>{r.ref}</Code>}
                <Sub>{shortDate(r.entry_date, lang, year)}</Sub>
              </div>
              {r.udhaar > 0 ? <b className="text-rose-600 dark:text-rose-400">+ {rs(r.udhaar)}</b> : <b className="text-emerald-600 dark:text-emerald-400">− {rs(r.adaigi)}</b>}
            </Row>
          ))}
          </div>
        </Panel>
      <div className="mt-3.5 grid gap-3.5 md:grid-cols-3 fit:contents">
        <Panel className="pf-panel pf-navy fit:p-3.5">
          <PanelHead title={<L3 k="pc_open_orders" lang={lang} />} />
          {open.length === 0 && <Sub>{L("pc_empty")}</Sub>}
          {open.map((o) => <Row key={o.id}><span className="text-surface-800 dark:text-slate-100">{o.number} · {o.items[0]?.name ?? o.type ?? ""}</span><Pill tone={STATUS_TONE[o.status] ?? "amber"}>{o.status || "—"}</Pill></Row>)}
        </Panel>
        <Panel className="pf-panel pf-navy fit:p-3.5">
          <PanelHead title={<L3 k="pc_due_soon" lang={lang} />} />
          <div className="h-2 overflow-hidden rounded-full bg-surface-200 dark:bg-[#1e3160]"><i className="block h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500" style={{ width: `${pct ?? 0}%` }} /></div>
          <p className="mt-2 text-[11px] text-surface-500 dark:text-slate-400">{pct === null ? "—" : `${pct}% ${L("pc_limit_used")} · ${rs(Math.max(0, owed))} / ${rs(cu.limit).replace("Rs ", "")}`}</p>
          {nextP && <p className="mt-2 text-[11px] text-surface-500 dark:text-slate-400">⏰ {L("pc_k_next_promise")} {shortDate(nextP.date, lang, year)}</p>}
        </Panel>
        {animals > 0 ? (
          <Link href="/portal/dairy" className="rounded-2xl border border-surface-200 bg-gradient-to-br from-cyan-50 to-violet-100 p-5 shadow-sm dark:border-[#1e3160] dark:from-cyan-950 dark:to-violet-950">
            <b className="text-[14px] text-slate-900 dark:text-white">🐄 <L3 k="pc_dairy" lang={lang} /></b>
            <p className="mt-2 text-[13px] text-slate-700 dark:text-slate-200">{animals} {L("pc_dairy_sub")}</p>
          </Link>
        ) : (
          <Panel className="pf-panel pf-navy fit:p-3.5">
            <PanelHead title={<L3 k="pc_k_returns" lang={lang} />} />
            <Link href="/portal/c/orders" className="text-[12px] font-semibold text-blue-700 dark:text-blue-300">{L("pc_view_all")} →</Link>
          </Panel>
        )}
      </div>
      </div>
      <p className="mt-5 fit:mt-0 text-center text-[11px] text-surface-500 dark:text-slate-400">🔒 <L3 k="pc_only_own" lang={lang} /></p>
    </div>
  );
}
