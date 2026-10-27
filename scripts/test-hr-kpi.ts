import assert from "node:assert";
import { applicantGenderSplit, buildDashboard, parseHrFilters, previousPeriod, attritionRate, funnel, timeToHire, engagement, headcountOn, type HrRaw, type StaffRow } from "../src/lib/hr-kpi/core";
import { buildSalary, parseSalFilters, dueDate, onTimePct, currentSalary, empStatus, rSquared, type SalaryRaw } from "../src/lib/hr-kpi/salary";
import { parseTraining, parseReview, parseTarget, parseJoinExit, parseCandidate, parsePulse, stageToStatus } from "../src/lib/hr-kpi/validate";

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const U = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const st = (n: number, o: Partial<StaffRow> = {}): StaffRow => ({ profile_id: U(n), name: `S${n}`, department_key: "sales", branch_id: null, employment_type: "permanent", gender: "male", hire_date: "2026-01-01", exit_date: null, exit_reason: null, is_active: true, ...o });

// Filters
let f = parseHrFilters(undefined, "2026-10-21", ["sales"], []);
assert.deepStrictEqual([f.from, f.to, f.department], ["2026-10-01", "2026-10-21", null]);
f = parseHrFilters({ dept: "evil", etype: "contract", from: "2026-11-01" }, "2026-10-21", ["sales"], []);
assert.deepStrictEqual([f.department, f.employmentType, f.from], [null, "contract", "2026-10-01"]);
assert.deepStrictEqual(previousPeriod({ from: "2026-10-01", to: "2026-10-21" }), { from: "2026-09-10", to: "2026-09-30" });

// Headcount / attrition
const staff = [st(1), st(2, { hire_date: "2026-10-05", gender: "female" }), st(3, { exit_date: "2026-10-10", exit_reason: "salary" }), st(4, { hire_date: null, gender: null })];
assert.strictEqual(headcountOn(staff, "2026-10-21"), 3);
assert.strictEqual(headcountOn(staff, "2026-09-30"), 3);
assert.strictEqual(attritionRate(staff, "2026-10-01", "2026-10-21"), 33.3);
assert.strictEqual(attritionRate([], "2026-10-01", "2026-10-21"), null);

// Funnel / time to hire
const apps = [
  { created_at: "2026-10-01T05:00:00Z", screened_at: "x", interview_at: "x", offer_at: "x", hired_at: "2026-10-11T05:00:00Z" },
  { created_at: "2026-10-02T05:00:00Z", screened_at: "x", interview_at: null, offer_at: null, hired_at: null },
  { created_at: "2026-09-02T05:00:00Z", screened_at: null, interview_at: null, offer_at: null, hired_at: null },
];
assert.deepStrictEqual(funnel(apps, "2026-10-01", "2026-10-21").map((s) => [s.count, s.pct]), [[2, 100], [2, 100], [1, 50], [1, 50], [1, 50]]);
assert.strictEqual(timeToHire(apps, "2026-10-01", "2026-10-21"), 10);
assert.strictEqual(timeToHire(apps, "2026-09-01", "2026-09-30"), null);

// Engagement (gumnaam aggregate)
assert.deepStrictEqual(engagement([{ period_month: "2026-10-01", responses: 4, avg_score: 4, engaged: 3 }], "2026-10-01", "2026-10-21"), { engagedPct: 75, satisfactionPct: 75, responses: 4 });
assert.strictEqual(engagement([], "2026-10-01", "2026-10-21").engagedPct, null);

// Pura dashboard -- khali data par koi farzi adad nahi
const empty: HrRaw = { today: "2026-10-21", staff: [], departments: [], attendance: [], applications: [], training: [], reviews: [], pulse: [], targets: [], posSalesByMonth: [], staffSales: [], shifts: [], payroll: [], qist: [], advancesPending: 0 };
f = parseHrFilters(undefined, "2026-10-21", [], []);
let d = buildDashboard(empty, f);
assert.strictEqual(d.employeeCount, 0);
assert.strictEqual(d.kpis.attrition.value, null); assert.strictEqual(d.kpis.timeToHire.value, null); assert.strictEqual(d.kpis.engagement.value, null);
assert.strictEqual(d.attendance.rate, null); assert.strictEqual(d.satisfaction.pct, null);
assert.ok(d.insights.length > 0);

