import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/732_milk_chiller_day_total.sql", import.meta.url), "utf8");
const back = readFileSync(new URL("../supabase/migrations/732_milk_chiller_day_total.rollback.sql", import.meta.url), "utf8");

assert.match(sql, /create table if not exists public\.milk_chiller_totals/);
assert.match(sql, /milk_chiller_totals_one/);
assert.match(sql, /fn_is_any_staff/);
assert.match(sql, /fn_milk_chiller_total_guard/);
assert.match(back, /fn_milk_chiller_total_guard/);
assert.match(sql, /feature_key = 'milk-collection.chiller'/);
assert.match(sql, /8\.416/);
assert.doesNotMatch(sql, /wasila/i);
assert.match(back, /drop table if exists public\.milk_chiller_totals/);
assert.match(back, /Chiller — FAT/);

console.log("milk-chiller-total-sql ok");
