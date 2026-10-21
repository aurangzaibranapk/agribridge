/**
 * HR Dashboard -- "Tankhwah" (Salary Analysis) tab. Khalis hisaab (pure).
 * Malik ki farmaish 21 Oct 2026: doosri reference tasveer ke mutabiq, Rs mein.
 * Tankhwah ka data hassas: sirf Owner/HR/Admin (page par role check).
 */
import { addMonths, monthStart, monthEnd, addDays, type Kpi } from "@/lib/hr-kpi/core";

export interface SalStaff {
  profile_id: string;
  employee_code: string | null;
  name: string;
  department_key: string | null;
  designation: string | null;
  hire_date: string | null;
  exit_date: string | null;
  basic_salary: number | null;
  is_active: boolean | null;
}
export interface SalStructure { profile_id: string; basic: number; effective_from: string }
export interface SalRun { month: string; status: string; paid_at: string | null; gross: number; heads: number }
export interface SalPayment { profile_id: string; month: string; net: number; status: string; paid_date: string | null }
export interface SalLeave { profile_id: string; from_date: string; to_date: string }
export interface SalReview { profile_id: string; period_month: string; rating: string }

export interface SalaryRaw {
  today: string;
  dueDay: number;
  staff: SalStaff[];
  departments: { key: string; label: string }[];
  structures: SalStructure[]; // sirf approved
  runs: SalRun[];
  payments: SalPayment[];
  leaves: SalLeave[]; // approved
  reviews: SalReview[]; // approved
}

export interface SalFilters { dept: string | null; status: string | null; desig: string | null; year: string | null }
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || null;
export function parseSalFilters(sp: Record<string, string | string[] | undefined> | undefined): SalFilters {
  const status = one(sp?.s_status);
  const year = one(sp?.s_year);
  return {
    dept: one(sp?.s_dept),
    status: status && ["active", "on_leave", "terminated"].includes(status) ? status : null,
    desig: one(sp?.s_desig),
    year: year && /^\d{4}$/.test(year) ? year : null,
  };
}

/** Aaj ki tankhwah: sab se naya approved structure (effective_from <= aaj), warna HR file ki basic. */
export function currentSalary(s: SalStaff, structures: SalStructure[], today: string): number | null {
  const xs = structures.filter((x) => x.profile_id === s.profile_id && x.effective_from <= today).sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  if (xs[0]) return Number(xs[0].basic);
  return s.basic_salary != null && Number(s.basic_salary) > 0 ? Number(s.basic_salary) : null;
}

export type EmpStatus = "active" | "on_leave" | "terminated";
export function empStatus(s: SalStaff, leaves: SalLeave[], today: string): EmpStatus {
  if (s.exit_date && s.exit_date <= today) return "terminated";
  if (!s.exit_date && s.is_active === false) return "terminated";
  if (leaves.some((l) => l.profile_id === s.profile_id && l.from_date <= today && l.to_date >= today)) return "on_leave";
  return "active";
}

/** Mahina M ki due date: agle mahine ki dueDay. */
export function dueDate(month: string, dueDay: number): string {
  return addDays(addMonths(monthStart(month), 1), Math.min(Math.max(dueDay, 1), 28) - 1);
}
const pktDate = (ts: string) => new Date(Date.parse(ts) + 5 * 3600000).toISOString().slice(0, 10);

/** On-time %: diye gaye mahinon/slips mein se kitne due date tak. Payroll run ho to wo, warna salary_payments. */
export function onTimePct(raw: SalaryRaw, months: string[]): number | null {
  let total = 0;
  let onTime = 0;
  for (const m of months) {
    const due = dueDate(m, raw.dueDay);
    const run = raw.runs.find((r) => r.month === m && r.status === "paid" && r.paid_at);
    if (run) {
      total += 1;
      if (pktDate(run.paid_at!) <= due) onTime += 1;
      continue;
    }
    for (const p of raw.payments.filter((x) => x.month === m && x.status === "paid" && x.paid_date)) {
      total += 1;
      if (p.paid_date! <= due) onTime += 1;
    }
  }
  return total ? Math.round((onTime / total) * 1000) / 10 : null;
}

/** Mahine ka payroll kharcha: run (draft/cancelled ke ilawa) ka gross; warna paid salary_payments. */
export function payrollCost(raw: SalaryRaw, month: string): number | null {
  const run = raw.runs.filter((r) => r.month === month && !["draft", "cancelled"].includes(r.status));
  if (run.length) return run.reduce((a, r) => a + r.gross, 0);
  const ps = raw.payments.filter((p) => p.month === month);
  return ps.length ? ps.reduce((a, p) => a + p.net, 0) : null;
}

