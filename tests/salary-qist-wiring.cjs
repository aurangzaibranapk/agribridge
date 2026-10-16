const assert = require('node:assert/strict');
const fs = require('node:fs');
const r = (p) => fs.readFileSync(p, 'utf8');
// Payroll: maker-checker + journal posting + rollback
const pay = r('src/actions/payroll.ts');
assert.match(pay, /postPayrollApproved\(/);
assert.match(pay, /p_action: "unapprove"/, 'journal fail -> manzoori wapas');
assert.match(pay, /run\.created_by === user\?\.id\) return err\("Banane wala khud ada nahi kar sakta/);
assert.match(pay, /claims: \[\{ table: "payroll_runs", rowId: runId \}\]/);
// Qist apply is NOT a server action (no client-callable journal)
const apply = r('src/lib/qist/apply.ts');
assert.match(apply, /^import "server-only";/);
assert.doesNotMatch(r('src/actions/qist.ts'), /export async function applyQistAtPayout/);
assert.match(apply, /fn_qist_reverse_source/, 'journal fail -> kattauti wapas');
// Milk payment deducts qist before cash, reason to skip
const milk = r('src/actions/milk.ts');
assert.match(milk, /applyQistAtPayout\(\{\s*partyType: "farmer", partyId: farmerId, source: "milk"/);
assert.match(milk, /Qist is dafa na kaatne ki wajah likhein/);
assert.match(milk, /amount: cashAmount/);
// browser check 2026-10-16: raw English status/event na dikhe
assert.match(r('src/app/admin/khata/qist/page.tsx'), /PLAN_STATUS_LABEL\[p\.status\]/);
assert.match(r('src/app/admin/khata/qist/[id]/plan-client.tsx'), /PLAN_EVENT_LABEL\[e\.action\]/);
for (const a of ['created','submitted','approved','rejected','paused','resumed','rescheduled','edited','written_off','completed','cancelled','deducted','reversed']) assert.match(r('src/lib/qist/schedule.ts'), new RegExp(a + ':'), 'event label ' + a);
// browser check 2026-10-16: qist hissa bhi doodh baqaya ghataye
assert.match(milk, /amount: qistCut,\s*payment_method: "qist_adjustment"/);
assert.ok(milk.indexOf('payment_method: "qist_adjustment"') < milk.indexOf('if (cashAmount <= 0)'), 'qist row cash<=0 return se pehle');
const modal = r('src/app/admin/milk-collection/milk-client.tsx');
assert.match(modal, /milkQistPreview\(balance\.farmer_id/);
// Ledger rules
const rules = r('src/lib/ledger/rules.ts');
assert.match(rules, /badDebt: "6075"/);
assert.match(rules, /salaryDeductionsPayable: "2050"/);
assert.match(rules, /export async function postQistWriteOff/);
// Pages exist + nav
for (const p of ['src/app/admin/hr/salary-structure/page.tsx', 'src/app/admin/hr/payroll/page.tsx', 'src/app/admin/hr/advances/page.tsx',
  'src/app/admin/hr/payslip/[id]/page.tsx', 'src/app/admin/khata/qist/page.tsx', 'src/app/admin/khata/qist/new/page.tsx', 'src/app/admin/khata/qist/[id]/page.tsx']) assert.ok(fs.existsSync(p), p);
const nav = r('src/components/layout/nav-items.ts');
for (const h of ['/admin/hr/salary-structure', '/admin/hr/payroll', '/admin/hr/advances', '/admin/khata/qist']) assert.ok(nav.includes(`"${h}"`), h);
// Decisions encoded in SQL
const s553 = r('supabase/migrations/553_payroll_runs.sql');
assert.match(s553, /round\(p_basic \/ 30 \*/, '30-din qaida');
assert.doesNotMatch(s553, /overtime[a-z_]* numeric/i, 'overtime ka khana nahi');
const s552 = r('supabase/migrations/552_staff_advances.sql');
assert.match(s552, /advance_min_service_months int not null default 6/);
assert.match(s552, /advance_cap_pct numeric\(6,3\) check/);
assert.doesNotMatch(s552, /advance_cap_pct[^\n]*default 25/, 'koi fixed 25% nahi');
const s556 = r('supabase/migrations/556_qist_engine.sql');
assert.match(s556, /kami akhir wali EK jama qist mein/);
assert.match(s556, /'milk_weekly' then v_last \+ 7/);
assert.match(s556, /fn_payroll_my_role\(\) in \('admin','owner','super_admin'\)|fn_qist_is_approver/);
console.log('PASS: salary + qist wiring');
