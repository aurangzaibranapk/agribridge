import assert from "node:assert/strict";
import fs from "node:fs";

const sql = (n) => fs.readFileSync(new URL(`../supabase/migrations/${n}.sql`, import.meta.url), "utf8");
const s631 = sql("631_pos_server_price_and_refund");
const s632 = sql("632_orders_shift_counters");
const s633 = sql("633_party_money_guards");

assert.match(s631, /revoke all on function %s from public, anon, authenticated/);
assert.match(s631, /fn_pick_khata_account/);
assert.match(s631, /trg_pos_return_cash_cap/);
assert.match(s631, /security definer/);
assert.match(s631, /pos_discount_ok/);
assert.match(s631, /comment on table public.customer_ledger/i);
assert.match(s631, /create_pos_sale_base_504/);
for (const name of ["631_pos_server_price_and_refund", "632_orders_shift_counters", "633_party_money_guards"]) {
  assert.ok(fs.existsSync(new URL(`../supabase/migrations/${name}.rollback.sql`, import.meta.url)));
}

assert.match(s632, /fn_next_year_counter/);
assert.match(s632, /pending_verification/);
assert.match(s632, /fn_record_bridge_advance/);
assert.match(s632, /fn_agri_order_stage_guard/);
assert.match(s632, /requested_by/);
assert.match(s632, /pos_shift_shortage_reviews/);
assert.match(s632, /uq_journal_pos_shift_close/);
assert.match(s632, /grant execute on function public.fn_next_year_counter\(text, int\) to service_role/);

assert.match(s633, /fn_approve_party_settlement/);
assert.match(s633, /chk_settlement_maker_checker/);
assert.match(s633, /not valid/);
assert.match(s633, /fn_record_investor_investment/);
assert.match(s633, /fn_approve_investor_return/);
assert.match(s633, /fn_pay_shop_bill/);
assert.match(s633, /p_override boolean/);
assert.match(s633, /LIMIT_EXCEEDED/);
assert.match(s633, /fn_credit_request_guard/);
assert.ok(!/drop table public.customer_ledger/i.test(s631 + s633));

const docs = fs.readFileSync(new URL("../docs/data-fixes/2026-10-20-needs-owner-approval/README.md", import.meta.url), "utf8");
assert.match(docs, /NEEDS OWNER APPROVAL/);
for (const f of ["01-shift-26-00020.sql", "02-party-balances.sql", "03-duplicate-customers.sql", "04-finance-journals.sql"]) {
  const body = fs.readFileSync(new URL(`../docs/data-fixes/2026-10-20-needs-owner-approval/${f}`, import.meta.url), "utf8");
  assert.match(body, /NEEDS OWNER APPROVAL/);
  assert.ok(!/^\s*(update|delete|insert)\s/im.test(body), `${f} executable write`);
}

const record = fs.readFileSync(new URL("../docs/LIVE-DEPLOYMENT-RECORD.md", import.meta.url), "utf8");
assert.match(record, /631–633/);
assert.match(record, /NOT applied/);

console.log("review money sql: theek");
