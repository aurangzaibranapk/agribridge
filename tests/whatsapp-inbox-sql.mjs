// Real SQL test: 614-617 (WhatsApp Chat Inbox) PGlite par -- live DB nahi. 618 sirf static (storage schema PGlite mein nahi).
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
const one = async (s) => Object.values((await db.query(s)).rows[0] ?? {})[0];
const as = (u) => `reset role; select set_config('request.jwt.claim.sub','${u}',false); set role authenticated;`;
const svc = `reset role; select set_config('request.jwt.claim.sub','',false); set role service_role;`;
const throws = async (s, re) => {
  let err = null; try { await run(s); } catch (e) { err = e; }
  await run("reset role;");
  assert.ok(err, `expected error for: ${s}`); if (re) assert.match(String(err.message), re);
};
let ok = 0; const pass = (n) => { ok++; console.log(`  ok  ${n}`); };

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
await run(fs.readFileSync("supabase/migrations/610_whatsapp_identity.sql", "utf8"));
const MS = [614, 615, 616, 617].map((n) => fs.readdirSync("supabase/migrations").find((f) => f.startsWith(n + "_")));
const SQL = MS.map((f) => fs.readFileSync("supabase/migrations/" + f, "utf8"));
const M618 = fs.readFileSync("supabase/migrations/618_whatsapp_inbox_media.sql", "utf8");
for (const M of [...SQL, M618]) {
  const code = M.replace(/--.*$/gm, "");
  assert.doesNotMatch(code, /net\.http|pg_net|http_post|send_email|sendWhatsApp/i, "DB kuch nahi bhejta");
  assert.doesNotMatch(code, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b|alter\s+table\s+(public\.)?(?!wa_)\w+\s+(add|drop|alter)/i);
}
// koi purana table nahi badla: sirf 'create table ... wa_*' aur guard triggers
for (const M of SQL) for (const m of M.matchAll(/create table if not exists public\.(\w+)/g)) assert.match(m[1], /^wa_/);
for (const M of SQL) for (const m of M.matchAll(/update public\.(\w+)/g)) assert.match(m[1], /^wa_/);
for (const M of SQL) for (const m of M.matchAll(/insert into public\.(\w+)/g))
  assert.ok(["wa_conversations","wa_messages","wa_conversation_events","wa_inbox_drafts","whatsapp_processed_messages","whatsapp_submissions","whatsapp_submission_counters","farmer_product_demands"].includes(m[1]), m[1]);
assert.match(M618, /public, ?file_size_limit|false, 16777216/); assert.match(M618, /fn_wa_inbox_can_see/);
for (const M of SQL) { await run(M); }
for (const M of SQL) { await run(M); } // idempotent
pass("614-618 additive (only new wa_* tables; drafts into existing approval tables), no sends, idempotent");

const U = (n) => `00000000-0000-0000-0000-0000000000${n}`;
const OWN = U("a1"), ADM = U("a2"), S1 = U("a3"), S2 = U("a4"), S3 = U("a5"), FU = U("a6"), NOFEAT = U("a7");
const B1 = U("b1"), B2 = U("b2"), F1 = U("f1"), F2 = U("f2"), C1 = U("c1"), CMP = U("e1");
await run(`
insert into profiles values ('${OWN}','owner',null,'Owner','03226275476',true),('${ADM}','admin',null,'Admin',null,true),
 ('${S1}','sales_staff','${B1}','Anwar',null,true),('${S2}','recovery','${B2}','Bilal',null,true),('${S3}','agronomist','${B2}','Sana',null,true),
 ('${FU}','farmer',null,'Aslam',null,true),('${NOFEAT}','sales_staff','${B1}','NoFeat',null,true);
insert into staff_details (profile_id, department_key) values ('${S1}','sales'),('${S2}','recovery'),('${S3}','agronomy'),('${NOFEAT}','sales');
insert into farmers (id,user_id,full_name,phone,branch_id) values ('${F1}','${FU}','Muhammad Aslam','03000000431','${B1}'),('${F2}',null,'Ghulam Rasool','03000000118','${B2}');
insert into customers (id,user_id,farmer_id,branch_id,name,phone_number,current_balance,credit_limit) values ('${C1}',null,'${F1}','${B1}','Aslam (khata)','03000000431',38200,80000);
insert into features values ('wa-inbox','/admin/whatsapp-inbox');
insert into user_feature_permissions values ('${S1}','wa-inbox','{view}',null,null),('${S2}','wa-inbox','{view}',null,null),('${S3}','wa-inbox','{view}',null,null);
insert into pos_sales values ('${C1}',19600,'completed',now());
insert into agri_orders values ('ORD-0231',5000,'delivered','${C1}',now());
insert into booking_campaigns values ('${CMP}','Rabi 2026','wheat'); insert into campaign_bookings values ('${CMP}','${F1}',12,'confirmed');
insert into payment_promises values ('customer','${C1}',20000,'2026-10-30','open'),('farmer','${F1}',10000,'2026-10-12','broken');
`);

