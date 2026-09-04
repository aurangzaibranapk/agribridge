import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { cashFlow, workingCapital, closingBalances, payReceiveSummary, partyBalances, branchPnl } from "@/lib/ledger/reports";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance"];

type View = "cashflow" | "working" | "closing" | "payrecv" | "party" | "branch";

const VIEWS: { key: View; labelKey: "fr_v_cashflow" | "fr_v_working" | "fr_v_closing" | "fr_v_payrecv" | "fr_v_party" | "fr_v_branch" }[] = [
  { key: "cashflow", labelKey: "fr_v_cashflow" },
  { key: "working", labelKey: "fr_v_working" },
  { key: "closing", labelKey: "fr_v_closing" },
  { key: "payrecv", labelKey: "fr_v_payrecv" },
  { key: "party", labelKey: "fr_v_party" },
  { key: "branch", labelKey: "fr_v_branch" },
];

function money(n: number) {
  const neg = n < 0;
  const s = Math.abs(Math.round(n)).toLocaleString();
  return neg ? `(${s})` : s;
}

/**
 * Maali reports -- malik ke naqshe ka paanchwan group.
 *
 * Chhe reports, ek safhe par, sab usi ledger se. Alag alag safhe banane
 * ka matlab hota ke har report apni tareekh ki hadd rakhti aur do
 * reports ka milaan karna khud ek kaam ban jata.
 */
export default async function FinanceReportsPage({
  searchParams,
}: {
  searchParams: { view?: string; from?: string; to?: string };
}) {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_active || !ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("fr_only_finance", lang)}</div>;
  }

  const view = (VIEWS.find((v) => v.key === searchParams.view)?.key ?? "cashflow") as View;
  const aaj = new Date().toISOString().slice(0, 10);
  const saalShuru = `${new Date().getFullYear()}-01-01`;
  const from = searchParams.from ?? saalShuru;
  const to = searchParams.to ?? aaj;

  const q = (v: View) => `/admin/finance/reports?view=${v}&from=${from}&to=${to}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("fr_title", lang)}
        description={t("fr_desc", lang)}
        actions={
          <Link
            href="/admin/finance/center"
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            <ArrowLeft className="h-4 w-4" /> {t("fr_back", lang)}
          </Link>
        }
      />

      <Card className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={q(v.key)}
              className={
                v.key === view
                  ? "rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-lg border border-surface-200 px-3 py-1.5 text-sm text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
              }
            >
              {t(v.labelKey, lang)}
            </Link>
          ))}
        </div>

        <form className="flex flex-wrap items-end gap-2" action="/admin/finance/reports">
          <input type="hidden" name="view" value={view} />
          <div>
            <label className="block text-xs text-surface-500" htmlFor="from">
              {t("fr_from", lang)}
            </label>
            <input
              id="from"
              type="date"
              name="from"
              defaultValue={from}
              className="rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
            />
          </div>
          <div>
            <label className="block text-xs text-surface-500" htmlFor="to">
              {t("fr_to", lang)}
            </label>
            <input
              id="to"
              type="date"
              name="to"
              defaultValue={to}
              className="rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-900"
            />
          </div>
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            {t("fr_show", lang)}
          </button>
          {(view === "working" || view === "party") && (
            <span className="text-xs text-surface-400">{t("fr_asof_note", lang)}</span>
          )}
        </form>
      </Card>

      {view === "cashflow" && <CashFlowView from={from} to={to} lang={lang} />}
      {view === "working" && <WorkingView asOf={to} lang={lang} />}
      {view === "closing" && <ClosingView from={from} to={to} lang={lang} />}
      {view === "payrecv" && <PayRecvView from={from} to={to} lang={lang} />}
      {view === "party" && <PartyView asOf={to} lang={lang} />}
      {view === "branch" && <BranchView from={from} to={to} lang={lang} />}
    </div>
  );
}

type L = ReturnType<typeof getLanguageFromCookies>;

function Khata({ msg }: { msg: string }) {
  return (
    <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
      {msg}
    </Card>
  );
}

async function CashFlowView({ from, to, lang }: { from: string; to: string; lang: L }) {
  const cf = await cashFlow(from, to);
  if (cf.error) return <Khata msg={`${t("fr_error", lang)}: ${cf.error}`} />;

  const section = (title: string, rows: typeof cf.operating, total: number) => (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-surface-500">{title}</p>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
          {rows.length === 0 && (
            <tr>
              <td className="py-2 text-surface-400">{t("fr_nothing", lang)}</td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.code}>
              <td className="py-1.5 text-surface-700 dark:text-surface-200">
                <span className="mr-2 font-mono text-xs text-surface-400">{r.code}</span>
                {r.name}
              </td>
              <td className={`py-1.5 text-right tabular-nums ${r.amount < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {money(r.amount)}
              </td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-1.5">{t("fr_total", lang)}</td>
            <td className="py-1.5 text-right tabular-nums">{money(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("fr_opening_cash", lang)}</p>
          <p className="mt-1 font-display text-xl font-semibold">Rs {money(cf.opening)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("fr_net_change", lang)}</p>
          <p className={`mt-1 font-display text-xl font-semibold ${cf.netChange < 0 ? "text-rose-600" : "text-emerald-600"}`}>
            Rs {money(cf.netChange)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("fr_closing_cash", lang)}</p>
          <p className="mt-1 font-display text-xl font-semibold">Rs {money(cf.closing)}</p>
        </Card>
      </div>

      <Card className="space-y-5">
        {section(t("fr_operating", lang), cf.operating, cf.operatingTotal)}
        {section(t("fr_investing", lang), cf.investing, cf.investingTotal)}
        {section(t("fr_financing", lang), cf.financing, cf.financingTotal)}
      </Card>

      <Card className="text-xs text-surface-500 dark:text-surface-400">{t("fr_cashflow_note", lang)}</Card>
    </div>
  );
}

