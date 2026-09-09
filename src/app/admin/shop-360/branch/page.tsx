import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, GitBranch, Landmark, Package, Store, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { canDo } from "@/lib/access/guard";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { branchZeroLeakageSummary } from "@/lib/pos/shop-zero-leakage";

export const dynamic = "force-dynamic";
const money = (v: number | null | undefined) => v == null ? "—" : `Rs ${Number(v).toLocaleString()}`;

export default async function BranchShop360Page({ searchParams }: { searchParams?: { branch_id?: string; period?: string; from?: string; to?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, branch_id").eq("id", user.id).maybeSingle();
  if (!me) redirect("/login");

  const canView = UNRESTRICTED_ROLES.includes(me.role) || me.role === "finance" || me.role === "manager" || (await canDo("shop-360", "view"));
  if (!canView) return <Card><p className="text-sm">Aapko is safhe ki ijazat nahi hai.</p></Card>;

  const service = createServiceClient();
  const broad = UNRESTRICTED_ROLES.includes(me.role) || me.role === "finance";
  let branches: { id: string; name: string }[] = [];
  if (broad) {
    const { data } = await service.from("branches").select("id,name").order("name");
    branches = data ?? [];
  } else if (me.branch_id) {
    const { data } = await service.from("branches").select("id,name").eq("id", me.branch_id);
    branches = data ?? [];
  }

  const requested = searchParams?.branch_id || null;
  const allowed = new Set(branches.map((b) => b.id));
  const branchId = broad ? requested || me.branch_id || branches[0]?.id || null : me.branch_id;
  if (!branchId) return <EmptyState title="Branch assign nahi hai" description="Admin se profile par branch assign karwain." />;
  if (!broad && !allowed.has(branchId)) redirect("/admin/shop-360/branch");

  const branchName = branches.find((b) => b.id === branchId)?.name ?? "Branch";
  const today = new Date().toISOString().slice(0,10);
  const period = searchParams?.period || "day";
  const d = new Date();
  const weekStart = new Date(d.getTime() - 6 * 86400000).toISOString().slice(0,10);
  const monthStart = `${today.slice(0,7)}-01`;
  const from = period === "custom" ? searchParams?.from || today : period === "week" ? weekStart : period === "month" ? monthStart : today;
  const to = period === "custom" ? searchParams?.to || today : today;

  const summary = await branchZeroLeakageSummary(branchId, from, to);
  const statusClass = summary.status === "matched" ? "border-emerald-300 bg-emerald-50" : summary.status === "difference" ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50";

  return <div className="space-y-5">
    <PageHeader title={`${branchName} — Branch Reconciliation`} description="Shop → Branch Zero-Leakage Control" />

    <form method="GET" className="flex flex-wrap items-end gap-2 rounded-xl border border-surface-200 bg-white p-3 text-sm">
      {branches.length > 1 && <label className="text-xs">Branch<select name="branch_id" defaultValue={branchId} className="ml-2 rounded-lg border px-2 py-1.5">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
      <label className="text-xs">Period<select name="period" defaultValue={period} className="ml-2 rounded-lg border px-2 py-1.5"><option value="day">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="custom">Custom</option></select></label>
      {period === "custom" && <><input type="date" name="from" defaultValue={from} className="rounded-lg border px-2 py-1.5"/><input type="date" name="to" defaultValue={to} className="rounded-lg border px-2 py-1.5"/></>}
      <button className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white">Apply</button>
    </form>

    <Card className={`border-2 ${statusClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-surface-500">Branch Verification Status</p><h2 className="mt-1 text-xl font-bold">{summary.status === "matched" ? "Branch Fully Matched" : summary.status === "difference" ? "Branch Difference Found" : "Branch Reconciliation Incomplete"}</h2><p className="mt-1 text-sm text-surface-600">{from} → {to}</p></div>
        <div className="text-right"><p className="text-xs text-surface-500">Cash Difference (not Full Shop Difference)</p><p className="text-2xl font-bold tabular-nums">{money(summary.totalCashDifference)}</p></div>
      </div>
      {summary.status === "incomplete" && <p className="mt-3 flex items-center gap-2 text-xs text-amber-800"><AlertTriangle className="h-4 w-4"/>Kam az kam ek shop ka required source/verification incomplete hai; branch ko Fully Matched nahi dikhaya ja sakta.</p>}
    </Card>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Card><Store className="h-5 w-5 text-brand-600"/><p className="mt-2 text-xs text-surface-500">Active Shops</p><p className="text-xl font-bold">{summary.shops.length}</p></Card>
      <Card><Package className="h-5 w-5 text-brand-600"/><p className="mt-2 text-xs text-surface-500">Selling-Rate Stock</p><p className="text-xl font-bold">{money(summary.totalSellingStock)}</p></Card>
      <Card><WalletCards className="h-5 w-5 text-brand-600"/><p className="mt-2 text-xs text-surface-500">Selected Period Sales</p><p className="text-xl font-bold">{money(summary.totalSales)}</p></Card>
      <Card><Landmark className="h-5 w-5 text-brand-600"/><p className="mt-2 text-xs text-surface-500">Collection Outstanding</p><p className="text-xl font-bold">{money(summary.totalOutstanding)}</p></Card>
      <Card><GitBranch className="h-5 w-5 text-brand-600"/><p className="mt-2 text-xs text-surface-500">Pending Finance Deposit</p><p className="text-xl font-bold">{money(summary.totalPendingDeposit)}</p></Card>
    </div>

    <Card>
      <h3 className="mb-3 font-semibold">Branch ki tamam shops</h3>
      {summary.shops.length === 0 ? <p className="text-sm text-surface-400">Is branch mein active shop nahi mili.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-surface-500"><th className="pb-2 pr-3">Shop</th><th className="pb-2 pr-3 text-right">Stock</th><th className="pb-2 pr-3 text-right">Sales</th><th className="pb-2 pr-3 text-right">Outstanding</th><th className="pb-2 pr-3 text-right">Pending Deposit</th><th className="pb-2 pr-3 text-right">Cash Difference</th><th className="pb-2 text-right">Status</th></tr></thead><tbody>{summary.shops.map((r) => <tr key={r.shopId} className="border-b border-surface-100"><td className="py-2.5 pr-3"><Link className="font-medium text-brand-700 hover:underline" href={`/admin/shop-360/match?shop_id=${r.shopId}&period=${period}&from=${from}&to=${to}`}>{r.shopName}</Link></td><td className="py-2.5 pr-3 text-right tabular-nums">{money(r.sellingStock)}</td><td className="py-2.5 pr-3 text-right tabular-nums">{money(r.sales)}</td><td className="py-2.5 pr-3 text-right tabular-nums">{money(r.outstanding)}</td><td className="py-2.5 pr-3 text-right tabular-nums">{money(r.pendingDeposit)}</td><td className="py-2.5 pr-3 text-right tabular-nums">{money(r.cashDifference)}</td><td className="py-2.5 text-right">{r.status === "matched" ? "Matched" : r.status === "difference" ? "Difference" : "Incomplete"}</td></tr>)}</tbody></table></div>}
    </Card>

    <Card><div className="grid gap-3 sm:grid-cols-3 text-sm"><div><p className="text-xs text-surface-500">Finance Verified Deposits</p><b>{money(summary.totalVerifiedDeposit)}</b></div><div><p className="text-xs text-surface-500">Pending Finance Verification</p><b>{money(summary.totalPendingDeposit)}</b></div><div><p className="text-xs text-surface-500">Remaining Shop/Staff Outstanding</p><b>{money(summary.totalOutstanding)}</b></div></div></Card>

    <div className="rounded-xl border border-surface-200 bg-surface-50 p-3 text-xs text-surface-600"><CheckCircle2 className="mr-1 inline h-4 w-4"/>Branch Manager sirf apni assigned branch dekh sakta hai. Shop drill-down bhi server-side scope ke andar hai. Green status sirf tab allowed hai jab har shop ka status complete aur matched ho.</div>
  </div>;
}