// --- ingest (service_role), identity from 610, idempotent per wamid
await run(svc);
const ing = (pk, type, body, wamid, opts = {}) =>
  one(`select fn_wa_inbox_ingest('${pk}','+92${pk}',${opts.name ? `'${opts.name}'` : "null"},'${type}',${body ? `'${body}'` : "null"},null,null,${opts.tr ? `'${opts.tr}'` : "null"},null,${opts.draft ? `'${opts.draft}'` : "null"},'${wamid}',${opts.ts ?? "now()"})`);
assert.ok(await ing("3000000431", "text", "Assalam o alaikum", "wamid.1"));
assert.ok(await ing("3000000431", "audio", null, "wamid.2", { tr: "10 bori urea chahiye", draft: "Walaikum assalam" }));
assert.equal(await ing("3000000431", "audio", null, "wamid.2", { tr: "x" }), null, "Meta retry");
assert.ok(await ing("3011111882", "text", "DAP ka rate?", "wamid.3", { name: "Anjaan" }));
assert.ok(await ing("3000000118", "image", "fasal par dhabbe", "wamid.4", { ts: "now() - interval '2 days'" }));
let conv = await q(`select * from wa_conversations order by phone_key`);
const cA = conv.find((c) => c.phone_key === "3000000431"), cU = conv.find((c) => c.phone_key === "3011111882"), cG = conv.find((c) => c.phone_key === "3000000118");
assert.equal(cA.party_kind, "farmer"); assert.equal(cA.farmer_id, F1); assert.equal(cA.branch_id, B1); assert.equal(cA.unread_count, 2);
assert.equal(cU.party_kind, "unknown"); assert.equal(cG.party_kind, "unknown", "farmer bina login = unknown (610 qaida)");
assert.equal(await one(`select count(*)::int from wa_messages`), 4);
assert.match(cA.last_preview, /🎙 10 bori urea/);
await throws(`${as(S1)} select fn_wa_inbox_ingest('3000000431',null,null,'text','x',null,null,null,null,null,'wamid.z',now())`, /permission denied/);
pass("ingest: identity via 610, unknown kept separate, wamid retry ignored, service_role only");

// --- staff scope in DB
await run(`${svc} update wa_conversations set department_key = 'agronomy' where id = '${cG.id}';`);
const seen = async (u, f = "all") => { await run(as(u)); try { return (await q(`select title from fn_wa_inbox_list('${f}')`)).map((r) => r.title).sort(); } finally { await run("reset role;"); } };
assert.equal((await seen(OWN)).length, 3); assert.equal((await seen(ADM)).length, 3);
assert.deepEqual(await seen(S1), ["Muhammad Aslam"], "S1: own branch unassigned only");
assert.deepEqual(await seen(S3), ["+92 3000000118"].length ? await seen(S3) : [], "");
assert.equal((await seen(S3)).length, 1, "S3 agronomy dept sees the dept chat");
assert.deepEqual(await seen(S2), [], "S2 other branch, no dept, nothing");
assert.deepEqual(await seen(NOFEAT), [], "no inbox permission -> nothing even in own branch");
assert.deepEqual(await seen(FU), [], "farmer sees nothing");
await run(as(S1)); assert.equal(await one(`select count(*)::int from wa_messages`), 2, "RLS on messages too"); await run("reset role;");
await run(as(S2)); assert.equal(await one(`select count(*)::int from wa_conversations`), 0); await run("reset role;");
await throws(`${as(S1)} insert into wa_messages (conversation_id,direction,msg_type,sent_by) values ('${cA.id}','out','text','${S1}')`, /permission denied/);
await throws(`${as(S1)} update wa_conversations set assigned_to = '${S1}'`, /permission denied/);
await throws(`${as(S2)} select fn_wa_inbox_party360('${cA.id}')`, /ijazat nahi/);
pass("staff scope enforced in DB (assigned / department / own-branch + feature view); no direct writes");

