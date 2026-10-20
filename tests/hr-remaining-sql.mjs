// 680–685. PGlite. Live / testing database ko haath nahi lagata.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (sql) => db.exec(sql);
const q = async (sql) => (await db.query(sql)).rows;
const read = (f) => fs.readFileSync(f, "utf8");

const OWNER = "00000000-0000-0000-0000-0000000000a1";
const ADMIN = "00000000-0000-0000-0000-0000000000a2";
const ADMIN2 = "00000000-0000-0000-0000-0000000000a3";
const HR = "00000000-0000-0000-0000-0000000000a4";
const STAFF = "00000000-0000-0000-0000-0000000000a5";
const RUN = "00000000-0000-0000-0000-0000000000f1";
const RUN2 = "00000000-0000-0000-0000-0000000000f2";
const J1 = "00000000-0000-0000-0000-0000000000e1";
const J2 = "00000000-0000-0000-0000-0000000000e2";
const PAY = "00000000-0000-0000-0000-0000000000c1";
const ADV = "00000000-0000-0000-0000-0000000000d1";
const PLAN = "00000000-0000-0000-0000-0000000000b1";

await run(`
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('test.uid', true), '')::uuid $$;
  create role anon;
  create role authenticated;
  create role service_role bypassrls;

  create table public.profiles (
    id uuid primary key, full_name text, role text, is_active boolean default true
  );
  insert into public.profiles (id, full_name, role) values
    ('${OWNER}','Owner','owner'),
    ('${ADMIN}','Admin','admin'),
    ('${ADMIN2}','Admin2','admin'),
    ('${HR}','HR','hr'),
    ('${STAFF}','Staff','sales_staff');

  create or replace function public.fn_payroll_my_role()
  returns text language sql stable security definer set search_path = public as $$
    select role from public.profiles where id = auth.uid() and is_active $$;
  create or replace function public.fn_payroll_is_approver()
  returns boolean language sql stable security definer set search_path = public as $$
    select coalesce(public.fn_payroll_my_role() in ('admin','owner','super_admin'), false) $$;
  create or replace function public.fn_payroll_is_writer()
  returns boolean language sql stable security definer set search_path = public as $$
    select coalesce(public.fn_payroll_my_role() in ('hr','finance','admin','owner','super_admin'), false) $$;
  create or replace function public.fn_qist_is_maker()
  returns boolean language sql stable security definer set search_path = public as $$
    select coalesce(public.fn_payroll_my_role() in ('hr','finance','manager','admin','owner','super_admin'), false) $$;

  create table public.hr_payroll_settings (id int primary key, advance_min_service_months int default 6);
  insert into public.hr_payroll_settings (id) values (1);

  create table public.finance_transactions (id uuid primary key);

  create table public.salary_payments (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public.profiles(id),
    pay_month int not null, pay_year int not null,
    basic_salary numeric not null default 0, bonus numeric default 0,
    deductions numeric default 0, advance_deduction numeric default 0,
    net_salary numeric not null, status text not null default 'pending',
    paid_date date, paid_by uuid, paid_at timestamptz, pay_txn_id uuid, notes text,
    unique (profile_id, pay_month, pay_year)
  );

  create table public.payroll_runs (
    id uuid primary key, pay_year int, pay_month int, status text, created_by uuid,
    submitted_by uuid, approve_journal_id uuid, pay_journal_id uuid,
    paid_by uuid, paid_at timestamptz, pay_account_id uuid, pay_txn_id uuid,
    pay_lock uuid, pay_lock_at timestamptz
  );
  create table public.payroll_lines (
    id uuid primary key default gen_random_uuid(), run_id uuid, profile_id uuid,
    basic numeric, allowances numeric default 0, absent_deduction numeric default 0,
    other_deductions numeric default 0, advance_deduction numeric default 0, net numeric
  );

  create table public.staff_salary_structures (
    id uuid primary key default gen_random_uuid(), profile_id uuid not null, basic numeric,
    effective_from date, status text default 'draft', notes text,
    created_by uuid, approved_by uuid, approved_at timestamptz, reject_reason text
  );
  create table public.staff_salary_structure_items (
    id uuid primary key default gen_random_uuid(), structure_id uuid, component_id uuid, amount numeric
  );
  create table public.staff_details (profile_id uuid primary key, basic_salary numeric);
  insert into public.staff_details values ('${ADMIN}', 30000), ('${STAFF}', 30000);

  create table public.staff_credit_ledger (
    id uuid primary key default gen_random_uuid(), profile_id uuid, ledger_type text,
    source_type text, amount numeric, notes text, created_by uuid
  );

  create table public.staff_advances (
    id uuid primary key, profile_id uuid, status text, requested_by uuid,
    paid_at timestamptz, paid_by uuid, paid_account_id uuid, paid_txn_id uuid, journal_entry_id uuid
  );

  create table public.qist_plans (
    id uuid primary key, party_type text, party_id uuid, created_by uuid, status text,
    version int default 1, written_off_amount numeric default 0,
    cap_pct numeric, cap_amount numeric, notes text
  );
  create table public.qist_installments (
    id uuid primary key default gen_random_uuid(), plan_id uuid, seq int,
    due_date date, amount_due numeric, amount_deducted numeric default 0, status text default 'due'
  );
`);

