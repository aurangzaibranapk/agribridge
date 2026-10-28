/**
 * HR KPI Dashboard -- khalis hisaab (pure). Database se parhna `load.ts` mein.
 * Malik ki manzoori 21 Oct 2026: reference "HR KPI Dashboard" same to same.
 * Usool: data na ho to 0 / "—", kabhi farzi adad nahi.
 */

export const TRAINING_TYPES = ["technical", "soft_skills", "leadership", "compliance"] as const;
export type TrainingType = (typeof TRAINING_TYPES)[number];
export const TRAINING_LABEL: Record<TrainingType, string> = { technical: "Technical", soft_skills: "Soft Skills", leadership: "Leadership", compliance: "Compliance" };

export const RATINGS = ["excellent", "good", "satisfactory", "needs_improvement", "poor"] as const;
export type Rating = (typeof RATINGS)[number];
export const RATING_LABEL: Record<Rating, string> = { excellent: "Excellent", good: "Good", satisfactory: "Satisfactory", needs_improvement: "Needs Improvement", poor: "Poor" };

export const EXIT_REASONS = ["better_opportunity", "personal", "higher_studies", "work_life_balance", "salary", "relocation", "terminated", "other"] as const;
export const EXIT_REASON_LABEL: Record<string, string> = {
  better_opportunity: "Better Opportunity", personal: "Personal Reasons", higher_studies: "Higher Studies", work_life_balance: "Work Life Balance",
  salary: "Salary", relocation: "Relocation", terminated: "Terminated", other: "Others",
};

export const EMPLOYMENT_TYPES = ["permanent", "contract", "daily_wage", "intern"] as const;
export const GENDERS = ["male", "female", "other"] as const;

/** Funnel ke marhale -> job_applications.status (mojooda workflow). */
export const STAGE_STATUS = { applied: "pending", screened: "eligible", interview: "interview_scheduled", offer: "offered", hired: "joined", rejected: "rejected" } as const;
export type Stage = keyof typeof STAGE_STATUS;

const DAY = 86400000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function addDays(d: string, n: number): string {
  return new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}
export function monthStart(d: string): string {
  return `${d.slice(0, 7)}-01`;
}
export function addMonths(d: string, n: number): string {
  const [y, m] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}
export function monthEnd(d: string): string {
  return addDays(addMonths(monthStart(d), 1), -1);
}
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

export interface HrFilters {
  from: string;
  to: string;
  department: string | null;
  branchId: string | null;
  employmentType: string | null;
}

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/** Default: is mahine ki 1 tareekh se aaj tak. */
export function parseHrFilters(sp: Record<string, string | string[] | undefined> | undefined, today: string, depts: string[], branches: string[]): HrFilters {
  let to = one(sp?.to);
  let from = one(sp?.from);
  if (!to || !DATE_RE.test(to) || to > today) to = today;
  if (!from || !DATE_RE.test(from) || from > to) from = monthStart(to);
  if (daysBetween(from, to) > 731) from = addDays(to, -731);
  const dep = one(sp?.dept);
  const br = one(sp?.branch);
  const et = one(sp?.etype);
  return {
    from,
    to,
    department: dep && depts.includes(dep) ? dep : null,
    branchId: br && branches.includes(br) ? br : null,
    employmentType: et && (EMPLOYMENT_TYPES as readonly string[]).includes(et) ? et : null,
  };
}

/** Pichla barabar arsa (vs last period). */
export function previousPeriod(f: { from: string; to: string }): { from: string; to: string } {
  const len = daysBetween(f.from, f.to) + 1;
  return { from: addDays(f.from, -len), to: addDays(f.from, -1) };
}

