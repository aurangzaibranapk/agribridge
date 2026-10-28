// 619 test (PGlite, live DB nahi): grants sakht + mark_sent sirf service_role.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const one = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
const throws = async (s, re) => { let err = null; try { await run(s); } catch (e) { err = e; } await run("reset role;"); assert.ok(err, s); if (re) assert.match(String(err.message), re); };
await run(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; grant usage on schema auth to public;
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
create function public.fn_phone_key(p text) returns text language sql immutable as $$
  select nullif(right(regexp_replace(coalesce(p,''), '\\D', '', 'g'), 10), '') $$;
create table profiles (id uuid primary key, role text, branch_id uuid, full_name text, phone_number text, is_active boolean default true);
create table staff_details (profile_id uuid, whatsapp_number text, whatsapp_verified_at timestamptz, department_key text);
create table farmers (id uuid primary key, user_id uuid, full_name text, phone text, branch_id uuid,
  phone_key text generated always as (right(regexp_replace(coalesce(phone,''), '\\D', '', 'g'), 10)) stored,
  is_deleted boolean default false, created_at timestamptz default now());
create table customers (id uuid primary key, user_id uuid, farmer_id uuid, branch_id uuid, name text, phone_number text,
  current_balance numeric default 0, credit_limit numeric, is_active boolean default true, is_deleted boolean default false);
create table admin_whatsapp_numbers (phone_key text, is_active boolean default true);
create table features (key text primary key, route text, is_active boolean default true);
create table user_feature_permissions (profile_id uuid, feature_key text, actions text[], starts_at timestamptz, expires_at timestamptz);
create view v_user_feature_access as select u.profile_id, f.key as feature_key, f.route, u.actions from user_feature_permissions u
  join features f on f.key = u.feature_key and f.is_active where (u.expires_at is null or u.expires_at > now());
create table pos_sales (customer_id uuid, total_amount numeric, status text, created_at timestamptz default now());
create table agri_orders (order_number text, grand_total numeric, status text, customer_id uuid, created_at timestamptz default now());
create table booking_campaigns (id uuid primary key, name text, crop text);
create table campaign_bookings (campaign_id uuid, farmer_id uuid, acres numeric, status text);
create table payment_promises (party_type text, party_id uuid, promised_amount numeric, promise_date date, status text);
create table whatsapp_submission_counters (year int primary key, last_number int not null default 0);
create table whatsapp_submissions (id uuid primary key default gen_random_uuid(), submission_number text not null unique, staff_profile_id uuid not null,
  branch_id uuid, whatsapp_number text not null, kind text not null check (kind in ('meter_opening','meter_closing','fuel','expense','cash_paid','cash_received','other')),
  raw_text text, ai_extracted jsonb, ai_summary text, original_amount numeric, status text default 'pending', manager_profile_id uuid, manager_comment text, created_at timestamptz default now());
create table farmer_product_demands (id uuid primary key default gen_random_uuid(), farmer_id uuid not null, branch_id uuid, product_name text not null,
  quantity numeric not null check (quantity > 0), unit text, needed_by date, notes text, status text, reviewed_by uuid, decided_by uuid,
  check (decided_by is null or reviewed_by is null or decided_by <> reviewed_by));
grant select, update on whatsapp_submissions, farmer_product_demands to authenticated;
`);
await run(`create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
-- 589/598/599 ke functions ke stubs (sirf signature; grants 619 jaanchta hai)
create function public.fn_broadcast_can_create(uuid) returns boolean language sql as $$ select true $$;
create function public.fn_broadcast_is_approver(uuid) returns boolean language sql as $$ select true $$;
create function public.fn_broadcast_guard() returns trigger language plpgsql as $$ begin return new; end $$;
create function public.fn_broadcast_recipient_guard() returns trigger language plpgsql as $$ begin return new; end $$;
create function public.fn_broadcast_audit_immutable() returns trigger language plpgsql as $$ begin return new; end $$;
create function public.fn_messaging_contactable(text) returns boolean language sql as $$ select true $$;`);
await run(fs.readFileSync("supabase/migrations/610_whatsapp_identity.sql", "utf8"));
for (const n of [614, 615, 616, 617]) await run(fs.readFileSync("supabase/migrations/" + fs.readdirSync("supabase/migrations").find((f) => f.startsWith(n + "_")), "utf8"));
const M = fs.readFileSync("supabase/migrations/619_messaging_security_grants.sql", "utf8");
assert.doesNotMatch(M.replace(/--.*$/gm, ""), /\bdrop\b|\btruncate\b|\bdelete\s+from\b/i, "619 additive");
await run(M);
const priv = (r, f) => one(`select has_function_privilege('${r}', '${f}', 'execute')`);
for (const f of ["public.fn_broadcast_guard()", "public.fn_broadcast_recipient_guard()", "public.fn_broadcast_audit_immutable()",
  "public.fn_wa_inbox_guard_submission()", "public.fn_wa_inbox_guard_demand()", "public.fn_messaging_contactable(text)",
  "public.fn_wa_inbox_mark_sent(uuid,boolean,text,text)"]) {
  assert.equal(await priv("anon", f), false, f); assert.equal(await priv("authenticated", f), false, f); assert.equal(await priv("service_role", f), true, f);
}
for (const f of ["public.fn_broadcast_can_create(uuid)", "public.fn_broadcast_is_approver(uuid)"]) {
  assert.equal(await priv("anon", f), false, f); assert.equal(await priv("authenticated", f), true, f + " (RLS ko chahiye)");
}
for (const f of ["public.fn_wa_inbox_prepare_send(uuid,text,text,text[],text)", "public.fn_wa_inbox_list(text,text,integer)", "public.fn_wa_inbox_can_see(uuid)"])
  assert.equal(await priv("authenticated", f), true, f + " UI ke liye rehna chahiye");
assert.match(String(await one(`select array_to_string(proconfig, ',') from pg_proc where proname = 'fn_broadcast_audit_immutable'`)), /search_path=public/);

// mark_sent: authenticated band, service_role chalaye; actor = ticket ka sent_by
const C = "c0000000-0000-0000-0000-000000000001", U = "a0000000-0000-0000-0000-000000000001", MID = "m0000000-0000-0000-0000-000000000001".replace("m", "d");
await run(`insert into wa_conversations (id, phone_key) values ('${C}', '3001234567');
  insert into wa_messages (id, conversation_id, direction, msg_type, body, sent_by, send_status) values ('${MID}', '${C}', 'out', 'text', 'Salam', '${U}', 'queued');`);
await throws(`select set_config('request.jwt.claim.sub','${U}',false); set role authenticated; select fn_wa_inbox_mark_sent('${MID}', true, 'wamid.x', null)`, /permission denied/);
await run(`reset role; select set_config('request.jwt.claim.sub','',false); select set_config('request.jwt.claim.role','service_role',false); set role service_role; select fn_wa_inbox_mark_sent('${MID}', true, 'wamid.x', null); reset role;`);
assert.equal(await one(`select send_status from wa_messages where id = '${MID}'`), "sent");
assert.equal(await one(`select actor_id::text from wa_conversation_events where conversation_id = '${C}' and event = 'sent'`), U);
await throws(`set role service_role; select fn_wa_inbox_mark_sent('${MID}', true, 'wamid.y', null)`, /ticket/);
const R = fs.readFileSync("supabase/rollbacks/619_messaging_security_grants.rollback.sql", "utf8");
assert.match(R, /fn_wa_inbox_mark_sent/); assert.match(R, /to authenticated/);
console.log("  ok  619 security grants (PGlite)");
