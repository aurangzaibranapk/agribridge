// 726 Milk Handover Certificate on PGlite. Remote database par nahi chalta.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const sql = fs.readFileSync("supabase/migrations/726_milk_handover_certificate.sql", "utf8");
const rollback = fs.readFileSync("supabase/migrations/726_milk_handover_certificate.rollback.sql", "utf8");
const sql728 = fs.readFileSync("supabase/migrations/728_milk_handover_lr_recipe.sql", "utf8");
assert.match(sql728, /lr_baseline smallint not null default 20/);
assert.match(sql728, /vendor 24\+3=27/);
assert.doesNotMatch(sql728, /کسان کا وسیلہ|Kisan ka Wasela/i);

assert.doesNotMatch(sql, /hwaiuwxqldxsoukkfefn|ktskwawkslaznkjjacni|supabase\.co/i);
assert.match(sql, /milk_dispatch_lines/);
assert.match(sql, /min_fat numeric\(5,2\) not null default 4\.1/);
assert.match(sql, /agribridge\.milk_handover_edit/);
assert.match(sql, /Raseed aa chuki hai/);
assert.doesNotMatch(sql, /کسان کا وسیلہ|Kisan ka Wasela/i);

const stub = `
create role anon;
create role authenticated;
create role service_role;
create schema if not exists auth;
create type public.user_role as enum ('owner','super_admin','admin','manager','milk_collection');
create or replace function public.fn_has_dept(p_roles public.user_role[])
returns boolean language sql stable as $$ select true $$;
create or replace function public.fn_is_any_staff()
returns boolean language sql stable as $$ select true $$;

create table public.profiles (
  id uuid primary key,
  role text,
  is_active boolean not null default true,
  branch_id uuid,
  full_name text
);
create table public.branches (
  id uuid primary key,
  name text not null,
  is_active boolean default true
);
create table public.shops (
  id uuid primary key,
  name text not null,
  code text,
  branch_id uuid,
  business_type text,
  is_active boolean default true
);
create table public.milk_dispatches (
  id uuid primary key default gen_random_uuid(),
  dispatch_date date not null default current_date,
  shift text not null default 'morning',
  branch_id uuid,
  vehicle_name text,
  driver_name text,
  dispatched_liters numeric(14,3) not null check (dispatched_liters > 0),
  fat_percentage numeric(5,2),
  snf_percentage numeric(5,2),
  received_liters numeric(14,3),
  received_at timestamptz,
  received_by uuid,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index milk_dispatch_one_per_shift on public.milk_dispatches (branch_id, dispatch_date, shift);
create or replace function public.fn_milk_dispatch_guard()
returns trigger language plpgsql as $$ begin return new; end $$;
create trigger trg_milk_dispatch_guard
  before insert or update on public.milk_dispatches
  for each row execute function public.fn_milk_dispatch_guard();

create table public.features (
  key text primary key,
  label text not null,
  label_en text,
  label_ur text,
  description text,
  description_en text,
  description_ur text,
  route text not null,
  icon text,
  is_sensitive boolean not null default false,
  is_active boolean not null default true
);
create table public.dashboards (
  key text primary key,
  label text not null default ''
);
insert into public.dashboards (key, label) values ('milk', 'Dairy');
create table public.dashboard_features (
  dashboard_key text not null,
  feature_key text not null references public.features(key),
  section text,
  section_order integer not null default 0,
  sort_order integer not null default 0,
  primary key (dashboard_key, feature_key)
);
create table public.role_feature_permissions (
  role text not null,
  feature_key text not null references public.features(key),
  actions text[] not null,
  data_scope text not null,
  primary key (role, feature_key)
);
create table public.feature_help (
  feature_key text not null references public.features(key),
  lang text not null,
  purpose text not null,
  who_uses text,
  when_use text,
  how_steps text[] not null default '{}',
  next_step text,
  mistakes text[] not null default '{}',
  related text[] not null default '{}',
  primary key (feature_key, lang)
);
insert into public.features (key, label, route) values ('milk-collection.dispatch', 'Rawangi', '/admin/milk-collection/dispatch');
insert into public.feature_help (feature_key, lang, purpose, how_steps, next_step)
values ('milk-collection.dispatch', 'rm', 'Dispatch', array['Miqdar aur gaari likhein.'], 'Pahunchne ke baad billing ka qadam.');
create table public.role_page_permissions (
  role text primary key,
  allowed_pages text[] not null default '{}'
);
insert into public.role_page_permissions (role, allowed_pages)
values ('milk_collection', array['/admin/milk-collection']);
`;

const db = new PGlite();
const run = (s) => db.exec(s);
const one = async (s) => (await db.query(s)).rows[0];
const num = (v) => Math.round(Number(v) * 1000) / 1000;

const BY = "00000000-0000-0000-0000-0000000000a1";
const OTHER = "00000000-0000-0000-0000-0000000000a2";
const BRANCH = "00000000-0000-0000-0000-0000000000b1";
const SHOP = "00000000-0000-0000-0000-0000000000c1";