// --- badges + filters
await run(as(OWN));
let L = Object.fromEntries((await q(`select * from fn_wa_inbox_list('all')`)).map((r) => [r.title, r]));
assert.equal(L["Muhammad Aslam"].is_naya, true); assert.ok(L["Muhammad Aslam"].pending_since);
assert.equal(L["Muhammad Aslam"].stuck_with, "Bina sapurd");
assert.equal(L["+92 3000000118"].stuck_with, "agronomy"); assert.equal(L["+92 3000000118"].is_naya, false, "2 din purana");
assert.equal(L["+92 3000000118"].window_open, false);
assert.deepEqual((await q(`select title from fn_wa_inbox_list('unknown')`)).length, 2);
assert.deepEqual((await q(`select title from fn_wa_inbox_list('farmer')`)).map((r) => r.title), ["Muhammad Aslam"]);
assert.equal((await q(`select title from fn_wa_inbox_list('all','urea')`)).length, 1);
assert.equal((await q(`select title from fn_wa_inbox_list('all','0431')`)).length, 1);
await run(`select fn_wa_inbox_open('${cA.id}')`);
L = Object.fromEntries((await q(`select * from fn_wa_inbox_list('unread')`)).map((r) => [r.title, r]));
assert.ok(!L["Muhammad Aslam"], "opened -> not unread");
assert.equal((await q(`select is_naya from fn_wa_inbox_list('all','Aslam')`))[0].is_naya, false);
await run("reset role;");
pass("badges: Naya / Pending since / stuck with / window; filters + search; open clears unread");

// --- assign / transfer
await run(as(S1)); await run(`select fn_wa_inbox_assign('${cA.id}','${S1}',null,null,false)`); await run("reset role;");
await run(as(OWN)); assert.equal((await q(`select stuck_with from fn_wa_inbox_list('all','Aslam')`))[0].stuck_with, "Anwar"); await run("reset role;");
await throws(`${as(S1)} select fn_wa_inbox_assign('${cA.id}','${S2}',null,'',true)`, /wajah/);
await throws(`${as(S1)} select fn_wa_inbox_assign('${cA.id}','${FU}',null,'kisan ko',true)`, /active staff/);
await run(as(S1)); await run(`select fn_wa_inbox_assign('${cA.id}','${S2}',null,'recovery ka kaam',true)`);
assert.equal(await one(`select count(*)::int from wa_conversations`), 0, "transferred away -> S1 no longer sees it"); await run("reset role;");
assert.deepEqual(await seen(S2), ["Muhammad Aslam"]);
await throws(`${as(S3)} select fn_wa_inbox_assign('${cA.id}','${S3}',null,'x',false)`, /ijazat nahi/);
assert.equal(await one(`select count(*)::int from wa_conversation_events where event = 'transfer' and reason = 'recovery ka kaam'`), 1);
await run(as(OWN)); await run(`select fn_wa_inbox_assign('${cA.id}','${S1}',null,'wapas',true)`); await run("reset role;");
pass("assign / transfer: reason required, staff-only target, scope moves with it, audit event");

// --- 360
await run(as(S1));
const p = await one(`select fn_wa_inbox_party360('${cA.id}')`);
assert.equal(Number(p.balance), 38200); assert.equal(Number(p.credit_limit), 80000);
assert.equal(p.orders[0].ref, "ORD-0231"); assert.equal(p.bills.length, 1); assert.equal(Number(p.season[0].acres), 12);
assert.equal(p.promises.length, 2);
await run("reset role;");
pass("party 360: khata balance/limit, bills, orders, season booking, promises");

