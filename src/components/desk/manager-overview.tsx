import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { aajKaKhana } from "@/lib/utils/format";
import { BarChart3, Users, AlertTriangle, Wallet, CheckCircle2, Activity } from "lucide-react";

const money = (n: number | null | undefined) =>
  n == null ? "—" : `Rs ${Math.round(n).toLocaleString("en-PK")}`;
const ct = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-PK"));

export async function ManagerOverview({ branchId }: { branchId: string | null }) {
  const service = createServiceClient();
  const today = aajKaKhana();

  try {
    let salesQ = service
      .from("pos_sales")
      .select("id, total_amount", { count: "exact" })
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`)
      .neq("status", "voided");
    if (branchId) salesQ = salesQ.eq("branch_id", branchId);

    let attQ = service
      .from("attendance_records")
      .select("id, status")
      .eq("attendance_date", today);
    if (branchId) attQ = attQ.eq("branch_id", branchId);

    let expQ = service
      .from("company_expense_requests")
      .select("id, amount, party_name, created_at", { count: "exact" })
      .in("status", ["pending"]);
    if (branchId) expQ = expQ.eq("branch_id", branchId);

    let transferQ = service
      .from("stock_transfers")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    const [salesRes, attRes, expRes, transferRes, recentSalesRes] = await Promise.all([
      salesQ,
      attQ,
      expQ,
      transferQ,
      (() => {
        let rq = service
          .from("pos_sales")
          .select("id, total_amount, status, created_at")
          .gte("created_at", `${today}T00:00:00`)
          .lte("created_at", `${today}T23:59:59`)
          .neq("status", "voided")
          .order("created_at", { ascending: false })
          .limit(6);
        if (branchId) rq = rq.eq("branch_id", branchId);
        return rq;
      })(),
    ]);

    const todaySales = salesRes.data ?? [];
    const totalSales = todaySales.reduce((s, r: any) => s + Number(r.total_amount ?? 0), 0);
    const saleCount = salesRes.count ?? 0;

    const attendance = attRes.data ?? [];
    const presentCount = attendance.filter((a: any) => a.status === "present").length;
    const absentCount = attendance.filter((a: any) => a.status === "absent").length;

    const pendingExpCount = expRes.count ?? 0;
    const pendingExpAmount = (expRes.data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);

    const pendingTransferCount = transferRes.count ?? 0;
    const recentSales = recentSalesRes.data ?? [];

    return (
      <div className="staff-desk-screen">
        <div className="staff-desk-top-grid">
          <section className="desk-card staff-desk-ledger">
            <div className="staff-desk-card-title">
              <span><BarChart3 /> Aaj Ki Bikri</span>
              <span className="staff-desk-live">Branch</span>
            </div>
            <div className="staff-desk-ledger-total">
              <strong>{money(totalSales)}</strong>
              <span>Total POS sale — {today}</span>
            </div>
            <div className="staff-desk-ledger-split">
              <div><span>Transactions</span><strong>{ct(saleCount)}</strong></div>
              <div><span>Hazir staff</span><strong>{ct(presentCount)}</strong></div>
              <div><span>Ghaib staff</span><strong className={absentCount > 0 ? "text-red-600 dark:text-red-400" : undefined}>{ct(absentCount)}</strong></div>
            </div>
            <Link href="/admin/pos" className="mt-4 block text-[12px] text-brand-600 dark:text-brand-400">
              POS kholein →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary">
            <h2><Users /> Staff Status</h2>
            <div className="staff-desk-funnel">
              <div><strong className="text-green-600 dark:text-green-400">{ct(presentCount)}</strong><span>Hazir</span></div>
              <div><strong className={absentCount > 0 ? "text-red-600 dark:text-red-400" : undefined}>{ct(absentCount)}</strong><span>Ghaib</span></div>
              <div><strong>{ct(attendance.length)}</strong><span>Marked</span></div>
            </div>
            <Link href="/admin/hr/attendance-log" className="mt-3 block text-[12px] text-brand-600 dark:text-brand-400">
              Hazri log →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary">
            <h2><Wallet /> Pending Kharche</h2>
            <div className="staff-desk-health">
              <div><strong>{ct(pendingExpCount)}</strong><span>Requests</span></div>
              <div><strong>{money(pendingExpAmount)}</strong><span>Total raqam</span></div>
              <div><strong>{ct(pendingTransferCount)}</strong><span>Transfers</span></div>
            </div>
            <Link href="/admin/submissions" className="mt-3 block text-[12px] text-brand-600 dark:text-brand-400">
              Submissions →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary staff-desk-urgent">
            <h2><AlertTriangle /> Approvals Needed</h2>
            {(pendingExpCount + pendingTransferCount) > 0 ? (
              <>
                <div className="staff-desk-funnel">
                  <div><strong className="text-amber-600 dark:text-amber-400">{ct(pendingExpCount)}</strong><span>Kharche</span></div>
                  <div><strong className="text-amber-600 dark:text-amber-400">{ct(pendingTransferCount)}</strong><span>Transfers</span></div>
                </div>
                <Link href="/admin/submissions" className="mt-3 block text-[12px] text-amber-600 dark:text-amber-400 font-medium">
                  Approvals dekhein →
                </Link>
              </>
            ) : (
              <p className="flex items-center gap-1.5 mt-2 text-[12px] text-surface-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Koi pending approval nahi
              </p>
            )}
          </section>
        </div>

        {/* Recent Sales */}
        <section className="desk-card">
          <div className="staff-desk-card-title">
            <span><Activity /> Aaj Ki Haal Ki Sales</span>
            <Link href="/admin/pos" className="text-[11px] text-brand-600 dark:text-brand-400">POS kholein →</Link>
          </div>
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {recentSales.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-surface-400">Aaj abhi tak koi sale nahi.</p>
            ) : (
              recentSales.map((s: any) => {
                const time = new Intl.DateTimeFormat("en-GB", {
                  timeZone: "Asia/Karachi",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                }).format(new Date(s.created_at));
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-surface-800 dark:text-surface-100">POS Sale</p>
                      <p className="text-[11px] text-surface-500">{time} · {s.status}</p>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-surface-900 dark:text-surface-100">
                      {money(Number(s.total_amount ?? 0))}
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
        <p className="text-sm text-surface-500">Manager dashboard ka data load nahi hua. Refresh karein.</p>
        <Link href="/admin/command-center" className="mt-2 block text-sm text-brand-600">Command center kholein →</Link>
      </div>
    );
  }
}
