import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, CircleDollarSign, Landmark, Package, ReceiptText, Scale, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { canDo } from "@/lib/access/guard";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { shopZeroLeakageSnapshot } from "@/lib/pos/shop-zero-leakage";

export const dynamic = "force-dynamic";

const money = (v: number | null | undefined) => v == null ? "—" : `Rs ${Number(v).toLocaleString()}`;

export default async function Shop360MatchPage({ searchParams }: { searchParams?: { shop_id?: string; period?: string; from?: string; to?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role, branch_id, shop_id").eq("id", user.id).maybeSingle();
  if (!me) redirect("/login");
  const canView = UNRESTRICTED_ROLES.includes(me.role) || (await canDo("shop-360", "view"));
  if (!canView) return <Card><p className="text-sm">Aapko is safhe ki ijazat nahi hai.</p></Card>;

  const service = createServiceClient();
  const broad = UNRESTRICTED_ROLES.includes(me.role) || me.role === "finance";
  let shops: { id: string; name: string }[] = [];
  if (broad) {
    const { data } = await service.from("shops").select("id,name").eq("is_active", true).order("name");
    shops = data ?? [];
  } else if (me.role === "manager" && me.branch_id) {
    const { data } = await service.from("shops").select("id,name").eq("branch_id", me.branch_id).eq("is_active", true).order("name");
    shops = data ?? [];
  }
  const allowed = new Set(shops.map(s => s.id));
  const requested = searchParams?.shop_id || null;
  const shopId = broad
    ? requested || me.shop_id || shops[0]?.id || null
    : me.role === "manager"
      ? (requested && allowed.has(requested) ? requested : me.shop_id || shops[0]?.id || null)
      : me.shop_id;
  if (!shopId) return <EmptyState title="Shop assign nahi hai" description="Admin se profile par shop assign karwain." />;

  if (!broad && me.role !== "manager" && shopId !== me.shop_id) redirect("/admin/shop-360-match");
  if (!broad && me.role === "manager" && !allowed.has(shopId)) redirect("/admin/shop-360-match");

  const { data: shop } = await service.from("shops").select("name, branch_id, branches(name)").eq("id", shopId).maybeSingle();
  const shopName = shop?.name ?? "Shop";
  const branch = (shop as unknown as { branches?: { name?: string } })?.branches?.name ?? "";

  const today = new Date().toISOString().slice(0,10);
  const period = searchParams?.period || "day";
  const d = new Date();
  const weekStart = new Date(d.getTime() - 6 * 86400000).toISOString().slice(0,10);
  const monthStart = `${today.slice(0,7)}-01`;
  const from = period === "custom" ? searchParams?.from || today : period === "week" ? weekStart : period === "month" ? monthStart : today;
  const to = period === "custom" ? searchParams?.to || today : today;
  const snap = await shopZeroLeakageSnapshot(shopId, from, to);

  const cashMethod = snap.flow.sales.byMethod.find(x => x.method === "cash")?.sales ?? 0;
  const khataMethod = snap.flow.sales.byMethod.find(x => x.method === "khata")?.sales ?? 0;
  const digital = snap.flow.sales.byMethod.filter(x => !["cash","khata"].includes(x.method)).reduce((s,x) => s + x.sales, 0);
  const statusClass = snap.status === "matched" ? "border-emerald-300 bg-emerald-50" : snap.status === "difference" ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50";

  return <div className="space-y-5">
    <PageHeader title={`${shopName} — Zero-Leakage Match`} description={`${branch ? `${branch} · ` : ""}Har Rs1 ki jagah explain honi chahiye`} />

    <form method="GET" className="flex flex-wrap items-end gap-2 rounded-xl border border-surface-200 bg-white p-3 text-sm">
      {shops.length > 1 && <label className="text-xs">Shop<select name="shop_id" defaultValue={shopId} className="ml-2 rounded-lg border px-2 py-1.5">{shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
      <label className="text-xs">Period<select name="period" defaultValue={period} className="ml-2 rounded-lg border px-2 py-1.5"><option value="day">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="custom">Custom</option></select></label>
      {period === "custom" && <><input type="date" name="from" defaultValue={from} className="rounded-lg border px-2 py-1.5"/><input type="date" name="to" defaultValue={to} className="rounded-lg border px-2 py-1.5"/></>}
      <button className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white">Apply</button>
    </form>

    <Card className={`border-2 ${statusClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-surface-500">Shop Reconciliation</p><h2 className="mt-1 text-xl font-bold">{snap.status === "matched" ? "Fully Matched" : snap.status === "difference" ? "Difference Found" : "Reconciliation Incomplete"}</h2><p className="mt-1 text-sm text-surface-600">{from} → {to}</p></div>
        <div className="text-right"><p className="text-xs text-surface-500">Unexplained Cash Difference</p><p className="text-2xl font-bold tabular-nums">{money(snap.cash.fullDifference)}</p></div>
      </div>
      {snap.blockers.length > 0 && <div className="mt-4 space-y-1 border-t pt-3">{snap.blockers.map((b,i) => <p key={i} className="flex gap-2 text-xs text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0"/>{b}</p>)}</div>}
    </Card>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card><Package className="h-5 w-5 text-brand-600"/><p className="mt-2 text-xs text-surface-500">Closing Stock — Selling Rate</p><p className="text-xl font-bold">{money(snap.stock.value)}</p><p className="mt-1 text-[11px] text-surface-400">FIFO nahi; main match selling_price par.</p></Card>
      <Card><CircleDollarSign className="h-5 w-5 text-brand-600"/><p className="mt-2 text-xs text-surface-500">Selected Period Sales</p><p className="text-xl font-bold">{money(snap.flow.sales.total)}</p><p className="mt-1 text-[11px] text-surface-400">Payment methods ka total.</p></Card>
      <Card><ReceiptText className="h-5 w-5 text-brand-600"/><p className="mt-2 text-xs text-surface-500">Customer Khata — Shop Level</p><p className="text-xl font-bold">—</p><p className="mt-1 text-[11px] text-amber-700">Source abhi branch tak; fake allocation nahi.</p></Card>
      <Card><Landmark className="h-5 w-5 text-brand-600"/><p className="mt-2 text-xs text-surface-500">Collection Outstanding</p><p className="text-xl font-bold">{money(snap.deposits.outstanding)}</p><p className="mt-1 text-[11px] text-surface-400">Finance approval tak settle nahi.</p></Card>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card><h3 className="mb-3 flex items-center gap-2 font-semibold"><WalletCards className="h-4 w-4"/>Sales — Payment Method Match</h3><div className="space-y-2 text-sm">{snap.flow.sales.byMethod.length ? snap.flow.sales.byMethod.map(r => <div key={r.method} className="flex justify-between border-b border-surface-100 pb-2"><span>{r.label}</span><strong>{money(r.sales)}</strong></div>) : <p className="text-surface-400">Is period mein sale nahi.</p>}<div className="flex justify-between pt-1 font-bold"><span>Total POS Sales</span><span>{money(snap.flow.sales.total)}</span></div></div></Card>
      <Card><h3 className="mb-3 flex items-center gap-2 font-semibold"><Scale className="h-4 w-4"/>Cash Control</h3><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-surface-500">Cash Sales</p><b>{money(cashMethod)}</b></div><div><p className="text-xs text-surface-500">Cash Recovery</p><b>{money(snap.cash.cashRecoveryToday)}</b></div><div><p className="text-xs text-surface-500">Approved Cash Expense</p><b>{money(snap.cash.cashExpensesToday)}</b></div><div><p className="text-xs text-surface-500">Physical Count Difference</p><b>{money(snap.cash.fullDifference)}</b></div></div>{snap.cash.openShiftsCount > 0 && <p className="mt-3 text-xs text-amber-700">{snap.cash.openShiftsCount} shift open — final cash match pending.</p>}</Card>
    </div>

    <Card><h3 className="mb-3 font-semibold">Paisa / Value Kahan Hai?</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm"><div><p className="text-xs text-surface-500">Stock — Selling Rate</p><b>{money(snap.stock.value)}</b></div><div><p className="text-xs text-surface-500">Cash Sale — Selected Period</p><b>{money(cashMethod)}</b></div><div><p className="text-xs text-surface-500">Bank / Digital Sale — Selected Period</p><b>{money(digital)}</b></div><div><p className="text-xs text-surface-500">Khata Sale — Selected Period</p><b>{money(khataMethod)}</b></div><div><p className="text-xs text-surface-500">Approved Expenses — Selected Period</p><b>{money(snap.flow.expenses.total)}</b></div><div><p className="text-xs text-surface-500">Deposit Pending Finance</p><b>{money(snap.deposits.pendingDeposits)}</b></div><div><p className="text-xs text-surface-500">Finance Verified Deposit</p><b>{money(snap.deposits.approvedDeposits)}</b></div><div><p className="text-xs text-surface-500">Remaining Outstanding</p><b>{money(snap.deposits.outstanding)}</b></div></div><p className="mt-3 text-[11px] text-surface-400">Flows aur states ko jor kar fake total nahi banaya gaya. Pending deposit, verified deposit aur outstanding ek hi collection lifecycle ke different states hain.</p></Card>

    <Card><h3 className="mb-3 font-semibold">Company Deposit Status</h3><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5 text-sm"><div><p className="text-xs text-surface-500">Cash Collected</p><b>{money(snap.deposits.totalCashCollected)}</b></div><div><p className="text-xs text-surface-500">Submitted / Pending</p><b>{money(snap.deposits.pendingDeposits)}</b></div><div><p className="text-xs text-surface-500">Finance Verified</p><b>{money(snap.deposits.approvedDeposits)}</b></div><div><p className="text-xs text-surface-500">Remaining Outstanding</p><b>{money(snap.deposits.outstanding)}</b></div><div className="flex items-end"><Link href="/admin/my-collection" className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white">Deposit / History</Link></div></div></Card>

    <Card><h3 className="mb-3 font-semibold">Owner Movement</h3><div className="grid gap-3 sm:grid-cols-3 text-sm"><div><p className="text-xs text-surface-500">Investment</p><b>{money(snap.investment.totalInvestment)}</b></div><div><p className="text-xs text-surface-500">Withdrawal</p><b>{money(snap.investment.totalWithdrawals)}</b></div><div><p className="text-xs text-surface-500">Net Owner Equity Movement</p><b>{money(snap.investment.netOwnerEquity)}</b></div></div></Card>

    <div className="rounded-xl border border-surface-200 bg-surface-50 p-3 text-xs text-surface-600"><CheckCircle2 className="mr-1 inline h-4 w-4"/>Rule: Rs1 stock, payment, receivable, approved expense, outstanding ya verified company deposit mein explain na ho to FULLY MATCHED nahi dikhana.</div>
  </div>;
}