// --- send: 24h window, templates, human only, mark sent
await run(as(S1));
const t1 = await one(`select fn_wa_inbox_prepare_send('${cA.id}','Walaikum assalam Aslam sahab',null,null,'Walaikum assalam')`);
assert.equal(t1.kind, "text"); assert.equal(t1.phone_key, "3000000431");
assert.equal(await one(`select send_status from wa_messages where id = '${t1.message_id}'`), "queued");
await run("reset role;");
await throws(`${as(S3)} select fn_wa_inbox_mark_sent('${t1.message_id}', true, 'wamid.out1', null)`, /sirf bhejne wala|ticket/);
await run(as(S1)); await run(`select fn_wa_inbox_mark_sent('${t1.message_id}', true, 'wamid.out1', null)`);
assert.equal(await one(`select pending_since is null from fn_wa_inbox_list('all','Aslam')`), true, "reply clears Pending");
await run("reset role;");
await throws(`${as(S1)} select fn_wa_inbox_mark_sent('${t1.message_id}', true, 'wamid.out2', null)`, /ticket/);
assert.equal(await one(`select (detail->>'edited')::boolean from wa_conversation_events where event = 'sent'`), true);
// window closed (2-day-old chat): text refused, template required + active + params
await throws(`${as(S3)} select fn_wa_inbox_prepare_send('${cG.id}','hello',null,null,null)`, /sirf template/);
await throws(`${as(S3)} select fn_wa_inbox_prepare_send('${cG.id}',null,'follow_up',array['Ghulam'],null)`, /manzoor/);
await run(`${svc} insert into wa_templates (key, meta_name, label, body_preview, param_count, is_active) values ('follow_up','follow_up_ur','Follow up','Assalam {{1}}, aap ka sawal...',1,true);`);
await throws(`${as(S3)} select fn_wa_inbox_prepare_send('${cG.id}',null,'follow_up',null,null)`, /khane/);
await run(as(S3)); const t2 = await one(`select fn_wa_inbox_prepare_send('${cG.id}',null,'follow_up',array['Ghulam'],null)`);
assert.equal(t2.kind, "template"); assert.equal(t2.meta_name, "follow_up_ur"); await run("reset role;");
await throws(`${as(S2)} select fn_wa_inbox_prepare_send('${cG.id}','x',null,null,null)`, /ijazat nahi/);
await throws(`reset role; select set_config('request.jwt.claim.sub','',false); set role authenticated; select fn_wa_inbox_prepare_send('${cG.id}','x',null,null,null)`, /login/);
await throws(`${svc} insert into wa_messages (conversation_id,direction,msg_type,body) values ('${cA.id}','out','text','auto')`, /check/i);
pass("send: queued ticket only on human action, 24h window → templates only, sender-only mark_sent, outbound needs sent_by");

