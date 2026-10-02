import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { aajKaKhana } from "@/lib/utils/format";
import { Tractor, Calendar, Wallet, AlertTriangle, CheckCircle2 } from "lucide-react";

const money = (n: number | null | undefined) =>
  n == null ? "—" : `Rs ${Math.round(n).toLocaleString("en-PK")}`;
const ct = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-PK"));

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  advance_paid: "Advance paid",
  dispatched: "Dispatched",
  completed: "Complete",
  cancelled: "Cancelled",
  billed: "Billed",
};

export async function MachineryOverview({ branchId }: { branchId: string | null }) {
  const service = createServiceClient();
  const today = aajKaKhana();

  try {
    const [activeBookingsRes, todayDispatchRes, pendingBillsRes, recentBookingsRes] = await Promise.all([
      service
        .from("machinery_bookings")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "advance_paid", "dispatched"]),
      service
        .from("machinery_bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "dispatched"),
      service
        .from("machinery_bills")
        .select("id, total_amount", { count: "exact" })
        .is("cancelled_at", null)
        .is("payment_received_at", null),
      service
        .from("machinery_bookings")
        .select("id, booking_number, status, booking_date, farmers(full_name), machinery_vendor_machines(machine_type, model)")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    const activeCount = activeBookingsRes.count ?? 0;
    const dispatchedCount = todayDispatchRes.count ?? 0;
    const pendingBillCount = pendingBillsRes.count ?? 0;
    const pendingBillAmount = (pendingBillsRes.data ?? []).reduce((s: number, r: any) => s + Number(r.total_amount ?? 0), 0);
    const recentBookings = recentBookingsRes.data ?? [];

    return (
      <div className="staff-desk-screen">
        <div className="staff-desk-top-grid">
          <section className="desk-card staff-desk-ledger">
            <div className="staff-desk-card-title">
              <span><Tractor /> Active Bookings</span>
              <span className="staff-desk-live">Machinery</span>
            </div>
            <div className="staff-desk-ledger-total">
              <strong>{ct(activeCount)}</strong>
              <span>Active + pending bookings</span>
            </div>
            <div className="staff-desk-ledger-split">
              <div><span>Dispatched</span><strong>{ct(dispatchedCount)}</strong></div>
              <div><span>Pending bills</span><strong>{ct(pendingBillCount)}</strong></div>
              <div><span>Bill amount</span><strong>{money(pendingBillAmount)}</strong></div>
            </div>
            <Link href="/admin/machinery-rental" className="mt-4 block text-[12px] text-brand-600 dark:text-brand-400">
              Machinery rental →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary">
            <h2><Calendar /> Status</h2>
            <div className="staff-desk-funnel">
              <div><strong>{ct(activeCount)}</strong><span>Active</span></div>
              <div><strong>{ct(dispatchedCount)}</strong><span>Dispatched</span></div>
              <div><strong>—</strong><span>Completed</span></div>
            </div>
            <Link href="/admin/machinery-rental/dashboard" className="mt-3 block text-[12px] text-brand-600 dark:text-brand-400">
              Dashboard →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary">
            <h2><Wallet /> Bill Collection</h2>
            <div className="staff-desk-health">
              <div><strong>{ct(pendingBillCount)}</strong><span>Pending</span></div>
              <div><strong>{money(pendingBillAmount)}</strong><span>Baaqi raqam</span></div>
              <div><strong>—</strong><span>Received</span></div>
            </div>
            <Link href="/admin/machinery-rental" className="mt-3 block text-[12px] text-brand-600 dark:text-brand-400">
              Bills dekhein →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary staff-desk-urgent">
            <h2><AlertTriangle /> Pending Bills</h2>
            {pendingBillCount > 0 ? (
              <>
                <div className="staff-desk-funnel">
                  <div><strong className="text-amber-600 dark:text-amber-400">{ct(pendingBillCount)}</strong><span>Bills pending</span></div>
                  <div><strong>{money(pendingBillAmount)}</strong><span>Total</span></div>
                </div>
                <Link href="/admin/machinery-rental" className="mt-3 block text-[12px] text-amber-600 dark:text-amber-400 font-medium">
                  Dekhein →
                </Link>
              </>
            ) : (
              <p className="flex items-center gap-1.5 mt-2 text-[12px] text-surface-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Koi pending bill nahi
              </p>
            )}
          </section>
        </div>

        {/* Recent Bookings */}
        <section className="desk-card">
          <div className="staff-desk-card-title">
            <span><Tractor /> Haal Ki Bookings</span>
            <Link href="/admin/machinery-rental" className="text-[11px] text-brand-600 dark:text-brand-400">Sab dekhein →</Link>
          </div>
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {recentBookings.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-surface-400">Koi booking nahi mili.</p>
            ) : (
              recentBookings.map((b: any) => {
                const farmer = Array.isArray(b.farmers) ? b.farmers[0] : b.farmers;
                const machine = Array.isArray(b.machinery_vendor_machines) ? b.machinery_vendor_machines[0] : b.machinery_vendor_machines;
                return (
                  <div key={b.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-surface-800 dark:text-surface-100">
                        {farmer?.full_name ?? "—"} · {machine?.machine_type ?? "—"}
                      </p>
                      <p className="text-[11px] text-surface-500">
                        #{b.booking_number ?? "—"} · {b.booking_date ?? "—"}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      b.status === "dispatched" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" :
                      b.status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" :
                      b.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300" :
                      "bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400"
                    }`}>
                      {STATUS_LABEL[b.status] ?? b.status}
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
        <p className="text-sm text-surface-500">Machinery ka data load nahi hua. Refresh karein.</p>
        <Link href="/admin/machinery-rental" className="mt-2 block text-sm text-brand-600">Machinery rental kholein →</Link>
      </div>
    );
  }
}
