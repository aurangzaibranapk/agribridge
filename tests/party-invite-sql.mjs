// 698 party invite. PGlite. Live database nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const file = fs.readFileSync("supabase/migrations/698_party_invite.sql", "utf8");
const rollback = fs.readFileSync("supabase/migrations/698_party_invite.rollback.sql", "utf8");

assert.doesNotMatch(file, /ktskwawkslaznkjjacni|hwaiuwxqldxsoukkfefn/);
assert.doesNotMatch(file, /\bdelete\s+from\b/i);
assert.doesNotMatch(file, /al\s*rana|alranatraders/i);
assert.match(file, /party_invite_sends/);
assert.match(file, /content text not null/);
assert.match(file, /channel in \('whatsapp', 'email', 'sms'\)/);
assert.match(file, /status in \('sent', 'failed'\)/);
assert.match(file, /enable row level security/);
assert.match(file, /fn_party_invite_phone_taken/);
assert.match(file, /hr\.party-invite/);
assert.match(file, /'hr\.party-invite', 'rm'/);
assert.doesNotMatch(file, /farmer-signup|job_applications/);
console.log("  ok  698 file: additive, testing id nahi, brand nahi");

const db = new PGlite();
const run = (sql) => db.exec(sql);

await run(`
  create role anon;
  create role authenticated;
  create role service_role;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create table public.organizations (id uuid primary key);
  create table public.profiles (
    id uuid primary key,
    role text,
    is_active boolean default true,
    organization_id uuid,
    phone_number text,
    full_name text,
    branch_id uuid
  );
  create table public.branches (
    id uuid primary key,
    name text,
    organization_id uuid,
    is_active boolean default true
  );
  create table public.dealers (id uuid primary key default gen_random_uuid(), phone_number text, user_id uuid);
  create table public.buyers (id uuid primary key default gen_random_uuid(), phone_number text, user_id uuid);
  create table public.investors (id uuid primary key default gen_random_uuid(), phone_number text, user_id uuid);
  create table public.machinery_vendors (id uuid primary key default gen_random_uuid(), phone text, user_id uuid);
  create function public.fn_phone_key(p_phone text) returns text language sql immutable as $$
    select case
      when length(regexp_replace(coalesce(p_phone, ''), '\\D', '', 'g')) >= 10
      then right(regexp_replace(p_phone, '\\D', '', 'g'), 10)
      else null end
  $$;
  create function public.fn_login_accounts_for_phone(p_key text)
  returns table (user_id uuid, role text, source text, priority integer)
  language sql stable as $$
    select p.id, p.role, 'profile'::text, 1
      from public.profiles p
     where public.fn_phone_key(p.phone_number) = p_key and coalesce(p_key, '') ~ '^[0-9]{10}$'
  $$;
  create table public.features (
    key text primary key,
    label text,
    label_en text,
    label_ur text,
    description text,
    description_en text,
    description_ur text,
    route text,
    icon text,
    is_sensitive boolean,
    is_active boolean
  );
  create table public.dashboards (key text primary key);
  insert into public.dashboards (key) values ('hr'), ('admin');
  create table public.dashboard_features (
    dashboard_key text,
    feature_key text,
    section text,
    section_order int,
    sort_order int,
    primary key (dashboard_key, feature_key)
  );
  create table public.role_feature_permissions (
    role text,
    feature_key text,
    actions text[],
    data_scope text,
    primary key (role, feature_key)
  );
  create table public.feature_help (
    feature_key text,
    lang text,
    purpose text,
    who_uses text,
    when_use text,
    how_steps text[],
    next_step text,
    mistakes text[],
    primary key (feature_key, lang)
  );
`);

await run(file);
await run(file);
console.log("  ok  698 applies twice");

const org = "11111111-1111-4111-8111-111111111111";
const admin = "22222222-2222-4222-8222-222222222222";
const branch = "33333333-3333-4333-8333-333333333333";
await run(`insert into public.organizations (id) values ('${org}')`);
await run(`insert into public.profiles (id, role, is_active, organization_id, full_name) values ('${admin}', 'admin', true, '${org}', 'Admin')`);
await run(`insert into public.branches (id, name, organization_id) values ('${branch}', 'Mahabali', '${org}')`);

const account = "44444444-4444-4444-8444-444444444444";
await run(`
  insert into public.party_invite_accounts (
    id, organization_id, profile_id, party_role, party_table, party_id, full_name, phone, phone_key, email, branch_id, branch_name, created_by
  ) values (
    '${account}', '${org}', '${admin}', 'dealer', 'dealers', gen_random_uuid(),
    'Bilal Traders', '+92 301 7654321', '3017654321', 'bilal.traders@gmail.com', '${branch}', 'Mahabali', '${admin}'
  )
`);
const body = "AgriBridge (Kisan ka Wasela)\\nLogin OTP";
await run(`
  insert into public.party_invite_sends (account_id, organization_id, channel, recipient, content, status, error, sent_by)
  values ('${account}', '${org}', 'sms', '+92 301 7654321', '${body}', 'failed', 'SMS nahi ja saka: Veevo', '${admin}')
`);
const row = (await db.query(`select channel, recipient, content, status, error from public.party_invite_sends`)).rows[0];
assert.equal(row.channel, "sms");
assert.equal(row.status, "failed");
assert.match(row.content, /AgriBridge/);
assert.match(row.content, /Kisan ka Wasela/);
assert.match(row.error, /Veevo/);
console.log("  ok  timeline keeps full content and failure reason");

let rejected = false;
try {
  await run(`insert into public.party_invite_sends (account_id, organization_id, channel, recipient, status) values ('${account}', '${org}', 'sms', '+92', 'sent')`);
} catch {
  rejected = true;
}
assert.equal(rejected, true);
console.log("  ok  content is required");

const taken = (await db.query(`select public.fn_party_invite_phone_taken('3017654321') as t`)).rows[0].t;
const free = (await db.query(`select public.fn_party_invite_phone_taken('3000000000') as t`)).rows[0].t;
assert.equal(taken, true);
assert.equal(free, false);
console.log("  ok  phone taken");

const help = (await db.query(`select next_step from public.feature_help where feature_key = 'hr.party-invite' and lang = 'rm'`)).rows[0];
assert.match(help.next_step, /Dekhein/);
const perms = (await db.query(`select role from public.role_feature_permissions where feature_key = 'hr.party-invite' order by role`)).rows.map((r) => r.role);
assert.deepEqual(perms, ["admin", "owner", "super_admin"]);
console.log("  ok  feature help + admin only");

await run(rollback);
const left = (await db.query(`select to_regclass('public.party_invite_sends') as t`)).rows[0].t;
assert.equal(left, null);
console.log("  ok  rollback drops the tables");
console.log("party-invite sql ok");