await run(stub);
await run(sql);
await run(sql);
await run(sql728);
await run(sql728);
const baselineCol = await one(`select column_default from information_schema.columns where table_name = 'milk_dispatches' and column_name = 'lr_baseline'`);
assert.match(String(baselineCol.column_default), /20/);
const help = await one(`select array_to_string(how_steps, ' ') as steps from public.feature_help where feature_key = 'milk-collection.handover' and lang = 'rm'`);
assert.match(help.steps, /20°C/);
assert.match(help.steps, /22°C/);
assert.match(help.steps, /24\+3=27/);
const before = await one("select count(*)::int as n from public.milk_dispatches");
assert.equal(before.n, 0, "migration ne litre nahi bharne");
const specs = await one("select min_fat, min_lr, min_snf from public.milk_handover_specs");
assert.equal(Number(specs.min_fat), 4.1);
assert.equal(Number(specs.min_lr), 27);
assert.equal(Number(specs.min_snf), 8.4);
const pages = await one("select allowed_pages from public.role_page_permissions where role = 'milk_collection'");
assert.ok(pages.allowed_pages.includes("/admin/milk-collection/handover"));

await run(`
insert into public.profiles (id, role, is_active, branch_id, full_name) values
  ('${BY}', 'milk_collection', true, '${BRANCH}', 'Collector'),
  ('${OTHER}', 'owner', true, null, 'Owner');
insert into public.branches (id, name) values ('${BRANCH}', 'Main Branch Mahabali');
insert into public.shops (id, name, code, branch_id, business_type) values
  ('${SHOP}', 'Kisaan Milk Center', '02', '${BRANCH}', 'dairy');
`);

const lines = (rows) => `'${JSON.stringify(rows).replaceAll("'", "''")}'::jsonb`;
const save = (id, extraLines, accepted = null, reason = null) => `
select public.fn_save_milk_handover(
  '${BY}'::uuid,
  ${id ? `'${id}'::uuid` : "null"},
  '${BRANCH}'::uuid,
  '${SHOP}'::uuid,
  '2026-10-30'::date,
  'morning',
  '06:30'::time,
  'Kisaan Milk Center',
  null, null, null,
  ${accepted === null ? "null" : accepted ? "true" : "false"},
  ${reason == null ? "null" : `'${reason}'`},
  'Rep', null, 'Collector',
  ${lines(extraLines)}
)::text as id
`;

const below = [
  {
    chiller_no: "1",
    milk_type: "Cow",
    gross_volume_l: 100,
    fat_percentage: 3.8,
    lr: 26,
    snf_percentage: 8.1,
    adjusted_volume_l: null,
    temperature_c: 4,
    organo: "Normal",
  },
  {
    chiller_no: "2",
    milk_type: "Buffalo",
    gross_volume_l: 50.5,
    fat_percentage: 5,
    lr: 28,
    snf_percentage: 8.6,
    adjusted_volume_l: 52,
    temperature_c: 3.5,
    organo: "Normal",
  },
];

const created = await one(save(null, below));
const id = created.id;
const header = await one(`select dispatched_liters, fat_percentage, snf_percentage, mcc_name, accepted from public.milk_dispatches where id = '${id}'`);
assert.equal(num(header.dispatched_liters), 150.5);
assert.equal(header.mcc_name, "Kisaan Milk Center");
assert.equal(header.accepted, null);
const line1 = await one(`select ts_percentage, adjusted_volume_l, gross_volume_l from public.milk_dispatch_lines where dispatch_id = '${id}' and chiller_no = '1'`);
assert.equal(Number(line1.ts_percentage), 11.9);
assert.equal(line1.adjusted_volume_l, null, "adjusted khud nahi banta");
assert.equal(num(line1.gross_volume_l), 100);

let err = null;
try {
  await run(`update public.milk_dispatches set dispatched_liters = 10 where id = '${id}'`);
} catch (e) {
  err = e;
}
assert.ok(err, "seedha litre update band");
assert.match(String(err.message), /badli nahi ja sakti/);

const edited = [
  { ...below[0], gross_volume_l: 80, fat_percentage: 4.2, lr: 27, snf_percentage: 8.4 },
  below[1],
];
await run(save(id, edited, false, "sour smell"));
const after = await one(`select dispatched_liters, accepted, rejection_reason from public.milk_dispatches where id = '${id}'`);
assert.equal(num(after.dispatched_liters), 130.5);
assert.equal(after.accepted, false);
assert.equal(after.rejection_reason, "sour smell");

await run(`update public.milk_dispatches set received_liters = 130.5, received_at = now() where id = '${id}'`);
err = null;
try {
  await run(save(id, edited, true, null));
} catch (e) {
  err = e;
}
assert.ok(err);
assert.match(String(err.message), /Raseed aa chuki hai/);

await run(`
select public.fn_save_milk_handover(
  '${OTHER}'::uuid, '${id}'::uuid, '${BRANCH}'::uuid, null,
  '2026-10-30'::date, 'morning', null, null, null, null, 'note',
  true, null, 'Rep', 'Rep sign', 'Collector', null
)
`);
const decision = await one(`select accepted, dispatched_liters, rejection_reason from public.milk_dispatches where id = '${id}'`);
assert.equal(decision.accepted, true);
assert.equal(decision.rejection_reason, null);
assert.equal(num(decision.dispatched_liters), 130.5, "raseed ke baad litre nahi badla");

err = null;
try {
  await run(`update public.milk_dispatches set received_liters = 1 where id = '${id}'`);
} catch (e) {
  err = e;
}
assert.ok(err);
assert.match(String(err.message), /Raseed pehle darj/);

err = null;
try {
  await run(save(null, below));
} catch (e) {
  err = e;
}
assert.match(String(err.message), /pehle se darj hai/);

await run(rollback);
const gone = await one(`select to_regclass('public.milk_dispatch_lines') as t`);
assert.equal(gone.t, null);
const kept = await one(`select dispatched_liters from public.milk_dispatches where id = '${id}'`);
assert.equal(num(kept.dispatched_liters), 130.5, "rollback rawangi ka litre nahi mitata");

console.log("milk-handover sql: ok");
