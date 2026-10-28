import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { type HrFilters, type HrRaw, previousPeriod, addMonths, monthStart, addDays } from "@/lib/hr-kpi/core";

/**
 * HR KPI dashboard ka data. Page pehle role check karta hai (hr/admin/owner/super_admin);
 * phir yahan sirf PARHNA hota hai. Pulse sirf ikattha RPC se (user ke session se, gumnaam).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any; rpc: (f: string, a: Record<string, unknown>) => any };

async function loadApplications(db: Db, earliest: string) {
  const filter = `created_at.gte.${pktStartIso(earliest)},hired_at.gte.${pktStartIso(earliest)}`;
  const withGender = await db.from("job_applications").select("created_at,screened_at,interview_at,offer_at,hired_at,gender").or(filter).limit(20000);
  if (!withGender.error) return withGender.data ?? [];
  if (!/gender/i.test(String(withGender.error.message ?? withGender.error))) return [];
  const plain = await db.from("job_applications").select("created_at,screened_at,interview_at,offer_at,hired_at").or(filter).limit(20000);
  return plain.data ?? [];
}

const PKT = 5 * 3600000;
const pktStartIso = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - PKT).toISOString();
const pktMonth = (ts: string) => new Date(Date.parse(ts) + PKT).toISOString().slice(0, 7) + "-01";

export async function loadHrRaw(f: HrFilters, today: string): Promise<HrRaw> {
  const db = createServiceClient() as unknown as Db;
  const user = createClient() as unknown as Db;
  const prev = previousPeriod(f);
  // Trend 6 mahine + pichla arsa -- sab se pehli tareekh.
  const earliest = [prev.from, addMonths(monthStart(f.to), -5)].sort()[0];
  const fromIso = pktStartIso(f.from);
  const toIso = pktStartIso(addDays(f.to, 1));

  const [staffQ, profQ, deptQ, attQ, appQ, trQ, revQ, pulseQ, tgQ, posQ, shQ, payQ, qQ, advQ] = await Promise.all([
    db.from("staff_details").select("profile_id,department_key,branch_id,employment_type,gender,hire_date,exit_date,exit_reason,is_active"),
    db.from("profiles").select("id,full_name"),
    db.from("departments").select("key,label").order("sort_order"),
    db.from("attendance_records").select("profile_id,attendance_date,status,late_minutes").gte("attendance_date", earliest).lte("attendance_date", f.to).limit(20000),
    loadApplications(db, earliest),
    db.from("hr_training_records").select("profile_id,training_type,training_date,hours,cost").gte("training_date", earliest).lte("training_date", f.to),
    db.from("hr_performance_reviews").select("profile_id,period_month,rating,status").gte("period_month", monthStart(earliest)).lte("period_month", f.to),
    user.rpc("fn_hr_pulse_summary", { p_from: earliest, p_to: f.to }),
    db.from("hr_department_targets").select("department_key,period_month,target_amount,actual_manual,status").gte("period_month", monthStart(f.from)).lte("period_month", f.to),
    db.from("pos_sales").select("total_amount,created_at,created_by").neq("status", "returned").gte("created_at", pktStartIso(monthStart(f.from))).lt("created_at", toIso).limit(50000),
    db.from("pos_shifts").select("staff_id,status,difference,opened_at").gte("opened_at", fromIso).lt("opened_at", toIso),
    db.from("payroll_runs").select("pay_year,pay_month,status,payroll_lines(net)").gte("pay_year", Number(f.from.slice(0, 4))).lte("pay_year", Number(f.to.slice(0, 4))),
    db.from("v_qist_plan_summary").select("outstanding,overdue_count,status").eq("party_type", "staff"),
    db.from("staff_advances").select("id", { count: "exact", head: true }).in("status", ["pending", "requested", "approved"]),
  ]);

  const names = new Map(((profQ.data ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "—"]));
  const staff = ((staffQ.data ?? []) as Omit<HrRaw["staff"][number], "name">[]).map((s) => ({ ...s, name: names.get(s.profile_id) ?? "—" }));

  // POS: mahana (target ke liye) aur staff-wise (sirf filter range).
  const pos = (posQ.data ?? []) as { total_amount: number | null; created_at: string; created_by: string | null }[];
  const byMonth = new Map<string, number>();
  const byStaff = new Map<string, { amount: number; bills: number }>();
  for (const p of pos) {
    const m = pktMonth(p.created_at);
    byMonth.set(m, (byMonth.get(m) ?? 0) + Number(p.total_amount ?? 0));
    if (p.created_at >= fromIso) {
      const k = p.created_by ?? "none";
      const cur = byStaff.get(k) ?? { amount: 0, bills: 0 };
      cur.amount += Number(p.total_amount ?? 0);
      cur.bills += 1;
      byStaff.set(k, cur);
    }
  }
  const inPeriod = (y: number, m: number) => {
    const d = `${y}-${String(m).padStart(2, "0")}-01`;
    return d >= monthStart(f.from) && d <= f.to;
  };

  return {
    today,
    staff,
    departments: ((deptQ.data ?? []) as { key: string; label: string }[]),
    attendance: (attQ.data ?? []) as HrRaw["attendance"],
    applications: (appQ ?? []) as HrRaw["applications"],
    training: (trQ.data ?? []) as HrRaw["training"],
    reviews: (revQ.data ?? []) as HrRaw["reviews"],
    pulse: ((pulseQ.data ?? []) as { period_month: string; responses: number; avg_score: number; engaged: number }[]).map((p) => ({ ...p, avg_score: Number(p.avg_score) })),
    targets: (tgQ.data ?? []) as HrRaw["targets"],
    posSalesByMonth: [...byMonth.entries()].map(([month, amount]) => ({ month, amount })),
    staffSales: [...byStaff.entries()]
      .map(([id, v]) => ({ profile_id: id === "none" ? null : id, name: id === "none" ? "Naam darj nahi" : names.get(id) ?? "—", ...v }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8),
    shifts: ((shQ.data ?? []) as { staff_id: string | null; status: string; difference: number | null }[]).map((s) => ({ staff_name: (s.staff_id && names.get(s.staff_id)) || "—", status: s.status, difference: s.difference })),
    payroll: ((payQ.data ?? []) as { pay_year: number; pay_month: number; status: string; payroll_lines: { net: number | null }[] | null }[])
      .filter((r) => inPeriod(r.pay_year, r.pay_month))
      .map((r) => ({ month: `${r.pay_year}-${String(r.pay_month).padStart(2, "0")}-01`, status: r.status, net: (r.payroll_lines ?? []).reduce((a, l) => a + Number(l.net ?? 0), 0) })),
    qist: ((qQ.data ?? []) as { outstanding: number | null; overdue_count: number | null; status: string }[])
      .filter((q) => !["closed", "cancelled", "completed", "written_off"].includes(q.status))
      .map((q) => ({ outstanding: Number(q.outstanding ?? 0), overdue_count: Number(q.overdue_count ?? 0) })),
    advancesPending: Number(advQ.count ?? 0),
  };
}

/** Tankhwah tab ka data. Sirf Owner/HR/Admin (page par check), sirf parhna. */
export async function loadSalaryRaw(today: string): Promise<import("@/lib/hr-kpi/salary").SalaryRaw> {
  const db = createServiceClient() as unknown as Db;
  const since = addMonths(monthStart(today), -8);
  const [st, pr, dp, ss, runs, pays, lv, rv, set] = await Promise.all([
    db.from("staff_details").select("profile_id,employee_code,department_key,designation,hire_date,exit_date,basic_salary,is_active"),
    db.from("profiles").select("id,full_name"),
    db.from("departments").select("key,label"),
    db.from("staff_salary_structures").select("profile_id,basic,effective_from").eq("status", "approved"),
    db.from("payroll_runs").select("pay_year,pay_month,status,paid_at,payroll_lines(gross)").gte("pay_year", Number(since.slice(0, 4))),
    db.from("salary_payments").select("profile_id,pay_year,pay_month,net_salary,status,paid_date").gte("pay_year", Number(since.slice(0, 4))),
    db.from("leave_requests").select("profile_id,from_date,to_date").eq("status", "approved").gte("to_date", today),
    db.from("hr_performance_reviews").select("profile_id,period_month,rating").eq("status", "approved"),
    db.from("hr_payroll_settings").select("salary_due_day").eq("id", 1).maybeSingle(),
  ]);
  const names = new Map(((pr.data ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name ?? "—"]));
  const m = (y: number, mo: number) => `${y}-${String(mo).padStart(2, "0")}-01`;
  return {
    today,
    dueDay: Number(set.data?.salary_due_day ?? 10),
    staff: ((st.data ?? []) as Omit<import("@/lib/hr-kpi/salary").SalStaff, "name">[]).map((s) => ({ ...s, name: names.get(s.profile_id) ?? "—" })),
    departments: (dp.data ?? []) as { key: string; label: string }[],
    structures: ((ss.data ?? []) as { profile_id: string; basic: number; effective_from: string }[]).map((x) => ({ ...x, basic: Number(x.basic) })),
    runs: ((runs.data ?? []) as { pay_year: number; pay_month: number; status: string; paid_at: string | null; payroll_lines: { gross: number | null }[] | null }[]).map((r) => ({
      month: m(r.pay_year, r.pay_month), status: r.status, paid_at: r.paid_at,
      gross: (r.payroll_lines ?? []).reduce((a, l) => a + Number(l.gross ?? 0), 0), heads: (r.payroll_lines ?? []).length,
    })),
    payments: ((pays.data ?? []) as { profile_id: string; pay_year: number; pay_month: number; net_salary: number; status: string; paid_date: string | null }[]).map((p) => ({
      profile_id: p.profile_id, month: m(p.pay_year, p.pay_month), net: Number(p.net_salary ?? 0), status: p.status, paid_date: p.paid_date,
    })),
    leaves: (lv.data ?? []) as { profile_id: string; from_date: string; to_date: string }[],
    reviews: (rv.data ?? []) as { profile_id: string; period_month: string; rating: string }[],
  };
}
