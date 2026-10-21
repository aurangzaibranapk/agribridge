import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/698_mobile_phase1.sql", "utf8");
const back = readFileSync("supabase/migrations/698_mobile_phase1.rollback.sql", "utf8");

assert.match(sql, /create table if not exists public\.mobile_sync_inbox/);
assert.match(sql, /enable row level security/);
assert.match(sql, /grant select on public\.mobile_sync_inbox to authenticated/);
assert.doesNotMatch(sql, /for insert/);
assert.match(sql, /'mobile_app'/);
assert.match(sql, /audio\/mp4/);
assert.match(sql, /field_app_role/);
assert.match(sql, /'app'/);
assert.match(sql, /snf_alert_low/);
assert.doesNotMatch(sql, /923\d{9}|truncate|drop table/i);
assert.match(back, /drop table if exists public\.mobile_sync_inbox/);
assert.match(readFileSync("src/app/admin/my-work/support-dashboard/page.tsx", "utf8"), /mobile_app/);
assert.match(readFileSync("apps/mobile/signing/keystore.properties.example", "utf8"), /storePassword=\n/);
assert.doesNotMatch(readFileSync("apps/mobile/plugins/withPlaySigning.js", "utf8"), /BEGIN [A-Z ]*PRIVATE KEY/);

console.log("mobile sql proposal ok");