export interface StaffRow {
  profile_id: string;
  name: string;
  department_key: string | null;
  branch_id: string | null;
  employment_type: string | null;
  gender: string | null;
  hire_date: string | null;
  exit_date: string | null;
  exit_reason: string | null;
  is_active: boolean | null;
}
export interface AttendanceRow { profile_id: string; attendance_date: string; status: string | null; late_minutes: number | null }
export interface ApplicationRow {
  created_at: string;
  screened_at: string | null;
  interview_at: string | null;
  offer_at: string | null;
  hired_at: string | null;
  /** Applicant ka gender. Staff diversity is se alag hai. Column na ho to khali. */
  gender?: string | null;
}
export interface TrainingRow { profile_id: string; training_type: string; training_date: string; hours: number; cost: number }
export interface ReviewRow { profile_id: string; period_month: string; rating: string; status: string }
export interface PulseRow { period_month: string; responses: number; avg_score: number; engaged: number }
export interface TargetRow { department_key: string; period_month: string; target_amount: number; actual_manual: number | null; status: string }
export interface MonthSales { month: string; amount: number }
export interface StaffSale { profile_id: string | null; name: string; amount: number; bills: number }
export interface ShiftRow { staff_name: string; status: string; difference: number | null }
export interface PayrollRow { month: string; status: string; net: number }
export interface QistRow { outstanding: number; overdue_count: number }

export interface HrRaw {
  today: string;
  staff: StaffRow[];
  departments: { key: string; label: string }[];
  attendance: AttendanceRow[]; // from prev.from .. to
  applications: ApplicationRow[]; // created or hired since prev.from
  training: TrainingRow[];
  reviews: ReviewRow[];
  pulse: PulseRow[]; // monthly aggregate, >=3 responses only
  targets: TargetRow[];
  posSalesByMonth: MonthSales[];
  staffSales: StaffSale[];
  shifts: ShiftRow[];
  payroll: PayrollRow[];
  qist: QistRow[];
  advancesPending: number;
}

export interface Kpi { value: number | null; prev: number | null; change: number | null; unit: "count" | "pct" | "days" }

function kpi(value: number | null, prev: number | null, unit: Kpi["unit"]): Kpi {
  let change: number | null = null;
  if (value != null && prev != null) {
    if (unit === "count") change = prev === 0 ? (value === 0 ? 0 : null) : ((value - prev) / prev) * 100;
    else change = value - prev; // pct/days: farq points/din mein
  }
  return { value, prev, change, unit };
}

const r1 = (x: number) => Math.round(x * 10) / 10;

export function filterStaff(staff: StaffRow[], f: HrFilters): StaffRow[] {
  return staff.filter(
    (s) => (!f.department || s.department_key === f.department) && (!f.branchId || s.branch_id === f.branchId) && (!f.employmentType || s.employment_type === f.employmentType),
  );
}

/** Kisi din par mulazim tha? (hire_date khali = pehle se, exit ke din tak shamil) */
export function employedOn(s: StaffRow, date: string): boolean {
  if (s.hire_date && s.hire_date > date) return false;
  if (s.exit_date && s.exit_date < date) return false;
  if (!s.exit_date && s.is_active === false) return false;
  return true;
}
export function headcountOn(staff: StaffRow[], date: string): number {
  return staff.filter((s) => employedOn(s, date)).length;
}
function exitsIn(staff: StaffRow[], from: string, to: string) {
  return staff.filter((s) => s.exit_date && s.exit_date >= from && s.exit_date <= to);
}
export function attritionRate(staff: StaffRow[], from: string, to: string): number | null {
  const avg = (headcountOn(staff, from) + headcountOn(staff, to)) / 2;
  if (avg <= 0) return null;
  return r1((exitsIn(staff, from, to).length / avg) * 100);
}

const PRESENT = new Set(["present", "late", "half_day"]);
export function attendanceStats(rows: AttendanceRow[], ids: Set<string>, from: string, to: string) {
  const xs = rows.filter((r) => ids.has(r.profile_id) && r.attendance_date >= from && r.attendance_date <= to);
  const present = xs.filter((r) => PRESENT.has(r.status ?? "")).length;
  const absent = xs.filter((r) => r.status === "absent").length;
  const late = xs.filter((r) => (r.late_minutes ?? 0) > 0 || r.status === "late").length;
  const base = present + absent;
  return { present, absent, late, rate: base ? r1((present / base) * 100) : null, absentRate: base ? r1((absent / base) * 100) : null };
}

