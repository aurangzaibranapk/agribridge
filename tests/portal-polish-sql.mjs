// Real SQL test: 581 (Portal & Dairy sidebar) PGlite par -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const q = async (s) => (await db.query(s)).rows;
// 104 + 174 + label/description columns (wahi shakal jo live par hai)
await db.exec(`
create table public.dashboards (key text primary key, label text not null, icon text, summary text, sort_order int not null default 100, is_active boolean not null default true,
  created_at timestamptz not null default now(), label_en text, label_ur text, description text, description_en text, description_ur text);
create table public.features (key text primary key, label text not null, label_en text, label_ur text, description text, description_en text, description_ur text,
  route text, icon text, is_sensitive boolean default false, is_active boolean default true);
create table public.dashboard_features (dashboard_key text not null references dashboards(key) on delete cascade, feature_key text not null references features(key) on delete cascade,
  sort_order int not null default 100, section text, section_order int not null default 0, primary key (dashboard_key, feature_key));
create table public.user_feature_permissions (profile_id uuid, feature_key text, actions text[]);
insert into dashboards (key, label, sort_order) values ('milk', 'Milk & Dairy', 90), ('crm', 'CRM', 200);
-- koi pehle se maujood row: badli nahi jani chahiye
insert into features (key, label, route, icon) values ('dairy.admin', 'Owner ka apna naam', '/admin/dairy', 'Droplet');
`);
const M = fs.readFileSync("supabase/migrations/581_sidebar_portal_dairy.sql", "utf8");
await db.exec(M);
await db.exec(M); // idempotent
let ok = 0; const pass = (n) => { ok++; console.log(`  ok  ${n}`); };

const dash = await q(`select key, label_en, label_ur, sort_order, is_active from dashboards where key = 'portal-dairy'`);
assert.equal(dash.length, 1); assert.equal(dash[0].label_en, "Portal & Dairy"); assert.ok(dash[0].label_ur); assert.equal(dash[0].is_active, true);
pass("new 'Portal & Dairy' dashboard, next to Milk (sort 95)");

const feats = await q(`select key, route, icon, is_sensitive, is_active from features order by key`);
const byKey = Object.fromEntries(feats.map((f) => [f.key, f]));
assert.equal(byKey["customer-portal.admin"].route, "/admin/customer-portal");
assert.equal(byKey["dairy.breeding"].route, "/admin/dairy/breeding");
assert.equal(byKey["customer-portal.accounts"].route, "/admin/customer-portal?f=on");
for (const k of ["customer-portal.admin", "customer-portal.accounts", "dairy.breeding"]) assert.equal(byKey[k].is_sensitive, true, k);
pass("features for the 3 admin pages (+ Portal Accounts filter), all sensitive");

assert.equal(byKey["dairy.admin"].icon, "Droplet"); 
assert.equal((await q(`select label from features where key='dairy.admin'`))[0].label, "Owner ka apna naam");
pass("existing rows are never updated (on conflict do nothing)");

const links = await q(`select feature_key, section, section_order, sort_order from dashboard_features where dashboard_key = 'portal-dairy' order by section_order, sort_order`);
assert.deepEqual(links.map((l) => l.feature_key), ["customer-portal.admin", "customer-portal.accounts", "dairy.admin", "dairy.breeding"]);
assert.deepEqual([...new Set(links.map((l) => l.section))], ["Portal", "Dairy"]);
assert.equal((await q(`select count(*)::int n from dashboard_features`))[0].n, 4, "no rows in other dashboards");
pass("4 menu rows in two sections, same order as the mockup");

assert.equal((await q(`select count(*)::int n from user_feature_permissions`))[0].n, 0);
pass("no permission grants -- only roles that already open the pages see them");

const routes = ["/admin/customer-portal", "/admin/dairy", "/admin/dairy/breeding"];
for (const r of routes) assert.ok(fs.existsSync(`src/app${r}/page.tsx`), r);
pass("every route is a real page");

console.log(`\nportal-polish-sql: ${ok} passed`);
