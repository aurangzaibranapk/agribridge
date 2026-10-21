// 694: migration 2 dafa chale, sent_to_assistant + support_ticket_id, rollback saaf. Sirf LOCAL Postgres.
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
const mig = fs.readFileSync("supabase/migrations/694_data_health_assistant.sql", "utf8");
const rb = fs.readFileSync("supabase/migrations/694_data_health_assistant.rollback.sql", "utf8");
const HOST = process.env.SC_PGHOST ?? "/var/run/postgresql";
const PORT = process.env.SC_PGPORT ?? "5432";
if (!(HOST.startsWith("/") || HOST === "localhost" || HOST === "127.0.0.1")) { console.error("Sirf local Postgres."); process.exit(1); }
const DB = "dh694_test";
const psql = (sql, db = DB) => {
  const r = spawnSync("psql", ["-h", HOST, "-p", PORT, "-U", process.env.SC_PGUSER ?? "postgres", "-d", db, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
};
if (!psql("select 1", "postgres").ok) { console.log("dh-694-sql: local Postgres nahi mila -- SQL skip"); process.exit(0); }
psql(`drop database if exists ${DB}`, "postgres");
assert.ok(psql(`create database ${DB}`, "postgres").ok);
let r = psql(`
create table profiles (id uuid primary key);
create table support_tickets (id uuid primary key, ticket_no bigint);
create table data_health_findings (id uuid primary key default gen_random_uuid(), title text not null, resolved_by uuid references profiles(id), resolved_at timestamptz,
  status text not null default 'open' check (status in ('open', 'sent_to_claude', 'dismissed', 'resolved')));
insert into support_tickets values ('00000000-0000-0000-0000-000000000001', 412);
insert into data_health_findings (id, title) values ('00000000-0000-0000-0000-0000000000a1','x'),('00000000-0000-0000-0000-0000000000a2','y');`);
assert.ok(r.ok, r.err);
r = psql(mig + "\n" + mig); assert.ok(r.ok, "2 dafa: " + r.err);
r = psql(`update data_health_findings set status='sent_to_assistant', support_ticket_id='00000000-0000-0000-0000-000000000001' where title='x'`); assert.ok(r.ok, r.err);
r = psql(`update data_health_findings set support_ticket_id='00000000-0000-0000-0000-000000000001' where title='y'`); assert.ok(!r.ok, "ek ticket do masle nahi");
assert.ok(!psql(`update data_health_findings set status='bogus'`).ok);
assert.ok(psql(`update data_health_findings set status='sent_to_claude' where title='y'`).ok, "Claude status bhi chalta hai");
r = psql(rb); assert.ok(r.ok, r.err);
assert.equal(psql(`select status from data_health_findings where title='x'`).out, "open");
assert.equal(psql(`select count(*) from information_schema.columns where table_name='data_health_findings' and column_name='support_ticket_id'`).out, "0");
psql(`drop database if exists ${DB}`, "postgres");
console.log("dh-694-sql ok");
