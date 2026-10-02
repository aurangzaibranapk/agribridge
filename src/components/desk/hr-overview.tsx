import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { aajKaKhana } from "@/lib/utils/format";
import { Users, Clock, CheckCircle2, XCircle, AlertTriangle, UserPlus } from "lucide-react";

const ct = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-PK"));

export async function HROverview({ branchId }: { branchId: string | null }) {
  const service = createServiceClient();
  const today = aajKaKhana();

  try {
    let attQ = service
      .from("attendance_records")
      .select("id, status, profile_id, profiles(full_name, role)")
      .eq("attendance_date", today);
    if (branchId) attQ = attQ.eq("branch_id", branchId);

    const [attendanceRes, applicationsRes, totalStaffRes, recentAttendanceRes] = await Promise.all([
      attQ,
      service
        .from("job_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      (() => {
        let sq = service
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .neq("role", "owner")
          .neq("role", "super_admin");
        if (branchId) sq = sq.eq("branch_id", branchId);
        return sq;
      })(),
      (() => {
        let rq = service
          .from("attendance_records")
          .select("id, attendance_date, status, profiles(full_name, role)")
          .order("attendance_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(8);
        if (branchId) rq = rq.eq("branch_id", branchId);
        return rq;
      })(),
    ]);

    const attendance = attendanceRes.data ?? [];
    const presentCount = attendance.filter((a: any) => a.status === "present").length;
    const absentCount = attendance.filter((a: any) => a.status === "absent").length;
    const lateCount = attendance.filter((a: any) => a.status === "late").length;
    const halfDayCount = attendance.filter((a: any) => a.status === "half_day").length;
    const applicationCount = applicationsRes.count ?? 0;
    const totalStaff = totalStaffRes.count ?? 0;
    const recentAtt = recentAttendanceRes.data ?? [];
    const markedCount = attendance.length;

    return (
      <div className="staff-desk-screen">
        <div className="staff-desk-top-grid">
          <section className="desk-card staff-desk-ledger">
            <div className="staff-desk-card-title">
              <span><Users /> Aaj Ki Hazri</span>
              <span className="staff-desk-live">HR</span>
            </div>
            <div className="staff-desk-ledger-total">
              <strong>{ct(presentCount)}</strong>
              <span>Hazir — {today}</span>
            </div>
            <div className="staff-desk-ledger-split">
              <div><span>Ghaib</span><strong className={absentCount > 0 ? "text-red-600 dark:text-red-400" : undefined}>{ct(absentCount)}</strong></div>
              <div><span>Late</span><strong className={lateCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined}>{ct(lateCount)}</strong></div>
              <div><span>Half day</span><strong>{ct(halfDayCount)}</strong></div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[12px] text-surface-500">
              <span>{ct(markedCount)} of {ct(totalStaff)} staff marked today</span>
            </div>
            <Link href="/admin/hr/attendance-log" className="mt-2 block text-[12px] text-brand-600 dark:text-brand-400">
              Attendance log →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary">
            <h2><CheckCircle2 /> Hazri Summary</h2>
            <div className="staff-desk-funnel">
              <div><strong className="text-green-600 dark:text-green-400">{ct(presentCount)}</strong><span>Hazir</span></div>
              <div><strong className={absentCount > 0 ? "text-red-600 dark:text-red-400" : undefined}>{ct(absentCount)}</strong><span>Ghaib</span></div>
              <div><strong className={lateCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined}>{ct(lateCount)}</strong><span>Late</span></div>
            </div>
            <Link href="/admin/hr" className="mt-3 block text-[12px] text-brand-600 dark:text-brand-400">
              HR dashboard →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary">
            <h2><Users /> Staff</h2>
            <div className="staff-desk-health">
              <div><strong>{ct(totalStaff)}</strong><span>Total active</span></div>
              <div><strong>{ct(markedCount)}</strong><span>Marked today</span></div>
              <div><strong>{ct(totalStaff - markedCount)}</strong><span>Not marked</span></div>
            </div>
            <Link href="/admin/users" className="mt-3 block text-[12px] text-brand-600 dark:text-brand-400">
              Staff list →
            </Link>
          </section>

          <section className="desk-card staff-desk-summary staff-desk-urgent">
            <h2><UserPlus /> Applications</h2>
            {applicationCount > 0 ? (
              <>
                <div className="staff-desk-funnel">
                  <div><strong className="text-amber-600 dark:text-amber-400">{ct(applicationCount)}</strong><span>Pending</span></div>
                </div>
                <Link href="/admin/job-applications" className="mt-3 block text-[12px] text-amber-600 dark:text-amber-400 font-medium">
                  Applications dekhein →
                </Link>
              </>
            ) : (
              <p className="flex items-center gap-1.5 mt-2 text-[12px] text-surface-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Koi pending application nahi
              </p>
            )}
          </section>
        </div>

        {/* Recent Attendance */}
        <section className="desk-card">
          <div className="staff-desk-card-title">
            <span><Clock /> Haal Ki Hazri Records</span>
            <Link href="/admin/hr/attendance-log" className="text-[11px] text-brand-600 dark:text-brand-400">Sab dekhein →</Link>
          </div>
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {recentAtt.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-surface-400">Koi hazri record nahi mila.</p>
            ) : (
              recentAtt.map((a: any) => {
                const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
                return (
                  <div key={a.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-surface-800 dark:text-surface-100">
                        {profile?.full_name ?? "—"}
                      </p>
                      <p className="text-[11px] text-surface-500">{a.attendance_date} · {profile?.role ?? "—"}</p>
                    </div>
                    <span className={`shrink-0 flex items-center gap-1 text-[12px] font-medium ${
                      a.status === "present" ? "text-green-600 dark:text-green-400" :
                      a.status === "absent" ? "text-red-600 dark:text-red-400" :
                      a.status === "late" ? "text-amber-600 dark:text-amber-400" :
                      "text-surface-500"
                    }`}>
                      {a.status === "present" ? <CheckCircle2 className="h-3.5 w-3.5" /> : a.status === "absent" ? <XCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      {a.status}
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
        <p className="text-sm text-surface-500">HR ka data load nahi hua. Refresh karein.</p>
        <Link href="/admin/hr" className="mt-2 block text-sm text-brand-600">HR dashboard kholein →</Link>
      </div>
    );
  }
}