const RATING_NUM: Record<string, number> = { excellent: 5, good: 4, satisfactory: 3, needs_improvement: 2, poor: 1 };

function kpi(value: number | null, prev: number | null, unit: Kpi["unit"]): Kpi {
  let change: number | null = null;
  if (value != null && prev != null) change = unit === "count" ? (prev === 0 ? (value === 0 ? 0 : null) : ((value - prev) / prev) * 100) : value - prev;
  return { value, prev, change, unit };
}
const emp = (s: SalStaff, d: string) => (!s.hire_date || s.hire_date <= d) && (!s.exit_date || s.exit_date >= d) && !(s.exit_date == null && s.is_active === false);

export const SAL_BUCKETS = [
  { label: "<25K", min: 0, max: 25000 },
  { label: "25K-35K", min: 25000, max: 35000 },
  { label: "35K-50K", min: 35000, max: 50000 },
  { label: "50K-75K", min: 50000, max: 75000 },
  { label: "75K-100K", min: 75000, max: 100000 },
  { label: ">100K", min: 100000, max: Infinity },
];

export interface SalaryDashboard {
  kpis: { employees: Kpi; payroll: Kpi; avgSalary: Kpi; onTime: Kpi; newHires: Kpi; attrition: Kpi };
  trend: { month: string; label: string; cost: number | null; headcount: number }[];
  byDept: { key: string; label: string; avg: number; count: number }[];
  headDept: { key: string; label: string; count: number }[];
  table: { id: string; code: string; name: string; dept: string; desig: string; salary: number | null; join: string | null; status: EmpStatus }[];
  slicers: { depts: { key: string; label: string }[]; desigs: string[]; years: string[] };
  histogram: { label: string; count: number }[];
  scatter: { name: string; rating: number; salary: number }[];
  r2: number | null;
  missingSalary: number;
  dueDay: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function buildSalary(raw: SalaryRaw, f: SalFilters): SalaryDashboard {
  const t = raw.today;
  const thisM = monthStart(t);
  const lastM = addMonths(thisM, -1);
  const prevEnd = monthEnd(lastM);
  const dl = new Map(raw.departments.map((d) => [d.key, d.label]));
  const deptName = (k: string | null) => (k ? dl.get(k) ?? k : "Baghair department");

  const active = raw.staff.filter((s) => emp(s, t));
  const activePrev = raw.staff.filter((s) => emp(s, prevEnd));
  const sal = (s: SalStaff, d: string) => currentSalary(s, raw.structures, d);
  const avgOf = (xs: SalStaff[], d: string) => {
    const v = xs.map((s) => sal(s, d)).filter((x): x is number => x != null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  const hires = (m: string) => raw.staff.filter((s) => s.hire_date && s.hire_date >= m && s.hire_date <= monthEnd(m)).length;
  const attr = (m: string) => {
    const avg = (raw.staff.filter((s) => emp(s, m)).length + raw.staff.filter((s) => emp(s, monthEnd(m) < t ? monthEnd(m) : t)).length) / 2;
    if (!avg) return null;
    const ex = raw.staff.filter((s) => s.exit_date && s.exit_date >= m && s.exit_date <= monthEnd(m)).length;
    return Math.round((ex / avg) * 1000) / 10;
  };
  // Payroll cost: aakhri mahina jis ka hisaab bana (is mahine ka run aksar baad mein banta hai).
  const costThis = payrollCost(raw, lastM);
  const costPrev = payrollCost(raw, addMonths(lastM, -1));

  const trend = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(thisM, i - 5);
    const end = i === 5 ? t : monthEnd(m);
    return { month: m, label: MONTHS[Number(m.slice(5, 7)) - 1], cost: payrollCost(raw, m), headcount: raw.staff.filter((s) => emp(s, end)).length };
  });

  const deptMap = new Map<string, { sum: number; n: number; count: number }>();
  for (const s of active) {
    const k = s.department_key ?? "none";
    const cur = deptMap.get(k) ?? { sum: 0, n: 0, count: 0 };
    cur.count += 1;
    const v = sal(s, t);
    if (v != null) { cur.sum += v; cur.n += 1; }
    deptMap.set(k, cur);
  }
  const byDept = [...deptMap.entries()].filter(([, v]) => v.n).map(([k, v]) => ({ key: k, label: deptName(k === "none" ? null : k), avg: Math.round(v.sum / v.n), count: v.n })).sort((a, b) => b.avg - a.avg);
  const headDept = [...deptMap.entries()].map(([k, v]) => ({ key: k, label: deptName(k === "none" ? null : k), count: v.count })).sort((a, b) => b.count - a.count);

  const allRows = raw.staff.map((s) => ({
    id: s.profile_id,
    code: s.employee_code ?? "—",
    name: s.name,
    deptKey: s.department_key,
    dept: deptName(s.department_key),
    desig: s.designation ?? "—",
    salary: sal(s, t),
    join: s.hire_date,
    status: empStatus(s, raw.leaves, t),
  }));
  const table = allRows
    .filter((r) => (!f.dept || r.deptKey === f.dept) && (!f.status || r.status === f.status) && (!f.desig || r.desig === f.desig) && (!f.year || (r.join ?? "").startsWith(f.year)))
    .sort((a, b) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name))
    .map(({ deptKey: _d, ...r }) => r);

