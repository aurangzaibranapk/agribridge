// HR KPI wiring: page role check, mojooda pipeline bacha, forms RLS (user client) se, koi service-client likhai nahi.
const fs = require("fs"); const assert = require("assert");
const page = fs.readFileSync("src/app/admin/hr-dashboard/page.tsx", "utf8");
for (const x of ["HR_KPI_ROLES", "HrKpiDashboardView", "HrSalaryTab", "STAGES.map", "HrMeetingsTodayWidget", "at_total_applications"]) assert.ok(page.includes(x), x);
assert.ok(page.indexOf("canKpi") < page.indexOf("loadHrRaw(") && page.indexOf("canKpi") < page.indexOf("loadSalaryRaw("), "role check pehle");
const actions = fs.readFileSync("src/actions/hr-kpi.ts", "utf8");
assert.ok(!actions.includes("createServiceClient"), "forms sirf user session (RLS)");
const load = fs.readFileSync("src/lib/hr-kpi/load.ts", "utf8");
assert.ok(!/\.(insert|update|delete|upsert)\(/.test(load), "loader sirf parhe");
assert.ok(load.includes('rpc("fn_hr_pulse_summary"') && !load.includes('from("hr_pulse_responses")'), "pulse sirf ikattha");
for (const p of ["training", "performance", "targets", "recruitment", "joining-exit"]) {
  const s = fs.readFileSync(`src/app/admin/hr/${p}/page.tsx`, "utf8");
  assert.ok(s.includes("requireHr()") && s.includes("NoAccess"), `${p}: role check`);
}
assert.ok(fs.readFileSync("src/app/admin/my-hr/page.tsx", "utf8").includes("<PulseCard"));
const mig = fs.readFileSync("supabase/migrations/688_hr_kpi_dashboard.sql", "utf8");
assert.ok(!/drop table|drop column|delete from|truncate/i.test(mig), "688 additive");
for (const t of ["hr_training_records", "hr_performance_reviews", "hr_pulse_responses", "hr_department_targets", "hr_kpi_audit"]) assert.ok(mig.includes(`alter table public.${t} enable row level security`), `${t} RLS`);
assert.ok(fs.existsSync("supabase/migrations/688_hr_kpi_dashboard.rollback.sql"));
console.log("hr-kpi-wiring: ok");
