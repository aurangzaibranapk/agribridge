import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { Card, PageHeader } from "@/components/ui/layout-primitives";
import Link from "next/link";
import { TrendingDown, TrendingUp, Package, ArrowRight, Building2, AlertTriangle, MoveRight, ShoppingCart, ArrowDownToLine, ChevronRight, Warehouse } from "lucide-react";

export const dynamic = "force-dynamic";

function rs(n: number) {
  return `Rs ${Math.round(n).toLocaleString()}`;
}

export default async function StockStatementPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_active) redirect("/login");
  if (!["owner", "admin", "super_admin"].includes(profile.role)) redirect("/admin");

  const service = createServiceClient();

  const [batchesResult, warehousesResult, agriOrdersResult] = await Promise.all([
    // Stock batches: initial + remaining per product per warehouse
    service
      .from("stock_batches")
      .select("warehouse_id, product_id, initial_quantity, remaining_quantity, unit_cost, batch_number, created_at"),
    // Warehouses with branch names
    service
      .from("warehouses")
      .select("id, name, branch_id, branches(name)")
      .eq("is_active", true),
    // Agri orders (all completed/dispatched/delivered)
    service
      .from("agri_orders")
      .select("id, order_number, shop_dealer_name, order_to_branch_id, order_from_branch_id, grand_total, status, created_at, branches!agri_orders_order_to_branch_id_fkey(name)")
      .in("status", ["completed", "dispatched", "delivered", "grn_submitted"])
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const batches = batchesResult.data ?? [];
  const warehouses = warehousesResult.data ?? [];
  const agriOrders = agriOrdersResult.data ?? [];

  // Build warehouse id → name map
  const whMap = new Map<string, { name: string; branchName: string }>();
  for (const w of warehouses) {
    const bname =
      (Array.isArray(w.branches) ? w.branches[0]?.name : (w.branches as any)?.name) ?? "—";
    whMap.set(w.id, { name: w.name, branchName: bname });
  }

  // Aggregate per warehouse
  interface WhSummary {
    warehouseId: string;
    warehouseName: string;
    branchName: string;
    productCount: number;
    initialValue: number;
    remainingValue: number;
    goneValue: number;
    batchCount: number;
  }

  const whSummaryMap = new Map<string, WhSummary>();
  const productsByWh = new Map<string, Set<string>>();

  for (const b of batches) {
    const wid = b.warehouse_id ?? "";
    if (!wid) continue;
    const wh = whMap.get(wid);
    if (!wh) continue;
    const initial = Number(b.initial_quantity) * Number(b.unit_cost);
    const remaining = Number(b.remaining_quantity) * Number(b.unit_cost);
    if (!whSummaryMap.has(wid)) {
      whSummaryMap.set(wid, {
        warehouseId: wid,
        warehouseName: wh.name,
        branchName: wh.branchName,
        productCount: 0,
        initialValue: 0,
        remainingValue: 0,
        goneValue: 0,
        batchCount: 0,
      });
      productsByWh.set(wid, new Set());
    }
    const entry = whSummaryMap.get(wid)!;
    entry.initialValue += initial;
    entry.remainingValue += remaining;
    entry.goneValue += initial - remaining;
    entry.batchCount += 1;
    const pid = b.product_id ?? "";
    if (pid) productsByWh.get(wid)!.add(pid);
  }

  for (const [wid, summary] of whSummaryMap) {
    summary.productCount = productsByWh.get(wid)?.size ?? 0;
  }

  const whSummaries = Array.from(whSummaryMap.values()).sort((a, b) => b.initialValue - a.initialValue);

  const totalInitial = whSummaries.reduce((s, w) => s + w.initialValue, 0);
  const totalRemaining = whSummaries.reduce((s, w) => s + w.remainingValue, 0);
  const totalGone = whSummaries.reduce((s, w) => s + w.goneValue, 0);

  // Agri orders: group by destination branch
  interface BranchOrderSummary {
    branchName: string;
    totalValue: number;
    orderCount: number;
    orders: { orderNumber: string; date: string; value: number; status: string; id: string }[];
  }
  const branchOrderMap = new Map<string, BranchOrderSummary>();

  for (const order of agriOrders) {
    const branchId = order.order_to_branch_id ?? "none";
    const branchName =
      (Array.isArray(order.branches)
        ? order.branches[0]?.name
        : (order.branches as any)?.name) ??
      order.shop_dealer_name ??
      "Unknown";
    if (!branchOrderMap.has(branchId)) {
      branchOrderMap.set(branchId, { branchName, totalValue: 0, orderCount: 0, orders: [] });
    }
    const entry = branchOrderMap.get(branchId)!;
    entry.totalValue += Number(order.grand_total);
    entry.orderCount += 1;
    entry.orders.push({
      orderNumber: order.order_number,
      date: new Date(order.created_at).toLocaleDateString("en-PK"),
      value: Number(order.grand_total),
      status: order.status,
      id: order.id,
    });
  }

  const branchOrderSummaries = Array.from(branchOrderMap.values()).sort(
    (a, b) => b.totalValue - a.totalValue
  );
  const totalAgriValue = branchOrderSummaries.reduce((s, b) => s + b.totalValue, 0);

  const discrepancy = totalGone - totalAgriValue;

  return (
    <div>
      <PageHeader
        title="Stock Statement"
        description="Kitna stock kahan se aaya, kahan gaya, kitna bacha — ek nazar mein"
      />

      {/* Two statement shortcuts */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/admin/stock-statement/transfers"
          className="group flex items-center gap-4 rounded-card border border-surface-200 bg-white p-4 shadow-card transition hover:border-brand-300 hover:shadow-md dark:border-surface-800 dark:bg-surface-900 dark:hover:border-brand-700"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100 dark:bg-brand-900/20 dark:text-brand-400">
            <MoveRight className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-surface-900 dark:text-white">HQ se Dukan — Maal Bheja</p>
            <p className="text-xs text-surface-500">Har dispatch: kaunsa maal, kab, kahan gaya</p>
          </div>
          <ArrowRight className="ml-auto h-4 w-4 text-surface-400 group-hover:text-brand-600 dark:group-hover:text-brand-400" />
        </Link>
        <Link
          href="/admin/stock-statement/sales"
          className="group flex items-center gap-4 rounded-card border border-surface-200 bg-white p-4 shadow-card transition hover:border-brand-300 hover:shadow-md dark:border-surface-800 dark:bg-surface-900 dark:hover:border-brand-700"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-surface-900 dark:text-white">Dukan se Gahak — Bikri</p>
            <p className="text-xs text-surface-500">Har sale: invoice, gahak, cheez, miqdar</p>
          </div>
          <ArrowRight className="ml-auto h-4 w-4 text-surface-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
        </Link>
      </div>

      {/* Grand summary */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card className="border-brand-200 bg-brand-50 dark:border-brand-900/40 dark:bg-brand-950/30">
          <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Total Aaya (Purchase)</span>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-brand-800 dark:text-brand-200">
            {rs(totalInitial)}
          </p>
          <p className="mt-0.5 text-xs text-surface-500">stock_batches ki bunyad par</p>
        </Card>
        <Card className="border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <TrendingDown className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Gaya / Nikla</span>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-red-800 dark:text-red-200">
            {rs(totalGone)}
          </p>
          <p className="mt-0.5 text-xs text-surface-500">initial − remaining</p>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/30">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <Package className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Abhi Bacha</span>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-green-800 dark:text-green-200">
            {rs(totalRemaining)}
          </p>
          <p className="mt-0.5 text-xs text-surface-500">har godam ka remaining</p>
        </Card>
      </div>

      {/* Discrepancy alert */}
      {Math.abs(discrepancy) > 100 && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <span className="font-semibold">Farq:</span> "Nikla hua" ({rs(totalGone)}) aur "Agri Orders
            ki total" ({rs(totalAgriValue)}) mein{" "}
            <span className="font-semibold">{rs(Math.abs(discrepancy))}</span> ka farq hai — ye POS
            sales ya manual adjustments se hoga.
          </div>
        </div>
      )}

      {/* Warehouse hierarchy — HQ upar, branches neeche */}
      <div className="mb-8">
        <h2 className="mb-4 text-sm font-semibold text-surface-800 dark:text-surface-200">
          Godam ka Naqsha — Kahan Se Kahan Gaya
        </h2>

        {(() => {
          const isHQ = (w: WhSummary) =>
            w.warehouseName.toLowerCase().includes("hq") ||
            w.warehouseName.toLowerCase().includes("head quarter") ||
            w.branchName.toLowerCase().includes("hq") ||
            w.branchName.toLowerCase().includes("head quarter");

          const hqList    = whSummaries.filter(isHQ);
          const branchList = whSummaries.filter((w) => !isHQ(w));

          const WarehouseCard = ({ w, isCenter }: { w: WhSummary; isCenter: boolean }) => {
            const pct = w.initialValue > 0 ? (w.remainingValue / w.initialValue) * 100 : 0;
            return (
              <div
                className={`rounded-xl border p-5 shadow-sm ${
                  isCenter
                    ? "border-brand-300 bg-brand-50 dark:border-brand-800 dark:bg-brand-950/30"
                    : "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        isCenter
                          ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                          : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                      }`}
                    >
                      {isCenter ? <Building2 className="h-5 w-5" /> : <Warehouse className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/stock-statement/warehouse/${w.warehouseId}`}
                          className={`font-semibold hover:underline ${
                            isCenter
                              ? "text-brand-800 dark:text-brand-200"
                              : "text-green-800 dark:text-green-200"
                          }`}
                        >
                          {w.warehouseName}
                        </Link>
                        {isCenter && (
                          <span className="rounded-full bg-brand-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-800 dark:bg-brand-800 dark:text-brand-200">
                            Central HQ
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-surface-500">{w.branchName} · {w.productCount} products · {w.batchCount} batches</p>
                    </div>
                  </div>
                  <Link
                    href={`/admin/stock-statement/warehouse/${w.warehouseId}`}
                    className="flex items-center gap-1 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-medium text-surface-700 shadow-sm hover:border-brand-300 hover:text-brand-700 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-300"
                  >
                    Products dekhein <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {/* Stats row */}
                <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg bg-white/70 px-3 py-2 dark:bg-surface-900/50">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-brand-600 dark:text-brand-400">Total Aaya</p>
                    <p className="tabular-nums font-bold text-brand-800 dark:text-brand-200">{rs(w.initialValue)}</p>
                  </div>
                  <div className="rounded-lg bg-white/70 px-3 py-2 dark:bg-surface-900/50">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-red-600 dark:text-red-400">Nikla / Gaya</p>
                    <p className="tabular-nums font-bold text-red-700 dark:text-red-300">{w.goneValue > 0 ? rs(w.goneValue) : "—"}</p>
                  </div>
                  <div className="rounded-lg bg-white/70 px-3 py-2 dark:bg-surface-900/50">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-green-700 dark:text-green-400">Abhi Bacha</p>
                    <p className="tabular-nums font-bold text-green-800 dark:text-green-300">{rs(w.remainingValue)}</p>
                  </div>
                  <div className="rounded-lg bg-white/70 px-3 py-2 dark:bg-surface-900/50">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-surface-500">% Bacha</p>
                    <p className={`tabular-nums font-bold ${pct >= 70 ? "text-green-700 dark:text-green-400" : pct >= 30 ? "text-amber-700 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                      {pct.toFixed(0)}%
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/60 dark:bg-surface-900/40">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pct >= 70 ? "bg-green-500" : pct >= 30 ? "bg-amber-400" : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          };

          return (
            <div>
              {/* HQ Warehouses */}
              {hqList.map((w) => (
                <div key={w.warehouseId} className="mb-2">
                  <WarehouseCard w={w} isCenter={true} />

                  {/* Arrow + Agri Orders connector */}
                  {branchList.length > 0 && (
                    <div className="flex flex-col items-center py-2">
                      <div className="h-4 w-px bg-brand-300 dark:bg-brand-700" />
                      <div className="flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-700 shadow-sm dark:border-brand-800 dark:bg-surface-900 dark:text-brand-300">
                        <ArrowDownToLine className="h-3.5 w-3.5" />
                        {branchOrderSummaries.length > 0
                          ? `${branchOrderSummaries.reduce((s, b) => s + b.orderCount, 0)} Agri Orders — ${rs(totalAgriValue)} bheja`
                          : "Stock bheja →"}
                      </div>
                      <div className="h-4 w-px bg-brand-300 dark:bg-brand-700" />
                    </div>
                  )}
                </div>
              ))}

              {/* Branch Warehouses */}
              <div className={`space-y-3 ${hqList.length > 0 ? "pl-4 border-l-2 border-brand-200 dark:border-brand-800" : ""}`}>
                {branchList.map((w) => (
                  <WarehouseCard key={w.warehouseId} w={w} isCenter={false} />
                ))}
              </div>

              {/* Total footer */}
              <div className="mt-4 flex flex-wrap gap-4 rounded-lg border border-surface-200 bg-surface-50 px-4 py-3 text-sm dark:border-surface-700 dark:bg-surface-800">
                <span className="font-semibold text-surface-600 dark:text-surface-400">TOTAL</span>
                <span className="font-bold text-brand-700 dark:text-brand-300">{rs(totalInitial)} aaya</span>
                <span className="text-surface-400">−</span>
                <span className="font-bold text-red-700 dark:text-red-400">{rs(totalGone)} gaya</span>
                <span className="text-surface-400">=</span>
                <span className="font-bold text-green-700 dark:text-green-400">{rs(totalRemaining)} bacha</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Agri orders - stock kahan gaya */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-surface-800 dark:text-surface-200">
            Agri Orders — Stock Kahan Gaya
          </h2>
          <Link
            href="/admin/agri-orders?show=all"
            className="text-xs text-brand-600 hover:underline dark:text-brand-400"
          >
            Sab Orders Dekhen →
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branchOrderSummaries.map((b) => (
            <div
              key={b.branchName}
              className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900"
            >
              <div className="flex items-center gap-2 border-b border-surface-100 px-4 py-3 dark:border-surface-800">
                <Building2 className="h-4 w-4 text-surface-500" />
                <span className="flex-1 font-medium text-surface-900 dark:text-white">
                  {b.branchName}
                </span>
                <span className="text-xs text-surface-500">{b.orderCount} order</span>
              </div>
              <div className="px-4 py-3">
                <p className="text-lg font-bold text-red-700 dark:text-red-400">{rs(b.totalValue)}</p>
                <p className="mt-0.5 text-xs text-surface-500">total stock gaya</p>
              </div>
              <div className="border-t border-surface-100 px-4 py-2 dark:border-surface-800">
                {b.orders.slice(0, 4).map((o) => (
                  <div key={o.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-1.5">
                      <ArrowRight className="h-3 w-3 text-surface-400" />
                      <Link
                        href={`/admin/agri-orders/${o.id}`}
                        className="font-mono text-xs text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {o.orderNumber}
                      </Link>
                      <span className="text-xs text-surface-400">{o.date}</span>
                    </div>
                    <span className="text-xs font-medium text-surface-700 dark:text-surface-300">
                      {rs(o.value)}
                    </span>
                  </div>
                ))}
                {b.orders.length > 4 && (
                  <p className="mt-1 text-xs text-surface-400">+{b.orders.length - 4} aur...</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {branchOrderSummaries.length === 0 && (
          <p className="py-8 text-center text-sm text-surface-400">Koi agri order nahi mila.</p>
        )}

        {/* Total row */}
        {branchOrderSummaries.length > 0 && (
          <div className="mt-3 flex justify-end rounded-lg border border-surface-200 bg-surface-50 px-4 py-2.5 dark:border-surface-700 dark:bg-surface-800">
            <span className="mr-4 text-sm text-surface-600 dark:text-surface-400">
              Sab branches mein gaya:
            </span>
            <span className="font-bold text-red-700 dark:text-red-400">{rs(totalAgriValue)}</span>
          </div>
        )}
      </div>

      {/* Balance check */}
      <div className="rounded-lg border border-surface-200 bg-surface-50 px-4 py-4 dark:border-surface-700 dark:bg-surface-800">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-surface-500">
          Balance Jaanch (Bug Pakarne ka Tareeqa)
        </h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-surface-500">Stock Aaya</p>
            <p className="font-semibold text-brand-700 dark:text-brand-300">{rs(totalInitial)}</p>
          </div>
          <div>
            <p className="text-xs text-surface-500">Agri Orders</p>
            <p className="font-semibold text-red-700 dark:text-red-400">− {rs(totalAgriValue)}</p>
          </div>
          <div>
            <p className="text-xs text-surface-500">Abhi Bacha</p>
            <p className="font-semibold text-green-700 dark:text-green-400">{rs(totalRemaining)}</p>
          </div>
          <div>
            <p className="text-xs text-surface-500">POS/Adjustments</p>
            <p
              className={`font-semibold ${
                Math.abs(discrepancy) > 100
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-surface-600 dark:text-surface-400"
              }`}
            >
              ≈ {rs(discrepancy)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
