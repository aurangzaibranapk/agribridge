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
assert.match(sql, /source is null or source in \('web','pwa','whatsapp','biometric','correction','offline','leave','app'\)/);
assert.match(back, /source = ANY \(ARRAY\['web','pwa','whatsapp','biometric','correction','offline','leave'\]\)/);
assert.doesNotMatch(sql, /source in \('web', 'whatsapp', 'leave', 'app'\)/);
assert.match(sql, /snf_alert_low/);
assert.doesNotMatch(sql, /923\d{9}|truncate|drop table/i);
assert.match(back, /drop table if exists public\.mobile_sync_inbox/);
assert.match(readFileSync("src/app/admin/my-work/support-dashboard/page.tsx", "utf8"), /mobile_app/);
assert.match(readFileSync("apps/mobile/signing/keystore.properties.example", "utf8"), /storePassword=\n/);
assert.doesNotMatch(readFileSync("apps/mobile/plugins/withPlaySigning.js", "utf8"), /BEGIN [A-Z ]*PRIVATE KEY/);

const merchant = readFileSync("supabase/migrations/20261029075433_merchant_guarantee_commission_settlement.sql", "utf8");
assert.match(merchant, /create table if not exists public\.merchant_commission_rules/);
assert.match(merchant, /commission_snapshot_at/);
assert.match(merchant, /fn_admin_approve_order_guarantee/);
assert.match(merchant, /fn_apply_milk_qist_payment/);
assert.match(merchant, /on conflict \(order_id\) do nothing/);
assert.match(merchant, /milk_payment_id uuid not null unique/);
assert.doesNotMatch(merchant, /truncate|delete from public\./i);

const merchantRead = readFileSync("supabase/migrations/20261029080741_merchant_mobile_read_api.sql", "utf8");
const merchantOrders = readFileSync("supabase/migrations/20261029080852_merchant_mobile_orders_api.sql", "utf8");
assert.match(merchantRead, /fn_my_merchant_settlements/);
assert.match(merchantOrders, /fn_my_merchant_orders/);
assert.match(merchantRead, /dealer','supplier/);
assert.doesNotMatch(merchantRead + merchantOrders, /truncate|delete from public\./i);

console.log("mobile sql proposal ok");