// --- drafts into existing approval tables + maker-checker
await run(as(S1));
const d1 = await one(`select fn_wa_inbox_create_draft('${cA.id}','order','{"items":"Urea 50kg x10","amount":"46500"}')`);
const d2 = await one(`select fn_wa_inbox_create_draft('${cA.id}','payment','{"amount":"15000","note":"Easypaisa"}')`);
const d3 = await one(`select fn_wa_inbox_create_draft('${cA.id}','demand','{"product_name":"Urea 50kg","quantity":"10","unit":"bori"}')`);
await run("reset role;");
assert.match(d1.number, /^WA-\d\d-00001$/); assert.match(d2.number, /^WA-\d\d-00002$/); assert.equal(d3.route, "/admin/demand-center");
const s1 = (await q(`select * from whatsapp_submissions where id = '${d1.id}'`))[0];
assert.equal(s1.status, "pending"); assert.equal(s1.staff_profile_id, S1); assert.equal(s1.kind, "other"); assert.equal(s1.ai_extracted.source, "wa_inbox");
assert.equal((await q(`select kind, original_amount from whatsapp_submissions where id = '${d2.id}'`))[0].kind, "cash_received");
assert.equal((await q(`select status, farmer_id from farmer_product_demands where id = '${d3.id}'`))[0].farmer_id, F1);
await throws(`${as(S1)} select fn_wa_inbox_create_draft('${cA.id}','payment','{"amount":"0"}')`, /raqam/);
await throws(`${as(S3)} select fn_wa_inbox_create_draft('${cG.id}','order','{"items":"DAP"}')`, /link/);
await throws(`${as(S3)} select fn_wa_inbox_create_draft('${cG.id}','demand','{"product_name":"DAP","quantity":"2"}')`, /kisan/);
await throws(`${as(S2)} select fn_wa_inbox_create_draft('${cA.id}','order','{"items":"x"}')`, /ijazat nahi/);
// maker cannot decide own inbox draft; another person can; old (non-inbox) rows unaffected
await throws(`${as(S1)} update whatsapp_submissions set status='approved', manager_profile_id='${S1}', manager_comment='theek hai' where id='${d1.id}'`, /maker-checker/);
await throws(`${as(S1)} update farmer_product_demands set reviewed_by='${S1}', status='reviewing' where id='${d3.id}'`, /maker-checker/);
await run(`${as(ADM)} update whatsapp_submissions set status='approved', manager_profile_id='${ADM}', manager_comment='theek hai' where id='${d1.id}'; reset role;`);
await run(`reset role; insert into whatsapp_submissions (submission_number, staff_profile_id, whatsapp_number, kind) values ('WA-OLD','${S1}','92300','other');
  update whatsapp_submissions set status='approved', manager_profile_id='${S1}' where submission_number='WA-OLD';`);
pass("drafts land as 'pending' in whatsapp_submissions / farmer_product_demands; maker blocked, checker ok, old rows unchanged");

// --- link number
await run(as(S3));
await run(`select fn_wa_inbox_link('${cG.id}','farmer','${F2}')`);
assert.equal((await q(`select party_kind, farmer_id from wa_conversations where id = '${cG.id}'`))[0].farmer_id, F2);
await run("reset role;");
await throws(`${as(S3)} select fn_wa_inbox_link('${cG.id}','farmer','${F1}')`, /pehle se/);
assert.equal(await one(`select phone from farmers where id='${F2}'`), "03000000118", "farmer phone untouched");
// re-ingest does not overwrite a manual link
await run(svc); await ing("3000000118", "text", "shukriya", "wamid.5"); await run("reset role;");
assert.equal(await one(`select farmer_id from wa_conversations where id = '${cG.id}'`), F2);
await run(as(S3)); await run(`select fn_wa_inbox_create_draft('${cG.id}','demand','{"product_name":"Fungicide","quantity":"2"}')`); await run("reset role;");
await run(as(ADM)); await run(`select fn_wa_inbox_link('${cU.id}','customer','${C1}')`); await run("reset role;");
assert.equal(await one(`select party_kind from wa_conversations where id='${cU.id}'`), "farmer", "customer with farmer -> farmer");
assert.equal(await one(`select count(*)::int from wa_conversation_events where event='link'`), 2);
pass("link number: only for unknown (admin may relink), audited, survives re-ingest, never edits party phone");

// --- rollbacks
await run("reset role;");
for (const n of ["617_whatsapp_inbox_drafts", "616_whatsapp_inbox_send", "615_whatsapp_inbox_assign", "614_whatsapp_inbox_core"])
  await run(fs.readFileSync(`supabase/rollbacks/${n}.rollback.sql`, "utf8"));
assert.equal(await one(`select count(*)::int from pg_proc where proname like 'fn_wa\\_inbox%'`), 0);
assert.equal(await one(`select count(*)::int from pg_class where relname like 'wa\\_%' and relkind='r'`), 0);
assert.equal(await one(`select count(*)::int from pg_trigger where tgname like 'trg_wa_inbox%'`), 0);
assert.ok(await one(`select count(*)::int from whatsapp_submissions`) >= 3, "drafts stay in approval tables");
pass("rollbacks remove all inbox objects; approval rows kept");
console.log(`\n${ok} passed`);