const inRange = (ts: string | null, from: string, to: string) => !!ts && ts.slice(0, 10) >= from && ts.slice(0, 10) <= to;

export function funnel(apps: ApplicationRow[], from: string, to: string) {
  const xs = apps.filter((a) => inRange(a.created_at, from, to));
  const n = xs.length;
  const stages = [
    { key: "applications", label: "Applications", count: n },
    { key: "screened", label: "Screened", count: xs.filter((a) => a.screened_at).length },
    { key: "interviews", label: "Interviews", count: xs.filter((a) => a.interview_at).length },
    { key: "offers", label: "Offers", count: xs.filter((a) => a.offer_at).length },
    { key: "hired", label: "Hired", count: xs.filter((a) => a.hired_at).length },
  ];
  return stages.map((s) => ({ ...s, pct: n ? Math.round((s.count / n) * 100) : 0 }));
}

/** Is arse ki applications ka gender. Staff wali Gender Diversity card is se nahi banti. */
export function applicantGenderSplit(apps: ApplicationRow[], from: string, to: string) {
  const xs = apps.filter((a) => inRange(a.created_at, from, to));
  const known = new Set<string>(GENDERS);
  const g = countBy(xs, (a) => (a.gender && known.has(a.gender) ? a.gender : "none"));
  return [
    { key: "male", label: "Male", count: g.get("male") ?? 0 },
    { key: "female", label: "Female", count: g.get("female") ?? 0 },
    { key: "other", label: "Other", count: g.get("other") ?? 0 },
    { key: "none", label: "Darj nahi", count: g.get("none") ?? 0 },
  ];
}

/** Average time to hire: hired_at - created_at (din), jo is arse mein hire hue. */
export function timeToHire(apps: ApplicationRow[], from: string, to: string): number | null {
  const xs = apps.filter((a) => inRange(a.hired_at, from, to));
  if (!xs.length) return null;
  const d = xs.map((a) => Math.max(0, (Date.parse(a.hired_at!) - Date.parse(a.created_at)) / DAY));
  return r1(d.reduce((p, c) => p + c, 0) / d.length);
}