for (const f of [
  "680_salary_period_pay_once",
  "681_salary_payment_insert_guard",
  "682_salary_structure_self_guard",
  "683_staff_khata_self_guard",
  "684_advance_pay_maker_guard",
  "685_qist_self_decision_guard",
]) {
  await run(read(`supabase/migrations/${f}.sql`));
}

async function asUser(uid, sql) {
  await run(`select set_config('test.uid', '${uid}', false)`);
  return q(sql);
}

console.log("duplicate journal count:");
await run(`insert into payroll_runs (id, status, created_by, pay_journal_id) values
  ('${RUN}','paid','${HR}','${J1}'), ('${RUN2}','paid','${HR}','${J1}')`);
assert.equal((await q(`select public.fn_payroll_duplicate_pay_journal_count() as n`))[0].n, 1);
assert.equal((await q(`select count(*)::int as n from payroll_runs where pay_journal_id = '${J1}'`))[0].n, 2);
const doBlock = read("supabase/migrations/662_payroll_pay_once.sql");
const doSql = doBlock.slice(doBlock.indexOf("do $$"), doBlock.indexOf("create unique index"));
await assert.rejects(() => run(doSql), /dohra/);
await run(`delete from payroll_runs`);

console.log("N4 / N7 insert:");
await assert.rejects(
  () => asUser(ADMIN, `insert into salary_payments (profile_id, pay_month, pay_year, basic_salary, net_salary, status) values ('${STAFF}', 1, 2026, 1000, 1000, 'paid')`),
  /seedha paid/,
);
await assert.rejects(
  () => asUser(ADMIN, `insert into salary_payments (profile_id, pay_month, pay_year, basic_salary, net_salary) values ('${ADMIN}', 1, 2026, 1000, 1000)`),
  /Apni tankhwah/,
);
await assert.rejects(
  () => asUser(ADMIN, `insert into salary_payments (profile_id, pay_month, pay_year, basic_salary, net_salary) values ('${STAFF}', 1, 2026, 0, 0)`),
  /sifar/,
);
await asUser(ADMIN, `insert into salary_payments (id, profile_id, pay_month, pay_year, basic_salary, net_salary) values ('${PAY}', '${STAFF}', 1, 2026, 1000, 1000)`);
assert.equal((await q(`select created_by::text as c from salary_payments where id = '${PAY}'`))[0].c, ADMIN);

console.log("N7 claim maker:");
await assert.rejects(() => asUser(ADMIN, `select public.fn_salary_payment_claim('${PAY}')`), /banayi wo khud/);
const claimed = await asUser(ADMIN2, `select public.fn_salary_payment_claim('${PAY}')->>'id' as id`);
assert.equal(claimed[0].id, PAY);
await assert.rejects(() => asUser(OWNER, `select public.fn_salary_payment_claim('${PAY}')`), /pehle hi di ja chuki/);

console.log("N1 payroll dobara nahi:");
await run(`insert into payroll_runs (id, pay_year, pay_month, status, created_by, approve_journal_id)
  values ('${RUN}', 2026, 1, 'approved', '${HR}', '${J2}')`);
await run(`insert into payroll_lines (run_id, profile_id, basic, allowances, absent_deduction, other_deductions, advance_deduction, net)
  values ('${RUN}', '${STAFF}', 1000, 0, 0, 0, 0, 1000)`);
await assert.rejects(
  () => asUser(ADMIN2, `select public.fn_payroll_set_journal('${RUN}', 'pay', '${J2}', null, null)`),
  /pehle di ja chuki/,
);