const raw: HrRaw = {
  ...empty,
  staff,
  departments: [{ key: "sales", label: "Sales" }],
  attendance: [
    { profile_id: U(1), attendance_date: "2026-10-02", status: "present", late_minutes: 5 },
    { profile_id: U(1), attendance_date: "2026-10-03", status: "absent", late_minutes: 0 },
    { profile_id: U(2), attendance_date: "2026-10-06", status: "present", late_minutes: 0 },
    { profile_id: U(9), attendance_date: "2026-10-06", status: "absent", late_minutes: 0 },
  ],
  applications: apps,
  training: [{ profile_id: U(1), training_type: "technical", training_date: "2026-10-03", hours: 4, cost: 100 }],
  reviews: [{ profile_id: U(1), period_month: "2026-10-01", rating: "good", status: "approved" }, { profile_id: U(2), period_month: "2026-10-01", rating: "poor", status: "pending" }],
  targets: [{ department_key: "sales", period_month: "2026-10-01", target_amount: 1000, actual_manual: null, status: "approved" }, { department_key: "x", period_month: "2026-10-01", target_amount: 1, actual_manual: 1, status: "pending" }],
  posSalesByMonth: [{ month: "2026-10-01", amount: 900 }],
  shifts: [{ staff_name: "A", status: "closed", difference: -100 }, { staff_name: "A", status: "open", difference: null }],
  payroll: [{ month: "2026-10-01", status: "approved", net: 500 }, { month: "2026-10-01", status: "draft", net: 999 }],
};
d = buildDashboard(raw, f);
assert.strictEqual(d.employeeCount, 3);
assert.strictEqual(d.kpis.newHires.value, 1);
assert.deepStrictEqual([d.attendance.present, d.attendance.absent, d.attendance.late, d.attendance.rate], [2, 1, 1, 66.7]);
assert.strictEqual(d.ratings.find((r) => r.key === "good")!.count, 1);
assert.strictEqual(d.ratings.find((r) => r.key === "poor")!.count, 0, "pending review shamil nahi");
assert.deepStrictEqual(d.perfVsTarget, [{ key: "sales", label: "Sales", target: 1000, actual: 900, pct: 90 }]);
assert.deepStrictEqual(d.exitReasons.map((r) => [r.key, r.pct]), [["salary", 100]]);
assert.strictEqual(d.training[0].hours, 4);
assert.deepStrictEqual(d.extras.salary, { due: 500, paid: 0, pending: 500, runs: 2 });
assert.deepStrictEqual([d.extras.shifts.closed, d.extras.shifts.open, d.extras.shifts.short], [1, 1, 1]);
assert.strictEqual(d.gender.find((g) => g.key === "none")!.count, 1);
assert.strictEqual(d.gender.find((g) => g.key === "female")!.count, 1, "staff gender card unchanged");
assert.strictEqual(d.applicantGender.find((g) => g.key === "none")!.count, 2);
assert.deepStrictEqual(applicantGenderSplit([
  { created_at: "2026-10-01T05:00:00Z", screened_at: null, interview_at: null, offer_at: null, hired_at: null, gender: "female" },
  { created_at: "2026-10-02T05:00:00Z", screened_at: null, interview_at: null, offer_at: null, hired_at: null, gender: "male" },
  { created_at: "2026-10-03T05:00:00Z", screened_at: null, interview_at: null, offer_at: null, hired_at: null, gender: "other" },
], "2026-10-01", "2026-10-21").map((g) => g.count), [1, 1, 1, 0]);
assert.ok(d.insights.some((x) => x.includes("joining date")));
d = buildDashboard(raw, { ...f, department: "ops" });
assert.strictEqual(d.employeeCount, 0, "department filter");

// Validation
assert.ok(parseTraining(fd({ profile_id: U(1), training_type: "technical", title: "POS", training_date: "2026-10-01", hours: "3" }), "2026-10-21").ok);
assert.ok(!parseTraining(fd({ profile_id: U(1), training_type: "technical", title: "POS", training_date: "2026-12-01", hours: "3" }), "2026-10-21").ok);
assert.ok(!parseReview(fd({ profile_id: U(1), period_month: "2026-10", rating: "good" }), U(1)).ok, "apna review nahi");
assert.strictEqual((parseReview(fd({ profile_id: U(1), period_month: "2026-10", rating: "good" }), U(2)) as { value: { period_month: string } }).value.period_month, "2026-10-01");
const tg = parseTarget(fd({ department_key: "sales", period_month: "2026-10", target_amount: "100", actual_manual: "5" }), ["sales"]);
assert.ok(tg.ok && tg.value.actual_manual === null, "sales ka actual POS se");
assert.ok(!parseJoinExit(fd({ id: U(1), exit_date: "2026-10-01" }), "2026-10-21").ok, "exit wajah zaroori");
assert.ok(!parseJoinExit(fd({ id: U(1), hire_date: "2026-10-05", exit_date: "2026-10-01", exit_reason: "personal" }), "2026-10-21").ok);
assert.ok(parseJoinExit(fd({ id: U(1), gender: "female", hire_date: "2026-10-05" }), "2026-10-21").ok);
assert.ok(!parseCandidate(fd({ vacancy_id: U(1), full_name: "Ali", email: "bad" })).ok);
assert.ok(parseCandidate(fd({ vacancy_id: U(1), full_name: "Ali", email: "a@b.pk", phone: "03001234567" })).ok);
assert.ok(!parseCandidate(fd({ vacancy_id: U(1), full_name: "Ali", email: "a@b.pk", gender: "nope" })).ok);
const hiredGender = parseCandidate(fd({ vacancy_id: U(1), full_name: "Ali", email: "a@b.pk", gender: "female" }));
assert.ok(hiredGender.ok && hiredGender.value.gender === "female");
assert.ok(!parsePulse(fd({ score: "6" }), "2026-10-21").ok);
assert.strictEqual(stageToStatus("hired"), "joined"); assert.strictEqual(stageToStatus("x"), null);

