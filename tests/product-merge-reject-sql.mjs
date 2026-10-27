// 714: same-product merge reject updates the existing row. Live DB nahi. PGlite.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s) => (await db.query(s)).rows;
const fail = async (s) => {
  try {
    await db.exec("begin");
    await db.exec(s);
    await db.exec("commit");
    return null;
  } catch (e) {
    try { await db.exec("rollback"); } catch { /* aborted */ }
    return e;
  }
};

const SELF = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const REQ = "33333333-3333-4333-8333-333333333333";
const REQ2 = "44444444-4444-4444-8444-444444444444";
const REQ3 = "55555555-5555-4555-8555-555555555555";

const mig = fs.readFileSync("supabase/migrations/714_product_merge_reject_self.sql", "utf8");
const rb = fs.readFileSync("supabase/migrations/714_product_merge_reject_self.rollback.sql", "utf8");
const sqlBody = mig.replace(/--.*$/gm, "");
assert.match(sqlBody, /drop constraint if exists product_merge_requests_not_self/i);
assert.match(sqlBody, /status = 'rejected' or source_product_id <> target_product_id/);
assert.match(sqlBody, /not valid/i);
assert.doesNotMatch(sqlBody, /\b(insert|update|delete)\s+/i);
assert.match(rb, /check \(source_product_id <> target_product_id\)/i);

await run(`
create table public.product_merge_requests (
  id uuid primary key,
  source_product_id uuid not null,
  target_product_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
insert into public.product_merge_requests (id, source_product_id, target_product_id, status)
values ('${REQ}', '${SELF}', '${SELF}', 'pending');
alter table public.product_merge_requests
  add constraint product_merge_requests_not_self
  check (source_product_id <> target_product_id) not valid;
`);

const rejectSql = `
update public.product_merge_requests
   set status = 'rejected',
       review_notes = 'same product — reject',
       reviewed_at = now()
 where id = '${REQ}'
   and status = 'pending'
`;

const before = await fail(rejectSql);
assert.ok(before, "old NOT VALID check must still reject an UPDATE");
assert.match(
  String(before.message),
  /new row for relation "product_merge_requests" violates check constraint "product_merge_requests_not_self"/,
);
let row = (await q(`select id, status, review_notes from public.product_merge_requests`));
assert.equal(row.length, 1);
assert.equal(row[0].id, REQ);
assert.equal(row[0].status, "pending");
assert.equal(row[0].review_notes, null);

await run(mig);
await run(mig);

const approveBlocked = await fail(`
update public.product_merge_requests
   set status = 'approved', reviewed_at = now()
 where id = '${REQ}'
`);
assert.ok(approveBlocked, "approve of a self-merge must stay blocked");
assert.match(String(approveBlocked.message), /product_merge_requests_not_self/);
assert.equal((await q(`select status from public.product_merge_requests where id = '${REQ}'`))[0].status, "pending");

await run(rejectSql);
row = await q(`select id, status, review_notes, source_product_id = target_product_id as self from public.product_merge_requests`);
assert.equal(row.length, 1);
assert.equal(row[0].id, REQ);
assert.equal(row[0].status, "rejected");
assert.equal(row[0].review_notes, "same product — reject");
assert.equal(row[0].self, true);

const pendingInsert = await fail(`
insert into public.product_merge_requests (id, source_product_id, target_product_id, status)
values ('${REQ2}', '${SELF}', '${SELF}', 'pending')
`);
assert.ok(pendingInsert);
assert.match(String(pendingInsert.message), /product_merge_requests_not_self/);
assert.equal((await q(`select count(*)::int as n from public.product_merge_requests`))[0].n, 1);

await run(`
insert into public.product_merge_requests (id, source_product_id, target_product_id, status)
values ('${REQ3}', '${SELF}', '${OTHER}', 'pending')
`);
await run(`
update public.product_merge_requests
   set status = 'rejected', review_notes = 'different products'
 where id = '${REQ3}' and status = 'pending'
`);
const normal = (await q(`select status, review_notes from public.product_merge_requests where id = '${REQ3}'`))[0];
assert.equal(normal.status, "rejected");
assert.equal(normal.review_notes, "different products");

await run(rb);
const afterRollback = await fail(`
update public.product_merge_requests set review_notes = 'again' where id = '${REQ}'
`);
assert.ok(afterRollback, "rollback restores the update block on a self row");
assert.match(String(afterRollback.message), /product_merge_requests_not_self/);
assert.equal((await q(`select status from public.product_merge_requests where id = '${REQ}'`))[0].status, "rejected");

const action = fs.readFileSync("src/actions/product-merge.ts", "utf8");
const rejectFn = action.slice(action.indexOf("export async function rejectProductMerge"));
const approveFn = action.slice(
  action.indexOf("export async function approveProductMerge"),
  action.indexOf("export async function mergeProductDirect"),
);
assert.match(rejectFn, /\.from\("product_merge_requests"\)\s*\n?\s*\.update\(/);
assert.doesNotMatch(rejectFn, /\.insert\(/);
assert.match(rejectFn, /request\.status !== "pending"/);
assert.match(approveFn, /isSelfMerge\(/);
assert.match(approveFn, /SELF_MERGE_MSG/);
assert.doesNotMatch(approveFn, /product_merge_requests"\)\s*\n?\s*\.insert\(/);
const decide = fs.readFileSync("src/lib/pending/decide.ts", "utf8");
assert.match(decide, /ports\.rejectProductMerge\(f\)/);
assert.doesNotMatch(decide, /requestProductMerge|from\("product_merge_requests"\)/);

console.log("product-merge-reject-sql ok");