console.log("N1 ulta raasta + S6 + N8 + HR:");
await run(`delete from salary_period_pays`);
await run(`delete from salary_payments`);
await run(`update payroll_runs set pay_year = 2026, pay_month = 2, status = 'approved', created_by = '${HR}', submitted_by = '${ADMIN}', approve_journal_id = '${J2}', pay_journal_id = null, paid_by = null where id = '${RUN}'`);
await assert.rejects(() => asUser(ADMIN, `select public.fn_payroll_claim_pay('${RUN}')`), /Bhejne wala/);
await run(`update payroll_runs set submitted_by = null`);
await run(`update payroll_lines set profile_id = '${ADMIN2}' where run_id = '${RUN}'`);
await assert.rejects(() => asUser(ADMIN2, `select public.fn_payroll_claim_pay('${RUN}')`), /apni tankhwah/);
await run(`update payroll_lines set profile_id = '${STAFF}' where run_id = '${RUN}'`);
await assert.rejects(() => asUser(HR, `select public.fn_payroll_claim_pay('${RUN}')`), /Banane wala/);
await run(`update payroll_runs set created_by = '${ADMIN}'`);
const hrClaim = await asUser(HR, `select public.fn_payroll_claim_pay('${RUN}') as v`);
assert.equal(hrClaim[0].v, "claimed");
await asUser(HR, `select public.fn_payroll_set_journal('${RUN}', 'pay', '${J2}', null, null)`);
assert.equal((await q(`select status from salary_payments where profile_id = '${STAFF}' and pay_month = 2`))[0].status, "paid");
await assert.rejects(
  () => asUser(ADMIN2, `insert into salary_payments (profile_id, pay_month, pay_year, basic_salary, net_salary) values ('${STAFF}', 2, 2026, 500, 500)`),
  /pehle di ja chuki/,
);

console.log("S7 structure:");
await assert.rejects(
  () => asUser(ADMIN, `insert into staff_salary_structures (profile_id, basic, effective_from, created_by) values ('${ADMIN}', 100, '2026-01-01', '${ADMIN}')`),
  /Apni tankhwah ka structure/,
);
await asUser(ADMIN, `insert into staff_salary_structures (id, profile_id, basic, effective_from, created_by) values ('${PLAN}', '${STAFF}', 100, '2026-01-01', '${ADMIN}')`);
await assert.rejects(
  () => asUser(STAFF, `update staff_salary_structures set basic = 999 where id = '${PLAN}'`),
  /Apni tankhwah ka structure/,
);
await asUser(ADMIN2, `update staff_salary_structures set notes = 'ok' where id = '${PLAN}'`);

console.log("S8 khata:");
await assert.rejects(
  () => asUser(ADMIN, `insert into staff_credit_ledger (profile_id, ledger_type, source_type, amount) values ('${ADMIN}', 'credit', 'manual', 500)`),
  /Apna khata/,
);
await asUser(ADMIN, `insert into staff_credit_ledger (profile_id, ledger_type, source_type, amount) values ('${STAFF}', 'debit', 'purchase', 50)`);
await assert.rejects(
  () => asUser(ADMIN, `insert into staff_credit_ledger (profile_id, ledger_type, source_type, amount) values ('${ADMIN}', 'credit', 'daily_wage', 50)`),
  /basic\/30/,
);
await asUser(ADMIN, `insert into staff_credit_ledger (profile_id, ledger_type, source_type, amount) values ('${ADMIN}', 'credit', 'daily_wage', 1000)`);

console.log("N2 advance:");
await run(`insert into staff_advances (id, profile_id, status, requested_by) values ('${ADV}', '${STAFF}', 'approved', '${ADMIN}')`);
await assert.rejects(() => asUser(ADMIN, `select public.fn_staff_advance_mark_paid('${ADV}', null, null, null)`), /Darkhwast dene wala/);
await asUser(ADMIN2, `select public.fn_staff_advance_mark_paid('${ADV}', null, null, null)`);
assert.equal((await q(`select status from staff_advances where id = '${ADV}'`))[0].status, "paid");

console.log("N3 / N5 / N6 / N9 qist:");
await run(`insert into qist_plans (id, party_type, party_id, created_by, status) values ('${PLAN}', 'staff', '${STAFF}', '${ADMIN}', 'submitted')`);
await run(`insert into qist_installments (plan_id, seq, due_date, amount_due) values ('${PLAN}', 1, '2026-02-01', 100)`);
await assert.rejects(
  () => asUser(ADMIN, `update qist_plans set status = 'active' where id = '${PLAN}'`),
  /Banane wala khud manzoor/,
);
await assert.rejects(
  () => asUser(STAFF, `update qist_plans set notes = 'x' where id = '${PLAN}'`),
  /Apni qist/,
);
await assert.rejects(
  () => asUser(STAFF, `update qist_installments set amount_deducted = 100 where plan_id = '${PLAN}'`),
  /Apni qist ki schedule/,
);
await asUser(ADMIN2, `update qist_plans set status = 'active' where id = '${PLAN}'`);
await asUser(ADMIN2, `update qist_installments set amount_deducted = 10 where plan_id = '${PLAN}'`);
await assert.rejects(
  () => asUser(ADMIN, `update qist_plans set version = 2 where id = '${PLAN}'`),
  /schedule ya had/,
);

console.log("rollbacks:");
for (const f of [
  "685_qist_self_decision_guard",
  "684_advance_pay_maker_guard",
  "683_staff_khata_self_guard",
  "682_salary_structure_self_guard",
  "681_salary_payment_insert_guard",
  "680_salary_period_pay_once",
]) {
  await run(read(`supabase/migrations/${f}.rollback.sql`));
}

console.log("hr remaining sql: theek");