  const salaries = active.map((s) => sal(s, t)).filter((x): x is number => x != null);
  const histogram = SAL_BUCKETS.map((b) => ({ label: b.label, count: salaries.filter((v) => v >= b.min && v < b.max).length }));

  // Scatter: har mulazim ka sab se naya approved review vs tankhwah.
  const latest = new Map<string, SalReview>();
  for (const r of raw.reviews) {
    const cur = latest.get(r.profile_id);
    if (!cur || r.period_month > cur.period_month) latest.set(r.profile_id, r);
  }
  const scatter = active
    .map((s) => ({ s, r: latest.get(s.profile_id), v: sal(s, t) }))
    .filter((x) => x.r && x.v != null && RATING_NUM[x.r.rating])
    .map((x) => ({ name: x.s.name, rating: RATING_NUM[x.r!.rating], salary: x.v! }));

  return {
    kpis: {
      employees: kpi(active.length, activePrev.length, "count"),
      payroll: kpi(costThis, costPrev, "count"),
      avgSalary: kpi(avgOf(active, t), avgOf(activePrev, prevEnd), "count"),
      onTime: kpi(onTimePct(raw, [addMonths(thisM, -2), lastM].filter(Boolean)), onTimePct(raw, [addMonths(thisM, -4), addMonths(thisM, -3)]), "pct"),
      newHires: kpi(hires(thisM), hires(lastM), "count"),
      attrition: kpi(attr(thisM), attr(lastM), "pct"),
    },
    trend,
    byDept,
    headDept,
    table,
    slicers: {
      depts: [...new Set(raw.staff.map((s) => s.department_key).filter(Boolean) as string[])].map((k) => ({ key: k, label: deptName(k) })),
      desigs: [...new Set(raw.staff.map((s) => s.designation).filter(Boolean) as string[])].sort(),
      years: [...new Set(raw.staff.map((s) => s.hire_date?.slice(0, 4)).filter(Boolean) as string[])].sort(),
    },
    histogram,
    scatter,
    r2: rSquared(scatter.map((p) => p.rating), scatter.map((p) => p.salary)),
    missingSalary: active.length - salaries.length,
    dueDay: raw.dueDay,
  };
}

/** R² (linear) -- kam se kam 3 nuqte, warna null. */
export function rSquared(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 3) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  if (!sxx || !syy) return null;
  return Math.round(((sxy * sxy) / (sxx * syy)) * 100) / 100;
}

export const SALARY_FORMULAS = [
  { kpi: "Average Salary", formula: "AVERAGE(har active mulazim ki tankhwah)", desc: "Naya manzoor salary structure; warna HR file ki basic" },
  { kpi: "Total Payroll Cost", formula: "SUM(payroll lines ka gross)", desc: "Pichle mukammal mahine ka payroll run" },
  { kpi: "Headcount", formula: "COUNT(active staff)", desc: "Joining ho chuki, exit nahi" },
  { kpi: "Attrition Rate", formula: "(Chhorne wale / Ausat staff) × 100", desc: "Mahine ke hisaab se" },
  { kpi: "On-Time Payment %", formula: "(Due date tak di gayi / Kul di gayi) × 100", desc: "Due = agle mahine ki muqarrar tareekh" },
  { kpi: "New Hire Count", formula: "COUNT(joining date is mahine)", desc: "HR file ki joining date" },
  { kpi: "Department Avg Salary", formula: "AVERAGE(department ki tankhwahen)", desc: "Sirf jin ki tankhwah darj hai" },
  { kpi: "Payroll Growth %", formula: "((Is mahina − Pichla) / Pichla) × 100", desc: "Payroll cost card ka farq" },
];
