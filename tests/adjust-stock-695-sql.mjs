// 695: fn_adjust_stock enum/uuid cast fix. Sirf LOCAL Postgres (AS_PGHOST/AS_PGPORT); na mile to SQL skip.
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const mig = fs.readFileSync("supabase/migrations/695_adjust_stock_movement_type_fix.sql", "utf8");
const rb = fs.readFileSync("supabase/migrations/695_adjust_stock_movement_type_fix.rollback.sql", "utf8");
const code = mig.replace(/--.*$/gm, "");
assert.ok(!/\b(drop\s+table|drop\s+column|delete\s+from|truncate)/i.test(code), "695 additive");
assert.match(code, /\)::public\.stock_movement_type/);
assert.equal((code.match(/nullif\(p_client_action, ''\)::uuid/g) ?? []).length, 2);
assert.match(code, /grant execute on function public\.fn_adjust_stock[^;]*to service_role/);
assert.match(rb, /create or replace function public\.fn_adjust_stock/);

const HOST = process.env.AS_PGHOST ?? "/var/run/postgresql";
const PORT = process.env.AS_PGPORT ?? "5432";
if (!(HOST.startsWith("/") || HOST === "localhost" || HOST === "127.0.0.1")) { console.error("Sirf local Postgres."); process.exit(1); }
const DB = "adjust695_test";
const psql = (sql, db = DB) => {
  const r = spawnSync("psql", ["-h", HOST, "-p", PORT, "-U", "postgres", "-d", db, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
};
if (!psql("select 1", "postgres").ok) { console.log("adjust-stock-695-sql: static ok; local Postgres nahi -- SQL skip"); process.exit(0); }
psql(`drop database if exists ${DB}`, "postgres");
assert.ok(psql(`create database ${DB}`, "postgres").ok);
let r = psql(fs.readFileSync("tests/sql/adjust-stock-695-stub.sql", "utf8"));
assert.ok(r.ok, r.err);
const A = "00000000-0000-0000-0000-000000000001", INV = "00000000-0000-0000-0000-000000000002";
const CA = "00000000-0000-0000-0000-0000000000aa";
const seed = `insert into profiles values ('${A}','owner',true); insert into inventory(id,product_id,warehouse_id,quantity_on_hand) values ('${INV}',gen_random_uuid(),gen_random_uuid(),10);`;
const call = `select fn_adjust_stock('${INV}','decrease',3,'${A}','t','${CA}',null)->>'already';`;
// Pehle (672 body) ye fail hota tha:
r = psql(rb + seed + call);
assert.ok(!r.ok && /stock_movement_type|uuid/.test(r.err), "purana body fail hona chahiye: " + r.err);
r = psql(mig + mig);
assert.ok(r.ok, "migration 2 dafa: " + r.err);
r = psql(call); assert.ok(r.ok, r.err); assert.equal(r.out, "false");
r = psql(call); assert.ok(r.ok, r.err); assert.equal(r.out, "true", "client_action dedupe");
r = psql(`select fn_adjust_stock('${INV}','increase',2,'${A}',null,'',5)->>'cost'; select movement_type from stock_movements order by created_at, movement_type;`);
assert.ok(r.ok, r.err); assert.match(r.out, /^10\.00\nadjustment_decrease\nadjustment_increase$/);
r = psql(rb); assert.ok(r.ok, "rollback: " + r.err);
psql(`drop database if exists ${DB}`, "postgres");
console.log("adjust-stock-695-sql: ok");
