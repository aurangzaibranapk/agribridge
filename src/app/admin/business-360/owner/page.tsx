import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { pnl, groupNet, machineryCost, stockPosition, categoryMargins, ledgerHref, validRange, type Maybe } from "@/lib/business360/core";
import { loadBusiness360 } from "@/lib/business360/data";

export const dynamic = "force-dynamic";
// Malik ka hukm: Business 360 sirf owner/admin.
const OWNER_ADMIN = new Set(["owner", "super_admin", "admin"]);

export default async function Business360OwnerPage({ searchParams }: { searchParams: { from?: string; to?: string; branch?: string } }) {
  const lang = getLanguageFromCookies("rm");
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await (createServiceClient() as any).from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !OWNER_ADMIN.has(String(me.role))) return <div className="p-8 text-center text-surface-500">{t("b3_no_access", lang)}</div>;

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
  const { from, to } = validRange(searchParams.from, searchParams.to, today);
  const branch = searchParams.branch && /^[0-9a-f-]{36}$/i.test(searchParams.branch) ? searchParams.branch : null;
  const d = await loadBusiness360({ from, to, today, branch });
  const NA = t("b3_na", lang);
  const money = (v: Maybe) => (v == null ? NA : `Rs ${Math.round(v).toLocaleString("en-PK")}`);
  const P = pnl(d.pnlLines);
  const depts = groupNet(d.pnlLines, (l) => l.department);
  const byBranch = groupNet(d.pnlLines, (l) => l.branch_id);
  const branchName = new Map(d.branches.map((b) => [b.id, b.name]));
  const milk = depts ? depts.find((x) => x.key === "Milk/Dairy") ?? { key: "Milk/Dairy", revenue: 0, cost: 0, net: 0 } : null;
  const stock = stockPosition(d.batches, d.sold, today, 60);
  const cats = categoryMargins(d.items);
  const cash = d.accounts ? d.accounts.filter((a) => a.account_type === "cash") : null;
  const bank = d.accounts ? d.accounts.filter((a) => a.account_type !== "cash") : null;
  const sumAcc = (xs: typeof cash) => (xs == null ? null : xs.reduce((a, x) => a + Number(x.current_balance ?? 0), 0));
  const q = `from=${from}&to=${to}${branch ? `&branch=${branch}` : ""}`;

  const Tile = ({ label, value, href }: { label: string; value: Maybe; href: string }) => (
    <Link href={href} className="rounded-xl border border-surface-200 bg-white p-4 shadow-sm hover:border-brand-400">
      <p className="text-[11px] font-semibold uppercase text-surface-500">{label}</p>
      <p className={`mt-1 tabular-nums ${value == null ? "text-sm text-surface-400" : "text-2xl font-semibold"}`}>{money(value)}</p>
      <p className="mt-1 text-[10px] text-brand-700">{t("b3_ledger", lang)} →</p>
    </Link>
  );

  return (
    <div className="space-y-4">
      <PageHeader title={t("b3_title", lang)} description={t("b3_subtitle", lang)} />
      <form className="flex flex-wrap items-end gap-2 text-sm">
        <label className="text-xs">{t("b3_from", lang)}<input type="date" name="from" defaultValue={from} className="block rounded border px-2 py-1" /></label>
        <label className="text-xs">{t("b3_to", lang)}<input type="date" name="to" defaultValue={to} className="block rounded border px-2 py-1" /></label>
        <label className="text-xs">{t("b3_branch", lang)}<select name="branch" defaultValue={branch ?? ""} className="block rounded border px-2 py-1"><option value="">{t("b3_all_branches", lang)}</option>{d.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <button className="rounded bg-brand-700 px-3 py-1.5 font-semibold text-white">{t("b3_apply", lang)}</button>
      </form>
      {Object.keys(d.errors).length > 0 && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{t("b3_partial", lang)}: {Object.keys(d.errors).join(", ")}</p>}

      <h2 className="text-sm font-semibold">{t("b3_today", lang)} ({today})</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label={t("b3_sales", lang)} value={d.today.sales} href={`/admin/reports/profit-loss?from=${today}&to=${today}`} />
        <Tile label={t("b3_purchases", lang)} value={d.today.purchases} href="/admin/purchases" />
        <Tile label={t("b3_expenses", lang)} value={d.today.expenses} href={`/admin/reports/profit-loss?from=${today}&to=${today}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-0">
          <h2 className="border-b px-4 py-3 text-sm font-semibold">{t("b3_cash_bank", lang)} — {money(sumAcc(cash))} / {money(sumAcc(bank))}</h2>
          {d.accounts == null ? <p className="p-4 text-xs text-surface-400">{NA}</p> : (
            <table className="w-full text-xs"><tbody className="divide-y divide-surface-100">
              {d.accounts.map((a) => <tr key={a.id}><td className="px-4 py-1.5"><Link className="text-brand-700 hover:underline" href={ledgerHref.fa(a.id, from, to)}>{a.name}</Link></td><td className="text-surface-500">{a.account_type}</td><td className="pr-4 text-right tabular-nums">{money(Number(a.current_balance))}</td></tr>)}
            </tbody></table>
          )}
        </Card>
        <Card className="p-0">
          <h2 className="border-b px-4 py-3 text-sm font-semibold">{t("b3_recv_pay", lang)}</h2>
          <table className="w-full text-xs"><thead className="bg-surface-50 text-[10px] uppercase text-surface-500"><tr><th className="px-4 py-1.5 text-left">{t("b3_party", lang)}</th><th className="text-right">{t("b3_receivable", lang)}</th><th className="pr-4 text-right">{t("b3_payable", lang)}</th></tr></thead>
            <tbody className="divide-y divide-surface-100">
              {d.parties.map((p) => <tr key={p.type}><td className="px-4 py-1.5"><Link className="text-brand-700 hover:underline" href={p.href}>{t(`b3_pt_${p.type}` as "b3_pt_customer", lang)}</Link><p className="text-[10px] text-surface-400">{p.source}</p></td><td className="text-right tabular-nums">{p.receivable == null ? "—" : money(p.receivable)}</td><td className="pr-4 text-right tabular-nums">{p.payable == null ? "—" : money(p.payable)}</td></tr>)}
              <tr className="font-semibold"><td className="px-4 py-1.5"><Link className="text-brand-700" href="/admin/receivable-aging">{t("b3_overdue_credit", lang)} (30+)</Link></td><td className="text-right text-red-700">{money(d.overdueCredit)}</td><td /></tr>
            </tbody></table>
          <p className="px-4 py-2 text-[10px] text-surface-400">{t("b3_dash_note", lang)}</p>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label={t("b3_stock_value", lang)} value={stock?.value ?? null} href="/admin/stock-statement" />
        <Link href="/admin/inventory" className="rounded-xl border border-surface-200 bg-white p-4 shadow-sm"><p className="text-[11px] font-semibold uppercase text-surface-500">{t("b3_low_stock", lang)}</p><p className="mt-1 text-2xl font-semibold">{d.low == null ? <span className="text-sm text-surface-400">{NA}</span> : d.low.length}</p></Link>
        <Link href="/admin/inventory" className="rounded-xl border border-surface-200 bg-white p-4 shadow-sm"><p className="text-[11px] font-semibold uppercase text-surface-500">{t("b3_expiring", lang)}</p><p className="mt-1 text-lg font-semibold">{stock == null ? <span className="text-sm text-surface-400">{NA}</span> : `${stock.expiring} · ${money(stock.expiringValue)}`}</p><p className="text-[10px] text-red-700">{stock ? `${t("b3_expired", lang)}: ${stock.expired} · ${money(stock.expiredValue)}` : ""}</p></Link>
        <Link href="/admin/inventory" className="rounded-xl border border-surface-200 bg-white p-4 shadow-sm"><p className="text-[11px] font-semibold uppercase text-surface-500">{t("b3_dead_stock", lang)}</p><p className="mt-1 text-lg font-semibold">{stock?.dead == null ? <span className="text-sm text-surface-400">{NA}</span> : `${stock.dead} · ${money(stock.deadValue)}`}</p></Link>
        <Tile label={`${t("b3_grain_pending", lang)}${d.grainPending ? ` (${d.grainPending.count})` : ""}`} value={d.grainPending?.amount ?? null} href="/admin/grain-procurement/payments" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Tile label={`${t("b3_milk", lang)} — ${t("b3_net", lang)}`} value={milk?.net ?? null} href={`/admin/reports/profit-loss?${q}`} />
        <Tile label={t("b3_machinery_cost", lang)} value={machineryCost(d.pnlLines)} href="/admin/machinery-rental" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-0">
          <h2 className="border-b px-4 py-3 text-sm font-semibold">{t("b3_pnl", lang)} ({from} → {to})</h2>
          {P == null ? <p className="p-4 text-xs text-surface-400">{NA} — {t("b3_pnl_na", lang)}</p> : (
            <>
              <div className="grid grid-cols-3 gap-2 p-4 text-xs">
                <div>{t("b3_revenue", lang)}<p className="text-lg font-semibold">{money(P.revenue)}</p></div>
                <div>{t("b3_gross", lang)}<p className="text-lg font-semibold">{money(P.gross)}</p></div>
                <div>{t("b3_net", lang)}<p className={`text-lg font-semibold ${P.net < 0 ? "text-red-700" : "text-emerald-700"}`}>{money(P.net)}{P.marginPct != null ? ` (${P.marginPct}%)` : ""}</p></div>
              </div>
              <table className="w-full text-xs"><tbody className="divide-y divide-surface-100">
                {P.accounts.map((a) => <tr key={a.code}><td className="px-4 py-1"><Link className="text-brand-700 hover:underline" href={ledgerHref.gl(a.code, from, to)}>{a.code} {a.name}</Link></td><td className="text-surface-500">{a.kind}</td><td className="pr-4 text-right tabular-nums">{money(a.amount)}</td></tr>)}
              </tbody></table>
            </>
          )}
        </Card>
        <div className="space-y-4">
          <Card className="p-0">
            <h2 className="border-b px-4 py-3 text-sm font-semibold">{t("b3_branch_perf", lang)}</h2>
            {byBranch == null ? <p className="p-4 text-xs text-surface-400">{NA}</p> : (
              <table className="w-full text-xs"><tbody className="divide-y divide-surface-100">
                {byBranch.map((b) => <tr key={b.key}><td className="px-4 py-1.5">{b.key === "—" ? "—" : <Link className="text-brand-700 hover:underline" href={`/admin/branches/${b.key}/statement`}>{branchName.get(b.key) ?? b.key.slice(0, 8)}</Link>}</td><td className="text-right tabular-nums">{money(b.revenue)}</td><td className="pr-4 text-right tabular-nums">{money(b.net)}</td></tr>)}
              </tbody></table>
            )}
          </Card>
          <Card className="p-0">
            <h2 className="border-b px-4 py-3 text-sm font-semibold">{t("b3_category_margin", lang)}</h2>
            {cats == null ? <p className="p-4 text-xs text-surface-400">{NA}</p> : (
              <table className="w-full text-xs"><tbody className="divide-y divide-surface-100">
                {cats.map((c) => <tr key={c.name}><td className="px-4 py-1.5">{c.name}</td><td className="text-right tabular-nums">{money(c.sales)}</td><td className="pr-4 text-right">{c.marginPct == null ? <span className="text-surface-400" title={`${c.missingCost} lines without cost`}>{NA}</span> : `${c.marginPct}%`}</td></tr>)}
              </tbody></table>
            )}
          </Card>
          <Card className="p-0">
            <h2 className="border-b px-4 py-3 text-sm font-semibold">{t("b3_departments", lang)}</h2>
            {depts == null ? <p className="p-4 text-xs text-surface-400">{NA}</p> : (
              <table className="w-full text-xs"><tbody className="divide-y divide-surface-100">
                {depts.map((x) => <tr key={x.key}><td className="px-4 py-1.5"><Link className="text-brand-700 hover:underline" href={`/admin/reports/profit-loss?${q}`}>{x.key}</Link></td><td className="text-right tabular-nums">{money(x.revenue)}</td><td className="pr-4 text-right tabular-nums">{money(x.net)}</td></tr>)}
              </tbody></table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
