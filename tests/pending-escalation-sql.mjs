// 698 escalation + shared maker-checker. PGlite. Live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
const one = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
const reset = "reset role; select set_config('test.uid','',false);";
const as = (u) => `set role authenticated; select set_config('test.uid','${u}',false);`;
const asQ = async (u, s) => { await run(as(u)); try { return await q(s); } finally { await run(reset); } };
let ok = 0;
const pass = (n) => { ok++; console.log(`  ok  ${n}`); };

const OWN = "00000000-0000-0000-0000-0000000000a1";
const ADM = "00000000-0000-0000-0000-0000000000a2";
const MGR = "00000000-0000-0000-0000-0000000000a3";
const OTH = "00000000-0000-0000-0000-0000000000a4";
const STF = "00000000-0000-0000-0000-0000000000a5";

await run(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema public to authenticated, anon;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
create table public.profiles (
  id uuid primary key, role text, branch_id uuid, full_name text, is_active boolean default true
);
grant select on public.profiles to authenticated;
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null,
  title text not null,
  message text not null,
  link_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.cash_handovers (
  id uuid primary key default gen_random_uuid(),
  status text,
  created_at timestamptz not null default now(),
  amount_sent numeric,
  from_profile_id uuid,
  to_profile_id uuid,
  to_branch_id uuid
);
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  review_status text,
  created_at timestamptz not null default now(),
  total_amount numeric,
  created_by uuid,
  branch_id uuid
);
create table public.season_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text,
  status text not null default 'preview',
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.season_import_batches enable row level security;
revoke all on public.season_import_batches from anon, authenticated;
insert into profiles values
  ('${OWN}','owner',null,'Owner',true),
  ('${ADM}','admin',null,'Admin',true),
  ('${MGR}','manager',null,'Manager',true),
  ('${OTH}','manager',null,'Doosra Manager',true),
  ('${STF}','sales_staff',null,'Staff',true);
`);

const M = fs.readFileSync("supabase/migrations/698_pending_escalation.sql", "utf8");
assert.doesNotMatch(M, /whatsapp_send|net\.http|pg_net|send_email|sms_outbox/i);
await run(M);
await run(M);
pass("698 idempotent, no sms/whatsapp");

await run(`
create or replace function public.fn_admin_pending_sources()
returns table (
  key text, group_key text, route text, tbl text, cond text, created_col text,
  amount_expr text, maker_col text, actor_col text, branch_col text,
  ref_expr text, title_expr text, link_expr text, pending_with text, is_info boolean
)
language sql immutable as $$
  select * from (values
    ('cash_handover','finance','/admin/cash-handover','cash_handovers','t.status = ''sent''','created_at','t.amount_sent','from_profile_id','to_profile_id','to_branch_id',null,null,null,'receiver',false),
    ('purchases','purchase','/admin/purchases','purchases','t.review_status = ''submitted''','created_at','t.total_amount','created_by',null,'branch_id',null,null,null,'purchase_checker',false),
    ('missing_cat','sales','/admin/nope','no_such_table','true','created_at',null,null,null,null,null,null,null,'admin',false)
  ) as s(key, group_key, route, tbl, cond, created_col, amount_expr, maker_col, actor_col, branch_col, ref_expr, title_expr, link_expr, pending_with, is_info)
$$;
insert into cash_handovers (id, status, created_at, amount_sent, from_profile_id) values
  ('10000000-0000-0000-0000-000000000001','sent', now() - interval '30 hours', 5000, '${MGR}'),
  ('10000000-0000-0000-0000-000000000002','sent', now() - interval '2 hours', 100, '${STF}');
insert into purchases (id, review_status, created_at, total_amount, created_by) values
  ('20000000-0000-0000-0000-000000000001','submitted', now() - interval '30 hours', 900, '${MGR}');
