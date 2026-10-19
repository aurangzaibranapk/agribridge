import Link from "next/link";
import { redirect } from "next/navigation";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { orderOpen, rs, stepIndex } from "@/lib/portal/customer";
import { custGate, customerContext, loadBills, loadOrders, loadReturns, todayPk } from "@/lib/portal/customer-load";
import { shortDate } from "@/components/portal/khata/khata-parts";
import { CKpi, Code, L3, Lock, PageHead, Panel, PanelHead, Pill, Row, STATUS_TONE, Steps, Sub } from "@/components/portal/customer/cust-parts";
import { CustGate, NoCustomer } from "@/components/portal/customer/gate";

export const dynamic = "force-dynamic";
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CustomerOrders({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const lang = getLanguageFromCookies("rm");
  const L = (k: TranslationKey) => t(k, lang);
  const ctx = await customerContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile && !ctx.isFarmer) return <NoCustomer lang={lang} />;
  const gate = await custGate(ctx);
  if (!gate.allowed) return <CustGate lang={lang} farmerReason={gate.farmerReason} />;
  const asOf = todayPk();
  const year = Number(asOf.slice(0, 4));
  const [bills, orders, returns] = await Promise.all([loadBills(null, null, 200), loadOrders(50), loadReturns()]);
  const f = ["all", "bills", "orders"].includes(one(searchParams?.f) ?? "") ? one(searchParams?.f)! : "all";
  const yb = bills.filter((b) => b.date.startsWith(String(year)));
  type Line = { key: string; no: string; date: string; items: string; amount: number; paid: string; status: string; tone: string };
  const modeLabel = (b: { khata: number; cash: number }) => (b.khata > 0 ? L("pc_khata_mode") : L("pc_cash_mode"));
  const lines: Line[] = [
    ...(f !== "orders" ? bills.map((b) => ({ key: b.id, no: b.ref, date: b.date, items: b.items.map((i) => `${i.name} ×${i.qty}`).join(", "), amount: b.total, paid: modeLabel(b), status: b.status === "completed" ? "done" : b.status, tone: "" })) : []),
    ...(f !== "bills" ? orders.map((o) => ({ key: o.id, no: o.number, date: o.date, items: o.items.map((i) => `${i.name} ×${i.qty}`).join(", "), amount: o.grand_total, paid: o.payment_terms ?? "—", status: o.rejected ? "rejected" : o.status || "pending", tone: "" })) : []),
    ...(f === "all" ? returns.map((r, i) => ({ key: `r${i}`, no: r.ref, date: r.date, items: L("pc_returns_title"), amount: -r.amount, paid: "—", status: "returned", tone: "" })) : []),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));
  const track = orders.find(orderOpen) ?? orders[0];
  const stLabel = (s: string) => {
    const k = `pc_st_${s}` as TranslationKey;
    return t(k, lang) === k ? s : t(k, lang);
  };

  return (
    <div className="pf-fit mx-auto w-full max-w-[1760px] px-4 py-6 sm:px-6 fit:gap-2.5 fit:py-3">
      <PageHead title={<L3 k="pc_orders_title" lang={lang} />} sub={L("pc_orders_sub")} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 fit:grid-cols-4 fit:gap-2.5">
        <CKpi tone="blue" icon="🧾" label={<L3 k="pc_k_bills" lang={lang} />} value={String(yb.length)} sub={`${year} · ${rs(yb.reduce((a, b) => a + b.total, 0))}`} />
        <CKpi tone="violet" icon="📦" label={<L3 k="pc_k_orders" lang={lang} />} value={String(orders.length)} sub={`${orders.filter(orderOpen).length} ${L("pc_in_progress")}`} />
        <CKpi tone="amber" icon="⏳" label={<L3 k="pc_open_orders" lang={lang} />} value={String(orders.filter(orderOpen).length)} sub={track ? track.number : "—"} />
        <CKpi tone="green" icon="↩" label={<L3 k="pc_k_returns" lang={lang} />} value={String(returns.length)} sub={`${rs(returns.reduce((a, r) => a + r.amount, 0))} ${L("pc_credited")}`} />
      </div>
      <div className="pf-grow pf-grid mt-3.5 grid gap-3.5 lg:grid-cols-[1.4fr_1fr] fit:gap-2.5">
        <Panel className="pf-panel pf-navy fit:p-3.5">
          <PanelHead title={<L3 k="pc_bills_orders" lang={lang} />} right={
            <div className="flex gap-1.5">{(["all", "bills", "orders"] as const).map((k) => (
              <Link key={k} href={`/portal/c/orders?f=${k}`} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${f === k ? "bg-indigo-100 text-indigo-900 dark:bg-[#1a2c58] dark:text-white" : "bg-surface-100 text-surface-600 dark:bg-[#0d1a3a] dark:text-slate-300"}`}>{L(`pc_f_${k}` as TranslationKey)}</Link>
            ))}</div>} />
          <div className="pf-body overflow-x-auto">
            <table className="w-full min-w-[620px] text-[12.5px]">
              <thead><tr className="border-b border-surface-200 text-start text-[10.5px] uppercase tracking-wide text-surface-500 dark:border-[#1e3160] dark:text-slate-400">
                <th className="py-2">{L("pc_c_no")}</th><th>{L("pc_c_date")}</th><th>{L("pc_c_items")}</th><th className="text-end">{L("pc_c_amount")}</th><th className="ps-3">{L("pc_c_paidby")}</th><th>{L("pc_c_status")}</th>
              </tr></thead>
              <tbody>
                {lines.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-surface-500">{L("pc_empty")}</td></tr>}
                {lines.slice(0, 300).map((x) => (
                  <tr key={x.key} className="border-b border-surface-100 text-surface-800 dark:border-[#1e3160] dark:text-slate-100">
                    <td className="py-2.5"><Code>{x.no}</Code></td><td className="whitespace-nowrap">{shortDate(x.date, lang, year)}</td>
                    <td className="max-w-[240px] truncate" title={x.items}>{x.items || "—"}</td>
                    <td className={`text-end font-semibold ${x.amount < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{x.amount < 0 ? `−${rs(-x.amount).replace("Rs ", "")}` : rs(x.amount).replace("Rs ", "")}</td>
                    <td className="ps-3">{x.paid}</td><td><Pill tone={STATUS_TONE[x.status] ?? "amber"}>{stLabel(x.status)}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel className="pf-panel pf-navy fit:p-3.5">
          {track ? (
            <>
              <PanelHead title={<>{track.number} · {L("pc_tracking")}</>} right={<Pill tone="amber">{L("pc_step")} {stepIndex(track.steps)}/5</Pill>} />
              <div className="pf-body">
              <Steps labels={[L("pc_s_placed"), L("pc_s_sales"), L("pc_s_finance"), L("pc_s_approved"), L("pc_s_delivered")]} done={stepIndex(track.steps)} />
              {track.items.map((i, n) => <Row key={n}><span className="text-surface-800 dark:text-slate-100">{i.name}{i.pack ? ` ${i.pack}` : ""} × {i.qty}</span><b className="text-surface-900 dark:text-white">{rs(i.amount)}</b></Row>)}
              <Row><span className="text-surface-600 dark:text-slate-300">{L("pc_freight")}</span><b className="text-surface-900 dark:text-white">{rs(track.freight)}</b></Row>
              <Row><span className="font-semibold text-surface-800 dark:text-slate-100">{L("pc_c_amount")}</span><b className="text-rose-600 dark:text-rose-400">{rs(track.grand_total)}</b></Row>
              <div className="mt-3"><Lock>{L("pc_approvals_note")}</Lock></div>
              </div>
            </>
          ) : <><PanelHead title={<L3 k="pc_k_orders" lang={lang} />} /><Sub>{L("pc_empty")}</Sub></>}
        </Panel>
      </div>
    </div>
  );
}
