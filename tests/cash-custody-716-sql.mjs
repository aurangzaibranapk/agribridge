import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/716_pos_cash_custody_chain.sql", "utf8");
const rollback = readFileSync("supabase/migrations/716_pos_cash_custody_chain.rollback.sql", "utf8");

assert.match(sql, /cash_custody_packets/);
assert.match(sql, /cash_custody_hops/);
assert.match(sql, /staff_copy_number/);
assert.match(sql, /deposit_copy_number/);
assert.match(sql, /fn_cash_custody_staff_confirm/);
assert.match(sql, /fn_cash_custody_mark_wasoli/);
assert.match(sql, /opened_at < now\(\) - interval '1 day'/);
assert.match(sql, /alerted_at < now\(\) - interval '1 day'/);
assert.match(sql, /POS cash 1 din se jama nahi/);
assert.match(sql, /enable row level security/);
assert.match(sql, /fn_cash_custody_visible/);
assert.doesNotMatch(sql, /using \(public\.fn_is_any_staff\(\)\)/);
assert.match(sql, /'cash-custody', 'rm'/);
assert.match(sql, /'cash-custody', 'en'/);
assert.match(sql, /submitted_by/);
assert.match(sql, /revoke all on function/);
assert.doesNotMatch(sql, /yasir|customer ledger|2030/i);

assert.match(rollback, /drop table if exists public.cash_custody_packets/);
assert.match(rollback, /drop column if exists custody_packet_id/);
assert.match(rollback, /cron.unschedule/);

const handover = readFileSync("src/actions/cash-handover.ts", "utf8");
const receive = handover.slice(handover.indexOf("export async function receiveCash"));
assert.match(receive, /to_profile_id !== user\.id/);
assert.doesNotMatch(receive, /canRecordHandoverReceipt/);
assert.doesNotMatch(receive, /custody_packet/);

console.log("716 sql checks passed");
