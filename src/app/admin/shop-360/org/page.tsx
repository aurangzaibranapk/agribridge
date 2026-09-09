import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Building2, CheckCircle2, Landmark, Package, Store, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { organizationZeroLeakageSummary } from "@/lib/pos/shop-zero-leakage";

export const dynamic = "force-dynamic";
const money = (v: number | null | undefined) => v == null ? "—" : `Rs ${Number(v).toLocaleString()}`;

export default async function OrganizationShop360Page({ searchParams }: { searchParams?: { period?: string; from?: string; to?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!me) redirect("/login");

  // Organization-wide financial visibility stays deliberately narrow.
  // Admin/owner/super_admin plus Finance may see this consolidated view.
  const broad = UNRESTRICTED_ROLES.includes(me.role) || me.role === "finance";
  if (!broad) {
    return <Card><p className="text-sm">Aapko organization-level reconciliation ki ijazat nahi hai.</p></Card>;
  }

  const today = new Date().toISOString().slice(0,10);
  const period = searchParams?.period || "day";
  const d = new Date();
  const weekStart = new Date(d.getTime() - 6 * 86400000).toISOString().slice(0,10);
  const monthStart = `${today.slice(0,7)}-01`;
  const from = period === "custom" ? searchParams?.from || today : period === "week" ? weekStart : period === "month" ? monthStart : today;
  const to = period === "custom" ? searchParams?.to || today : today;

  const summary = await organizationZeroLeakageSummary(from, to);
  const statusClass = summary.status === "matched" ? "border-emerald-300 bg-emerald-50" : summary.status === "difference" ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50";

  return <div className="space-y-5">
    <PageHeader title="Organization Reconciliation" description="Company → Branch → Shop Zero-Leakage Control" />

    <form method="GET" className="flex flex-wrap items-end gap-2 rounded-xl border border-surface-200 bg-white p-3 text-sm">
      <label className="text-xs">Period<select name="period" defaultValue={period} className="ml-2 rounded-lg border px-2 py-1.5"><option value="day">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="custom">Custom</option></select></label>
      {period === "custom" && <><input type="date" name="from" defaultValue={from} className="rounded-lg border px-2 py-1.5"/><input type="date" name="to" defaultValue={to} className="rounded-lg border px-2 py-1.5"/></>}
      <button className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white">Apply</button>
    </form>

    <Card className={`border-2 ${statusClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-surface-500">Organization Verification Status</p><h2 className="mt-1 text-xl font-bold">{summary.status === "matched" ? "Organization Fully Matched" : summary.status === "difference" ? "Organization Difference Found" : "Organization Reconciliation Incomplete"}</h2><p className="mt-1 text-sm text-surface-600">{from} → {to}</p></div>
        <div className="text-right"><p className="text-xs text-surface-500">Cash Difference (not Full Business Difference)</p><p className="text-2xl font-bold tabular-nums">{money(summary.totalCashDifference)}</p></div>
      </div>
      {summary.status === "incomplete" && <p className="mt-3 flex items-center gap-2 text-xs text-amber-800"><AlertTriangle className="h-4 w-4"/>Kam az kam ek branch/shop ka required source incomplete hai. Organization ko Fully Matched nahi dikhaya ja sakta.</p>}
    </Card>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <Card><Building2 className="h-5 w-5 text-brand-600"/><p className="mt-2 text-xs text-surface-500">Branches</p><p className="text-xl font-bold">{summary.branches.length}</p></Card>
      <Card><Store className="h-5 w-5 text-brand-600"/><p className="mt-2 text-xs text-surface-500">Active Shops</p><p className="text-xl font-bold">{summary.totalShops}</p></Card>
      <Card><Package className="h-5 w-5 text-brand-600"/><p className="mt-2 text-xs text-surface-500">Selling-Rate Stock</p><p className="text-xl font-bold">{money(summary.totalSellingStock)}</p></Card>
      <Card><WalletCards className="h-5 w-5 text-brand-600"/><p className="mt-2 text-xs text-surface-500">Selected Period Sales</p><p className="text-xl font-bold">{money(summary.totalSales)}</p></Card>
      <Card><Landmark className="h-5 w-5 text-brand-600"/><p className="mt-2 text-xs text-surface-500">Collection Outstanding</p><p className="text-xl font-bold">{money(summary.totalOutstanding)}</p></Card>
      <Card><Landmark className="h-5 w-5 text-brand-600"/><p className="mt-2 text-xs text-surface-500">Pending Finance Deposit</p><p className="text-xl font-bold">{money(summary.totalPendingDeposit)}</p></Card>
    </div>

    <Card>
      <h3 className="mb-3 font-semibold">Branch-wise Reconciliation</h3>
      {summary.branches.length === 0 ? <p className="text-sm text-surface-400">Koi branch nahi mili.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-surface-500"><th className="pb-2 pr-3">Branch</th><th className="pb-2 pr-3 text-right">Shops</th><th className="pb-2 pr-3 text-right">Stock</th><th className="pb-2 pr-3 text-right">Sales</th><th className="pb-2 pr-3 text-right">Outstanding</th><th className="pb-2 pr-3 text-right">Pending Deposit</th><th className="pb-2 pr-3 text-right">Cash Difference</th><th className="pb-2 text-right">Status</th></tr></thead><tbody>{summary.branches.map((r) => <tr key={r.branchId} className="border-b border-surface-100"><td className="py-2.5 pr-3"><Link className="font-medium text-brand-700 hover:underline" href={`/admin/shop-360/branch?branch_id=${r.branchId}&period=${period}&from=${from}&to=${to}`}>{r.branchName}</Link></td><td className="py-2.5 pr-3 text-right">{r.shopCount}</td><td className="py-2.5 pr-3 text-right tabular-nums">{money(r.sellingStock)}</td><td className="py-2.5 pr-3 text-right tabular-nums">{money(r.sales)}</td><td className="py-2.5 pr-3 text-right tabular-nums">{money(r.outstanding)}</td><td className="py-2.5 pr-3 text-right tabular-nums">{money(r.pendingDeposit)}</td><td className="py-2.5 pr-3 text-right tabular-nums">{money(r.cashDifference)}</td><td className="py-2.5 text-right">{r.status === "matched" ? "Matched" : r.status === "difference" ? "Difference" : "Incomplete"}</td></tr>)}</tbody></table></div>}
    </Card>

    <Card><div className="grid gap-3 sm:grid-cols-3 text-sm"><div><p className="text-xs text-surface-500">Finance Verified Deposits</p><b>{money(summary.totalVerifiedDeposit)}</b></div><div><p className="text-xs text-surface-500">Pending Finance Verification</p><b>{money(summary.totalPendingDeposit)}</b></div><div><p className="text-xs text-surface-500">Remaining Shop/Staff Outstanding</p><b>{money(summary.totalOutstanding)}</b></div></div></Card>

    <div className="rounded-xl border border-surface-200 bg-surface-50 p-3 text-xs text-surface-600"><CheckCircle2 className="mr-1 inline h-4 w-4"/>Drill-down chain: Company → Branch → Shop. Green status tab tak nahi aata jab tak neeche ka required reconciliation complete aur matched na ho.</div>
  </div>;
}
