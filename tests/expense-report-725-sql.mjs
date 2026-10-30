// 725: kharchon ki report — feature aur madad. Koi kharcha ya journal nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const mig = fs.readFileSync("supabase/migrations/725_expense_report_help.sql", "utf8");
const rb = fs.readFileSync("supabase/migrations/725_expense_report_help.rollback.sql", "utf8");
const page = fs.readFileSync("src/app/admin/reports/expenses/page.tsx", "utf8");
const route = fs.readFileSync("src/app/admin/reports/expenses/export/route.ts", "utf8");
const code = mig.replace(/--.*$/gm, "");

assert.match(code, /'kharche\.report'/);
assert.match(code, /'\/admin\/reports\/expenses'/);
assert.match(code, /array\['view','export'\]/);
assert.match(code, /'manager', 'kharche\.report'/);
assert.match(code, /'own_branch'/);
assert.doesNotMatch(code, /sales_staff/);
assert.match(code, /'kharche\.report', 'rm'/);
assert.match(code, /'kharche\.report', 'en'/);
assert.match(code, /'kharche\.report', 'ur'/);
assert.doesNotMatch(code, /\b(drop|alter)\b/i);
assert.doesNotMatch(code, /company_expense_requests/);
assert.doesNotMatch(code, /journal_/);
assert.match(rb, /delete from public\.features where key = 'kharche\.report'/);
assert.match(page, /loadFilteredExpenses/);
assert.match(page, /khr_missing_shop/);
assert.match(route, /expenseCsv/);
assert.match(route, /kharche\.report/);
assert.equal(/wasila|wasela/i.test(page + route + mig), false);

const kharche = fs.readFileSync("src/app/admin/kharche/page.tsx", "utf8");
assert.match(kharche, /\/admin\/reports\/expenses/);
assert.match(kharche, /KharcheClient/);

const db = new PGlite();
await db.exec(`
  create table public.dashboards (key text primary key, label text not null);
  insert into public.dashboards (key, label) values ('finance', 'Finance'), ('reports', 'Reports');
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
  create table public.role_feature_permissions (
    role text not null,
    feature_key text not null references public.features(key) on delete cascade,
    actions text[] not null,
    data_scope text not null,
    primary key (role, feature_key)
  );
  create table public.dashboard_features (
    dashboard_key text not null references public.dashboards(key),
    feature_key text not null references public.features(key) on delete cascade,
    section text,
    section_order int not null default 0,
    sort_order int not null default 100,
    primary key (dashboard_key, feature_key)
  );
  create table public.feature_help (
    feature_key text not null references public.features(key) on delete cascade,
    lang text not null,
    purpose text not null,
    who_uses text,
    when_use text,
    how_steps text[] not null default '{}',
    next_step text,
    mistakes text[] not null default '{}',
    primary key (feature_key, lang)
  );
`);
await db.exec(mig);
const feature = await db.query("select route, is_sensitive from public.features where key = 'kharche.report'");
assert.equal(feature.rows[0].route, "/admin/reports/expenses");
assert.equal(feature.rows[0].is_sensitive, true);
const perms = await db.query("select role, data_scope from public.role_feature_permissions where feature_key = 'kharche.report' order by role");
assert.deepEqual(perms.rows.map((r) => r.role), ["admin", "finance", "manager", "owner", "super_admin"]);
assert.equal(perms.rows.find((r) => r.role === "manager").data_scope, "own_branch");
assert.equal(perms.rows.find((r) => r.role === "finance").data_scope, "all");
const help = await db.query("select lang from public.feature_help where feature_key = 'kharche.report' order by lang");
assert.deepEqual(help.rows.map((r) => r.lang), ["en", "rm", "ur"]);
await db.exec(rb);
const gone = await db.query("select count(*)::int as n from public.features where key = 'kharche.report'");
assert.equal(gone.rows[0].n, 0);

console.log("expense-report-725-sql: ok");
