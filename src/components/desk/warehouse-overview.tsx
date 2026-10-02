import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { Package, ArrowLeftRight, ClipboardCheck, AlertTriangle, CheckCircle2 } from "lucide-react";

const money = (n: number | null | undefined) =>
  n == null ? "—" : `Rs ${Math.round(n).toLocaleString("en-PK")}`;
const ct = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-PK"));

export async function WarehouseOverview({ branchId }: { branchId: string | null }) {
  const service = createServiceClient();

  try {
    const [pendingTransfersRes, activeCountsRes, discrepancyRes, recentTransfersRes] = await Promise.all([
      service
        .from("stock_transfers")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      service
        .from("stock_counts")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_progress"),
      service
        .from("stock_transfers")
        .select("id", { count: "exact", head: true })
        .eq("status", "discrepancy"),
      service
        .from("stock_transfers")
        .select("id, transfer_number, quantity, status, created_at, products(name), from_wh:from_warehouse_id(name), to_wh:to_warehouse_id(name)")
        .in("status", ["pending", "in_transit"])
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const pendingCount = pendingTransfersRes.count ?? 0;
    const activeCountsCount = activeCountsRes.count ?? 0;
    const discrepancyCount = discrepancyRes.count ?? 0;
    const recentTransfers = recentTransfersRes.data ?? [];

    return (
      <div className="staff-desk-screen">
        <div className="staff-desk-top-grid">
          <section className="desk-card staff-desk-ledger">
            <div className="staff-desk-card-title">
              <span><Package /> Stock Status</span>
              <span className="staff-desk-live">Godown</span>
            </div>
            <div className="staff-desk-ledger-total">
              <strong>{ct(pendingCount)}</strong>
              <span>Pending stock transfers</span>
            </div>
            <div className="staff-desk-ledger-split">
              <div><span>Active counts</span><strong>{ct(activeCountsCount)}</strong></div>
              <div><span>Discrepancies</span><strong className={discrepancyCount > 0 ? "text-red-600 dark:text-red-400" : undefined}>{ct(discrepancyCount)}</strong></div>
              <div><span>Pending moves</span><strong>{ct(pendingCount)}</strong></div>
            </div>
            <Link href="/admin/inventory" className="mt-4 block text-[12px] text-brand-600 dark:text-brand-400">
              Inventory kholein →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary">
            <h2><ArrowLeftRight /> Pending Transfers</h2>
            <div className="staff-desk-funnel">
              <div><strong>{ct(pendingCount)}</strong><span>Pending</span></div>
              <div><strong>{ct(discrepancyCount)}</strong><span>Discrepancy</span></div>
              <div><strong>—</strong><span>In transit</span></div>
            </div>
            <Link href="/admin/stock-transfers" className="mt-3 block text-[12px] text-brand-600 dark:text-brand-400">
              Stock transfers →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary">
            <h2><ClipboardCheck /> Stock Counts</h2>
            <div className="staff-desk-health">
              <div><strong>{ct(activeCountsCount)}</strong><span>In progress</span></div>
              <div><strong>—</strong><span>Completed</span></div>
              <div><strong>—</strong><span>Scheduled</span></div>
            </div>
            <Link href="/admin/stock-count" className="mt-3 block text-[12px] text-brand-600 dark:text-brand-400">
              Stock count →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary staff-desk-urgent">
            <h2><AlertTriangle /> Discrepancies</h2>
            {discrepancyCount > 0 ? (
              <>
                <div className="staff-desk-funnel">
                  <div><strong className="text-red-600 dark:text-red-400">{ct(discrepancyCount)}</strong><span>Maslay</span></div>
                </div>
                <Link href="/admin/stock-transfers" className="mt-3 block text-[12px] text-red-600 dark:text-red-400 font-medium">
                  Dekhein aur theek karein →
                </Link>
              </>
            ) : (
              <p className="flex items-center gap-1.5 mt-2 text-[12px] text-surface-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Koi discrepancy nahi
              </p>
            )}
          </section>
        </div>

        {/* Recent Transfers */}
        <section className="desk-card">
          <div className="staff-desk-card-title">
            <span><ArrowLeftRight /> Haal Ki Stock Transfers</span>
            <Link href="/admin/stock-transfers" className="text-[11px] text-brand-600 dark:text-brand-400">Sab dekhein →</Link>
          </div>
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {recentTransfers.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-surface-400">Koi pending transfer nahi.</p>
            ) : (
              recentTransfers.map((tr: any) => {
                const product = Array.isArray(tr.products) ? tr.products[0] : tr.products;
                const fromWh = Array.isArray(tr.from_wh) ? tr.from_wh[0] : tr.from_wh;
                const toWh = Array.isArray(tr.to_wh) ? tr.to_wh[0] : tr.to_wh;
                return (
                  <div key={tr.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-surface-800 dark:text-surface-100">
                        {product?.name ?? "—"} · {tr.quantity} units
                      </p>
                      <p className="truncate text-[11px] text-surface-500">
                        {fromWh?.name ?? "—"} → {toWh?.name ?? "—"}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      tr.status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" :
                      tr.status === "in_transit" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" :
                      "bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400"
                    }`}>
                      {tr.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    );
  } catch {
    return (
      <div className="desk-card">
        <p className="text-sm text-surface-500">Warehouse ka data load nahi hua. Refresh karein.</p>
        <Link href="/admin/inventory" className="mt-2 block text-sm text-brand-600">Inventory kholein →</Link>
      </div>
    );
  }
}