// Tankhwah tab
assert.strictEqual(dueDate("2026-09-01", 10), "2026-10-10");
assert.deepStrictEqual(parseSalFilters({ s_status: "fired", s_year: "2026" }), { dept: null, status: null, desig: null, year: "2026" });
const sraw: SalaryRaw = {
  today: "2026-10-21", dueDay: 10,
  staff: [
    { profile_id: U(1), employee_code: "E001", name: "A", department_key: "sales", designation: "Salesman", hire_date: "2025-01-01", exit_date: null, basic_salary: 30000, is_active: true },
    { profile_id: U(2), employee_code: "E002", name: "B", department_key: "ops", designation: "Clerk", hire_date: "2026-10-02", exit_date: null, basic_salary: null, is_active: true },
    { profile_id: U(3), employee_code: "E003", name: "C", department_key: "ops", designation: "Clerk", hire_date: "2025-05-01", exit_date: "2026-10-05", basic_salary: 40000, is_active: true },
  ],
  departments: [{ key: "sales", label: "Sales" }, { key: "ops", label: "Ops" }],
  structures: [{ profile_id: U(1), basic: 35000, effective_from: "2026-07-01" }, { profile_id: U(1), basic: 99999, effective_from: "2026-12-01" }],
  runs: [{ month: "2026-09-01", status: "paid", paid_at: "2026-10-09T10:00:00Z", gross: 75000, heads: 2 }, { month: "2026-08-01", status: "paid", paid_at: "2026-09-15T10:00:00Z", gross: 70000, heads: 2 }],
  payments: [],
  leaves: [{ profile_id: U(2), from_date: "2026-10-20", to_date: "2026-10-22" }],
  reviews: [{ profile_id: U(1), period_month: "2026-09-01", rating: "good" }],
};
assert.strictEqual(currentSalary(sraw.staff[0], sraw.structures, "2026-10-21"), 35000, "future structure nahi");
assert.strictEqual(currentSalary(sraw.staff[1], sraw.structures, "2026-10-21"), null);
assert.strictEqual(empStatus(sraw.staff[1], sraw.leaves, "2026-10-21"), "on_leave");
assert.strictEqual(empStatus(sraw.staff[2], sraw.leaves, "2026-10-21"), "terminated");
assert.strictEqual(onTimePct(sraw, ["2026-08-01", "2026-09-01"]), 50);
const s = buildSalary(sraw, parseSalFilters(undefined));
assert.strictEqual(s.kpis.employees.value, 2);
assert.strictEqual(s.kpis.payroll.value, 75000); assert.ok(Math.abs((s.kpis.payroll.change ?? 0) - 7.142857) < 0.001);
assert.strictEqual(s.kpis.avgSalary.value, 35000);
assert.strictEqual(s.kpis.newHires.value, 1);
assert.strictEqual(s.missingSalary, 1);
assert.strictEqual(s.table.length, 3);
assert.strictEqual(buildSalary(sraw, { dept: "ops", status: "terminated", desig: null, year: null }).table.length, 1);
assert.strictEqual(buildSalary(sraw, { dept: null, status: null, desig: null, year: "2026" }).table.length, 1);
assert.strictEqual(s.histogram.find((b) => b.label === "35K-50K")!.count, 1);
assert.deepStrictEqual(s.scatter, [{ name: "A", rating: 4, salary: 35000 }]);
assert.strictEqual(s.r2, null);
assert.strictEqual(rSquared([1, 2, 3], [10, 20, 30]), 1);
const se = buildSalary({ ...sraw, staff: [], runs: [], structures: [], reviews: [] }, parseSalFilters(undefined));
assert.deepStrictEqual([se.kpis.payroll.value, se.kpis.avgSalary.value, se.kpis.onTime.value, se.kpis.attrition.value], [null, null, null, null]);

console.log("hr-kpi: ok");