async function WorkingView({ asOf, lang }: { asOf: string; lang: L }) {
  const wc = await workingCapital(asOf);
  if (wc.error) return <Khata msg={`${t("fr_error", lang)}: ${wc.error}`} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("fr_curr_assets", lang)}</p>
          <p className="mt-1 font-display text-xl font-semibold">Rs {money(wc.assetsTotal)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("fr_curr_liab", lang)}</p>
          <p className="mt-1 font-display text-xl font-semibold">Rs {money(wc.liabilitiesTotal)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("fr_working_capital", lang)}</p>
          <p className={`mt-1 font-display text-xl font-semibold ${wc.workingCapital < 0 ? "text-rose-600" : "text-emerald-600"}`}>
            Rs {money(wc.workingCapital)}
          </p>
          <p className="mt-1 text-xs text-surface-500">
            {t("fr_ratio", lang)}: {wc.ratio === null ? "—" : wc.ratio.toFixed(2)}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <p className="mb-2 font-display text-sm font-semibold">{t("fr_curr_assets", lang)}</p>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {wc.currentAssets.map((r) => (
                <tr key={r.code}>
                  <td className="py-1.5">
                    <span className="mr-2 font-mono text-xs text-surface-400">{r.code}</span>
                    {r.name}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{money(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <p className="mb-2 font-display text-sm font-semibold">{t("fr_curr_liab", lang)}</p>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {wc.currentLiabilities.map((r) => (
                <tr key={r.code}>
                  <td className="py-1.5">
                    <span className="mr-2 font-mono text-xs text-surface-400">{r.code}</span>
                    {r.name}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{money(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card className="text-xs text-surface-500 dark:text-surface-400">{t("fr_working_note", lang)}</Card>
    </div>
  );
}

async function ClosingView({ from, to, lang }: { from: string; to: string; lang: L }) {
  const cb = await closingBalances(from, to);
  if (cb.error) return <Khata msg={`${t("fr_error", lang)}: ${cb.error}`} />;

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-800/50">
          <tr>
            <th className="px-4 py-2">{t("fr_account", lang)}</th>
            <th className="px-4 py-2 text-right">{t("fr_opening", lang)}</th>
            <th className="px-4 py-2 text-right">{t("fr_debit", lang)}</th>
            <th className="px-4 py-2 text-right">{t("fr_credit", lang)}</th>
            <th className="px-4 py-2 text-right">{t("fr_closing", lang)}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
          {cb.rows.map((r) => (
            <tr key={r.code}>
              <td className="px-4 py-1.5">
                <span className="mr-2 font-mono text-xs text-surface-400">{r.code}</span>
                {r.name}
              </td>
              <td className="px-4 py-1.5 text-right tabular-nums text-surface-500">{money(r.opening)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{r.debit ? money(r.debit) : "—"}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{r.credit ? money(r.credit) : "—"}</td>
              <td className="px-4 py-1.5 text-right font-medium tabular-nums">{money(r.closing)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

async function PayRecvView({ from, to, lang }: { from: string; to: string; lang: L }) {
  const pr = await payReceiveSummary(from, to);
  if (pr.error) return <Khata msg={`${t("fr_error", lang)}: ${pr.error}`} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("fr_received", lang)}</p>
          <p className="mt-1 font-display text-xl font-semibold text-emerald-600">Rs {money(pr.totalReceived)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("fr_paid", lang)}</p>
          <p className="mt-1 font-display text-xl font-semibold text-rose-600">Rs {money(pr.totalPaid)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("fr_net", lang)}</p>
          <p className="mt-1 font-display text-xl font-semibold">Rs {money(pr.totalReceived - pr.totalPaid)}</p>
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-800/50">
            <tr>
              <th className="px-4 py-2">{t("fr_account", lang)}</th>
              <th className="px-4 py-2 text-right">{t("fr_received", lang)}</th>
              <th className="px-4 py-2 text-right">{t("fr_paid", lang)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
            {pr.rows.map((r) => (
              <tr key={r.code}>
                <td className="px-4 py-1.5">
                  <span className="mr-2 font-mono text-xs text-surface-400">{r.code}</span>
                  {r.name}
                </td>
                <td className="px-4 py-1.5 text-right tabular-nums text-emerald-600">{money(r.received)}</td>
                <td className="px-4 py-1.5 text-right tabular-nums text-rose-600">{money(r.paid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

async function PartyView({ asOf, lang }: { asOf: string; lang: L }) {
  const pb = await partyBalances(asOf);
  if (pb.error) return <Khata msg={`${t("fr_error", lang)}: ${pb.error}`} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("fr_receivable", lang)}</p>
          <p className="mt-1 font-display text-xl font-semibold text-emerald-600">Rs {money(pb.totalReceivable)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("fr_payable", lang)}</p>
          <p className="mt-1 font-display text-xl font-semibold text-rose-600">Rs {money(pb.totalPayable)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-surface-500">{t("fr_unnamed", lang)}</p>
          <p className="mt-1 font-display text-xl font-semibold">Rs {money(pb.bagherNishaan)}</p>
          <p className="mt-1 text-xs text-surface-500">{t("fr_unnamed_note", lang)}</p>
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-800/50">
            <tr>
              <th className="px-4 py-2">{t("fr_party", lang)}</th>
              <th className="px-4 py-2">{t("fr_party_type", lang)}</th>
              <th className="px-4 py-2 text-right">{t("fr_receivable", lang)}</th>
              <th className="px-4 py-2 text-right">{t("fr_payable", lang)}</th>
              <th className="px-4 py-2 text-right">{t("fr_net", lang)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
            {pb.rows.map((r) => (
              <tr key={`${r.partyType}:${r.partyId}`}>
                <td className="px-4 py-1.5">{r.name ?? "—"}</td>
                <td className="px-4 py-1.5 text-surface-500">{r.partyType}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{r.receivable ? money(r.receivable) : "—"}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{r.payable ? money(r.payable) : "—"}</td>
                <td className={`px-4 py-1.5 text-right font-medium tabular-nums ${r.net < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {money(r.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

async function BranchView({ from, to, lang }: { from: string; to: string; lang: L }) {
  const bp = await branchPnl(from, to);
  if (bp.error) return <Khata msg={`${t("fr_error", lang)}: ${bp.error}`} />;

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-800/50">
          <tr>
            <th className="px-4 py-2">{t("fr_branch", lang)}</th>
            <th className="px-4 py-2 text-right">{t("fr_income", lang)}</th>
            <th className="px-4 py-2 text-right">{t("fr_cogs", lang)}</th>
            <th className="px-4 py-2 text-right">{t("fr_expense", lang)}</th>
            <th className="px-4 py-2 text-right">{t("fr_profit", lang)}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
          {bp.rows.map((r) => (
            <tr key={r.branchId ?? "none"}>
              <td className="px-4 py-1.5">{r.branchName}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{money(r.income)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{money(r.cogs)}</td>
              <td className="px-4 py-1.5 text-right tabular-nums">{money(r.expense)}</td>
              <td className={`px-4 py-1.5 text-right font-medium tabular-nums ${r.profit < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {money(r.profit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