`);
await asQ(OWN, "select fn_pending_escalation_set_sla('purchases', 48)");

const first = await one("select fn_pending_escalate()");
const jump = await q("select category, reason, waited_seconds from pending_escalation_events where kind = 'escalated' order by category");
assert.equal(jump.length, 1);
assert.equal(jump[0].category, "cash_handover");
assert.equal(jump[0].reason, "Manager ne 24 ghante mein approve nahi kiya");
assert.ok(Number(jump[0].waited_seconds) >= 30 * 3600 - 120);
const levels = Object.fromEntries((await q("select category || ':' || item_id as k, level from pending_escalation_state")).map((r) => [r.k, r.level]));
assert.equal(levels["cash_handover:10000000-0000-0000-0000-000000000001"], "escalated");
assert.equal(levels["cash_handover:10000000-0000-0000-0000-000000000002"], "manager");
assert.equal(levels["purchases:20000000-0000-0000-0000-000000000001"], "manager");
const notes = await q("select recipient_user_id::text as id from notifications order by id");
const ids = notes.map((r) => r.id).sort();
assert.deepEqual(ids, [ADM, OWN].sort());
assert.match(String((await q("select message from notifications limit 1"))[0].message), /Manager ne 24 ghante/);
pass("SLA: 24h cash -> Admin+Owner; 2h stays manager; 48h purchase stays; both notified");

const beforeEvents = await one("select count(*)::int from pending_escalation_events");
const beforeNotes = await one("select count(*)::int from notifications");
const second = await one("select fn_pending_escalate()");
assert.equal(await one("select count(*)::int from pending_escalation_events where kind = 'escalated'"), 1);
assert.equal(await one("select count(*)::int from pending_escalation_events"), beforeEvents);
assert.equal(await one("select count(*)::int from notifications"), beforeNotes);
assert.equal(second.escalated, 0);
void first;
pass("second run is idempotent");

assert.equal(await one(`select fn_may_decide_entry('${MGR}'::uuid)`), false); // no auth
const mgrOwn = await asQ(MGR, `select fn_may_decide_entry('${MGR}'::uuid) as v`);
assert.equal(mgrOwn[0].v, false);
const mgrOther = await asQ(MGR, `select fn_may_decide_entry('${STF}'::uuid) as v`);
assert.equal(mgrOther[0].v, true);
const admOwn = await asQ(ADM, `select fn_may_decide_entry('${ADM}'::uuid) as v`);
assert.equal(admOwn[0].v, true);
const ownOwn = await asQ(OWN, `select fn_may_decide_entry('${OWN}'::uuid, '${OWN}'::uuid) as v`);
assert.equal(ownOwn[0].v, true);
const stfOwn = await asQ(STF, `select fn_may_decide_entry('${STF}'::uuid) as v`);
assert.equal(stfOwn[0].v, false);
pass("maker-checker: staff/manager no, admin/owner yes");

await assert.rejects(() => asQ(MGR, `select fn_pending_delay_note('cash_handover','10000000-0000-0000-0000-000000000001','main bahar tha')`), /paas|nahi|Delay/i);
await assert.rejects(() => asQ(OTH, `select fn_pending_delay_note('cash_handover','10000000-0000-0000-0000-000000000001','branch band thi')`), /paas|nahi|Delay/i);
const noteId = await asQ(OTH, `select fn_pending_delay_note('cash_handover','10000000-0000-0000-0000-000000000002','branch band thi') as v`);
assert.ok(noteId[0].v);
const admNote = await asQ(ADM, `select fn_pending_delay_note('cash_handover','10000000-0000-0000-0000-000000000001','admin ne dekh liya') as v`);
assert.ok(admNote[0].v);
pass("delay note: escalated par manager nahi, manager level par doosra manager, admin hamesha");

await run(`update cash_handovers set from_profile_id = '${ADM}' where id = '10000000-0000-0000-0000-000000000002'`);
await run(`update pending_escalation_state set maker_id = '${ADM}' where item_id = '10000000-0000-0000-0000-000000000002'`);
const label = await asQ(ADM, `select fn_pending_log_self_decision('cash_handover','10000000-0000-0000-0000-000000000002','approve') as v`);
assert.equal(label[0].v, "Khud approve (Admin)");
const again = await asQ(ADM, `select fn_pending_log_self_decision('cash_handover','10000000-0000-0000-0000-000000000002','approve') as v`);
assert.equal(again[0].v, "Khud approve (Admin)");
assert.equal(await one("select count(*)::int from pending_escalation_events where kind = 'self_decision' and reason = 'Khud approve (Admin)'"), 1);
await run(`update purchases set created_by = '${OWN}' where id = '20000000-0000-0000-0000-000000000001'`);
await run(`update pending_escalation_state set maker_id = '${OWN}' where item_id = '20000000-0000-0000-0000-000000000001'`);
const ownLabel = await asQ(OWN, `select fn_pending_log_self_decision('purchases','20000000-0000-0000-0000-000000000001','approve') as v`);
assert.equal(ownLabel[0].v, "Khud approve (Owner)");
const mgrLog = await asQ(MGR, `select fn_pending_log_self_decision('cash_handover','10000000-0000-0000-0000-000000000001','approve') as v`);
assert.equal(mgrLog[0].v, null);
pass("self-approval timeline: Khud approve (Admin) and (Owner); manager log nahi");

await run(`update cash_handovers set status = 'received' where id = '10000000-0000-0000-0000-000000000001'`);
await one("select fn_pending_escalate()");
assert.equal(await one("select closed_at is not null from pending_escalation_state where item_id = '10000000-0000-0000-0000-000000000001'"), true);
assert.equal(await one("select closed_at is null from pending_escalation_state where item_id = '10000000-0000-0000-0000-000000000002'"), true);
pass("item jo pending nahi raha, band ho jata hai; jo reh gaya khula rehta hai");

await run(`insert into season_import_batches (file_name, status, created_by) values ('kisan.xlsx','preview','${ADM}')`);
const seen = await asQ(ADM, "select count(*)::int as n from season_import_batches where status = 'preview'");
assert.equal(seen[0].n, 1);
const hidden = await asQ(STF, "select count(*)::int as n from season_import_batches");
assert.equal(hidden[0].n, 0);
pass("season import admin parh sakta hai (warning ki wajah khatam), staff ko qatarein nahi");

await run(`
create table public.fuel_logs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid,
  approved_by uuid,
  constraint chk_fuel_no_self_approval check (approved_by is null or created_by is null or approved_by <> created_by)
);
create table public.pos_returns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid,
  authorized_by uuid,
  admin_review_status text not null default 'pending',
  admin_reviewed_by uuid
);
`);
await one("select fn_install_shared_approval_guards()");
await run(`insert into fuel_logs (created_by, approved_by) values ('${ADM}','${ADM}')`);
await assert.rejects(
  () => run(`insert into fuel_logs (created_by, approved_by) values ('${MGR}','${MGR}')`),
  /khud manzoor/,
);
await run(`insert into pos_returns (id, created_by, authorized_by, admin_review_status) values ('30000000-0000-0000-0000-000000000001','${ADM}','${MGR}','pending')`);
await run(`update pos_returns set admin_review_status = 'approved', admin_reviewed_by = '${ADM}' where id = '30000000-0000-0000-0000-000000000001'`);
await run(`insert into pos_returns (id, created_by, authorized_by, admin_review_status) values ('30000000-0000-0000-0000-000000000002','${STF}','${MGR}','pending')`);
await assert.rejects(
  () => run(`update pos_returns set admin_review_status = 'approved', admin_reviewed_by = '${MGR}' where id = '30000000-0000-0000-0000-000000000002'`),
  /Owner\/Admin|review/,
);
pass("shared guard: Admin apni fuel aur POS, manager apni nahi");

console.log(`pending escalation SQL: ${ok} passed`);