function monthsIn(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = monthStart(from); m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

export function engagement(pulse: PulseRow[], from: string, to: string) {
  const ms = new Set(monthsIn(from, to));
  const xs = pulse.filter((p) => ms.has(p.period_month));
  const resp = xs.reduce((a, p) => a + p.responses, 0);
  if (!resp) return { engagedPct: null as number | null, satisfactionPct: null as number | null, responses: 0 };
  const engaged = xs.reduce((a, p) => a + p.engaged, 0);
  const avg = xs.reduce((a, p) => a + p.avg_score * p.responses, 0) / resp;
  return { engagedPct: r1((engaged / resp) * 100), satisfactionPct: r1(((avg - 1) / 4) * 100), responses: resp };
}

function countBy<T>(xs: T[], key: (x: T) => string | null): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of xs) {
    const k = key(x) ?? "none";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export interface HrDashboard {
  filters: HrFilters;
  prev: { from: string; to: string };
  employeeCount: number;
  kpis: { total: Kpi; newHires: Kpi; attrition: Kpi; timeToHire: Kpi; engagement: Kpi };
  headcountTrend: { label: string; count: number }[];
  departments: { key: string; label: string; count: number }[];
  attendance: { rate: number | null; absentRate: number | null; prevRate: number | null; prevAbsent: number | null; present: number; absent: number; late: number };
  ratings: { key: Rating; label: string; count: number }[];
  gender: { key: string; label: string; count: number }[];
  funnel: { key: string; label: string; count: number; pct: number }[];
  applicantGender: { key: string; label: string; count: number }[];
  training: { key: TrainingType; label: string; hours: number; sessions: number; cost: number }[];
  satisfaction: { pct: number | null; prev: number | null; responses: number };
  attritionTrend: { label: string; rate: number | null }[];
  exitReasons: { key: string; label: string; count: number; pct: number }[];
  perfVsTarget: { key: string; label: string; target: number; actual: number; pct: number }[];
  extras: {
    staffSales: StaffSale[];
    shifts: { closed: number; open: number; short: number; diffTotal: number; byStaff: { name: string; shifts: number; diff: number }[] };
    salary: { due: number; paid: number; pending: number; runs: number };
    qist: { plans: number; outstanding: number; overdue: number; advancesPending: number };
  };
  insights: string[];
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mLabel = (m: string) => `${MONTH[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;

export function buildDashboard(raw: HrRaw, f: HrFilters): HrDashboard {
  const prev = previousPeriod(f);
  const staff = filterStaff(raw.staff, f);
  const ids = new Set(staff.map((s) => s.profile_id));
  const deptLabel = new Map(raw.departments.map((d) => [d.key, d.label]));

  const total = headcountOn(staff, f.to);
  const totalPrev = headcountOn(staff, prev.to);
  const hires = staff.filter((s) => s.hire_date && s.hire_date >= f.from && s.hire_date <= f.to).length;
  const hiresPrev = staff.filter((s) => s.hire_date && s.hire_date >= prev.from && s.hire_date <= prev.to).length;
  const att = attritionRate(staff, f.from, f.to);
  const attPrev = attritionRate(staff, prev.from, prev.to);
  const tth = timeToHire(raw.applications, f.from, f.to);
  const tthPrev = timeToHire(raw.applications, prev.from, prev.to);
  const eng = engagement(raw.pulse, f.from, f.to);
  const engPrev = engagement(raw.pulse, prev.from, prev.to);

  // Headcount trend: pichle 6 mahine ka aakhri din (aakhri = filter "to")
  const headcountTrend = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(monthStart(f.to), i - 5);
    const end = i === 5 ? f.to : monthEnd(m);
    return { label: mLabel(m), count: headcountOn(staff, end) };
  });
  const attritionTrend = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(monthStart(f.to), i - 5);
    return { label: mLabel(m), rate: attritionRate(staff, m, i === 5 ? f.to : monthEnd(m)) };
  });

  const active = staff.filter((s) => employedOn(s, f.to));
  const deptCounts = countBy(active, (s) => s.department_key);
  const departments = [...deptCounts.entries()]
    .map(([k, c]) => ({ key: k, label: k === "none" ? "Baghair department" : deptLabel.get(k) ?? k, count: c }))
    .sort((a, b) => b.count - a.count);
  const g = countBy(active, (s) => s.gender);
  const gender = [
    { key: "male", label: "Male", count: g.get("male") ?? 0 },
    { key: "female", label: "Female", count: g.get("female") ?? 0 },
    { key: "other", label: "Others", count: g.get("other") ?? 0 },
    { key: "none", label: "Darj nahi", count: g.get("none") ?? 0 },
  ];

  const a = attendanceStats(raw.attendance, ids, f.from, f.to);
  const ap = attendanceStats(raw.attendance, ids, prev.from, prev.to);

  const revs = raw.reviews.filter((r) => r.status === "approved" && ids.has(r.profile_id) && r.period_month >= monthStart(f.from) && r.period_month <= f.to);
  const rc = countBy(revs, (r) => r.rating);
  const ratings = RATINGS.map((k) => ({ key: k, label: RATING_LABEL[k], count: rc.get(k) ?? 0 }));

  const tr = raw.training.filter((t) => ids.has(t.profile_id) && t.training_date >= f.from && t.training_date <= f.to);
  const training = TRAINING_TYPES.map((k) => {
    const xs = tr.filter((t) => t.training_type === k);
    return { key: k, label: TRAINING_LABEL[k], hours: r1(xs.reduce((p, t) => p + Number(t.hours || 0), 0)), sessions: xs.length, cost: xs.reduce((p, t) => p + Number(t.cost || 0), 0) };
  });

  const exits = exitsIn(staff, f.from, f.to);
  const ec = countBy(exits, (s) => (s.exit_reason && EXIT_REASON_LABEL[s.exit_reason] ? s.exit_reason : "other"));
  const exitReasons = [...ec.entries()]
    .map(([k, c]) => ({ key: k, label: EXIT_REASON_LABEL[k] ?? k, count: c, pct: Math.round((c / exits.length) * 100) }))
    .sort((x, y) => y.count - x.count);

  // Target vs actual: sales = POS; baqi = actual_manual. Sirf manzoor shuda targets.
  const months = new Set(monthsIn(f.from, f.to));
  const posBy = new Map(raw.posSalesByMonth.map((m) => [m.month, m.amount]));
  const tg = raw.targets.filter((t) => t.status === "approved" && months.has(t.period_month) && (!f.department || t.department_key === f.department));
  const perfMap = new Map<string, { target: number; actual: number }>();
  for (const t of tg) {
    const cur = perfMap.get(t.department_key) ?? { target: 0, actual: 0 };
    cur.target += Number(t.target_amount);
    cur.actual += t.department_key === "sales" ? posBy.get(t.period_month) ?? 0 : Number(t.actual_manual ?? 0);
    perfMap.set(t.department_key, cur);
  }
  const perfVsTarget = [...perfMap.entries()].map(([k, v]) => ({ key: k, label: deptLabel.get(k) ?? k, target: v.target, actual: v.actual, pct: v.target ? Math.round((v.actual / v.target) * 100) : 0 }));

  const closed = raw.shifts.filter((s) => s.status === "closed");
  const byStaff = new Map<string, { shifts: number; diff: number }>();
  for (const s of raw.shifts) {
    const cur = byStaff.get(s.staff_name) ?? { shifts: 0, diff: 0 };
    cur.shifts += 1;
    cur.diff += Number(s.difference ?? 0);
    byStaff.set(s.staff_name, cur);
  }
  const due = raw.payroll.filter((p) => p.status !== "cancelled" && p.status !== "draft").reduce((x, p) => x + p.net, 0);
  const paid = raw.payroll.filter((p) => p.status === "paid").reduce((x, p) => x + p.net, 0);

  const d: HrDashboard = {
    filters: f,
    prev,
    employeeCount: total,
    kpis: {
      total: kpi(total, totalPrev, "count"),
      newHires: kpi(hires, hiresPrev, "count"),
      attrition: kpi(att, attPrev, "pct"),
      timeToHire: kpi(tth, tthPrev, "days"),
      engagement: kpi(eng.engagedPct, engPrev.engagedPct, "pct"),
    },
    headcountTrend,
    departments,
    attendance: { rate: a.rate, absentRate: a.absentRate, prevRate: ap.rate, prevAbsent: ap.absentRate, present: a.present, absent: a.absent, late: a.late },
    ratings,
    gender,
    funnel: funnel(raw.applications, f.from, f.to),
    applicantGender: applicantGenderSplit(raw.applications, f.from, f.to),
    training,
    satisfaction: { pct: eng.satisfactionPct, prev: engPrev.satisfactionPct, responses: eng.responses },
    attritionTrend,
    exitReasons,
    perfVsTarget,
    extras: {
      staffSales: raw.staffSales,
      shifts: {
        closed: closed.length,
        open: raw.shifts.length - closed.length,
        short: raw.shifts.filter((s) => Number(s.difference ?? 0) < 0).length,
        diffTotal: raw.shifts.reduce((x, s) => x + Number(s.difference ?? 0), 0),
        byStaff: [...byStaff.entries()].map(([name, v]) => ({ name, ...v })).sort((x, y) => x.diff - y.diff),
      },
      salary: { due, paid, pending: Math.max(0, due - paid), runs: raw.payroll.length },
      qist: { plans: raw.qist.length, outstanding: raw.qist.reduce((x, q) => x + Number(q.outstanding || 0), 0), overdue: raw.qist.reduce((x, q) => x + Number(q.overdue_count || 0), 0), advancesPending: raw.advancesPending },
    },
    insights: [],
  };
  d.insights = buildInsights(d, staff);
  return d;
}

/** Khud-ba-khud mashware -- sirf asal data se. */
export function buildInsights(d: HrDashboard, staff: StaffRow[]): string[] {
  const out: string[] = [];
  const k = d.kpis;
  if (!d.employeeCount) out.push("Abhi koi mulazim HR file mein nahi -- pehle staff ki HR file bharein.");
  const noHire = staff.filter((s) => !s.hire_date).length;
  if (noHire) out.push(`${noHire} staff ki joining date darj nahi -- headcount aur new hires sahi nahi ban sakte.`);
  const noGender = d.gender.find((g) => g.key === "none")?.count ?? 0;
  if (noGender) out.push(`${noGender} staff ka gender darj nahi.`);
  if (k.attrition.value != null && k.attrition.change != null)
    out.push(k.attrition.change <= 0 ? `Attrition ${Math.abs(k.attrition.change).toFixed(1)} points kam hui (achha rujhan).` : `Attrition ${k.attrition.change.toFixed(1)} points barh gayi -- wajah dekhein.`);
  if (d.exitReasons[0]) out.push(`Chhorne ki sab se bari wajah: ${d.exitReasons[0].label} (${d.exitReasons[0].pct}%).`);
  if (d.attendance.rate != null && d.attendance.rate < 90) out.push(`Hazri ${d.attendance.rate}% hai -- 90% se kam.`);
  if (d.attendance.present + d.attendance.absent === 0) out.push("Is arse mein hazri ki koi entry nahi.");
  const low = d.perfVsTarget.filter((p) => p.pct < 80);
  if (low.length) out.push(`Target se peeche: ${low.map((p) => `${p.label} ${p.pct}%`).join(", ")}.`);
  if (!d.training.some((t) => t.sessions)) out.push("Is arse mein koi training darj nahi.");
  if (k.engagement.value == null) out.push("Engagement ke liye kam se kam 3 staff ka mahana pulse chahiye.");
  else if (k.engagement.value < 90) out.push(`Engagement ${k.engagement.value}% -- 90%+ ka hadaf rakhein.`);
  if (d.extras.shifts.open) out.push(`${d.extras.shifts.open} POS shift abhi khuli hai.`);
  if (d.extras.shifts.short) out.push(`${d.extras.shifts.short} shift mein cash kam nikla.`);
  if (d.extras.salary.pending > 0) out.push(`Tankhwah Rs ${Math.round(d.extras.salary.pending).toLocaleString("en-PK")} abhi deni baqi.`);
  return out.slice(0, 6);
}

/** KPI formulas -- dashboard ke neeche (Roman Urdu / English). */
export const KPI_FORMULAS: { kpi: string; formula: string; desc: string }[] = [
  { kpi: "Attrition Rate", formula: "(Chhorne wale / Ausat staff) × 100", desc: "Ausat = (shuru + aakhir ka headcount) / 2" },
  { kpi: "Time to Hire", formula: "AVERAGE(Hired date − Application date)", desc: "Din mein, jo is arse mein hire hue" },
  { kpi: "Attendance Rate", formula: "(Present din / (Present + Absent)) × 100", desc: "Late aur half day = present; chhutti shamil nahi" },
  { kpi: "Training Hours / Employee", formula: "Kul training ghante / Kul staff", desc: "Training records se" },
  { kpi: "Employee Engagement", formula: "(Pulse 4-5 dene wale / Kul jawab) × 100", desc: "Gumnaam mahana pulse, kam se kam 3 jawab" },
  { kpi: "Satisfaction", formula: "((Ausat score − 1) / 4) × 100", desc: "1-5 score ko 0-100% mein" },
  { kpi: "Gender Diversity", formula: "(Female / Kul staff) × 100", desc: "HR file ka gender" },
  { kpi: "New Hire Rate", formula: "(Naye hire / Kul staff) × 100", desc: "Joining date is arse mein" },
  { kpi: "Performance vs Target", formula: "(Actual / Target) × 100", desc: "Sales = POS bikri; baqi = darj actual" },
];
