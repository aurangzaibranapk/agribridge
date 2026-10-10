/** Branch (dealer/agri order) udhaar ki 30 din wali rok -- database nahi chhoota. npx tsx scripts/test-branch-credit-recovery.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { branchTxnsToLedger, computeBranchAging, isCreditBlocked, pkDate, DEFAULT_RECOVERY_SETTINGS as S } from "../src/lib/recovery/aging";

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log("ok -", name); };

t("pkDate: UTC raat 8 baje ke baad agla din (PKT)", () => {
  assert.equal(pkDate("2026-10-09T19:30:00Z"), "2026-10-10");
  assert.equal(pkDate("2026-10-09T18:59:00Z"), "2026-10-09");
});

t("order_charge = debit; advance/adjustment/refund = credit; manfi ulta", () => {
  const l = branchTxnsToLedger([
    { transaction_type: "order_charge", amount: 1000, created_at: "2026-08-01T05:00:00Z" },
    { transaction_type: "advance_payment", amount: 200, created_at: "2026-08-02T05:00:00Z" },
    { transaction_type: "refund", amount: 50, created_at: "2026-08-03T05:00:00Z" },
    { transaction_type: "order_charge", amount: -100, created_at: "2026-08-04T05:00:00Z" },
    { transaction_type: "adjustment", amount: -30, created_at: "2026-08-05T05:00:00Z" },
    { transaction_type: "something_else", amount: 999, created_at: "2026-08-05T05:00:00Z" },
  ]);
  assert.deepEqual(l.map((x) => [x.debit, x.credit]), [[1000, 0], [0, 200], [0, 50], [0, 100], [30, 0]]);
});

t("FIFO: purana order pehle chukta; 30+ din baqi = rok", () => {
  const a = computeBranchAging([
    { transaction_type: "order_charge", amount: 50000, created_at: "2026-08-15T05:00:00Z" },
    { transaction_type: "order_charge", amount: 20000, created_at: "2026-10-01T05:00:00Z" },
    { transaction_type: "advance_payment", amount: 30000, created_at: "2026-09-01T05:00:00Z" },
  ], "2026-10-10");
  assert.equal(a.balance, 40000);
  assert.equal(a.oldestUnpaidDate, "2026-08-15");
  assert.equal(a.bucket30plus, 20000);
  assert.equal(a.bucket0to15, 20000);
  assert.equal(isCreditBlocked(a, S), true);
});

t("purana order poora chuk gaya -> rok nahi", () => {
  const a = computeBranchAging([
    { transaction_type: "order_charge", amount: 50000, created_at: "2026-08-15T05:00:00Z" },
    { transaction_type: "advance_payment", amount: 50000, created_at: "2026-09-01T05:00:00Z" },
    { transaction_type: "order_charge", amount: 20000, created_at: "2026-10-01T05:00:00Z" },
  ], "2026-10-10");
  assert.equal(a.oldestDays, 9);
  assert.equal(isCreditBlocked(a, S), false);
});

t("advance zyada (branch ka paisa jama) -> rok nahi", () => {
  const a = computeBranchAging([
    { transaction_type: "advance_payment", amount: 90000, created_at: "2026-07-01T05:00:00Z" },
    { transaction_type: "order_charge", amount: 50000, created_at: "2026-07-15T05:00:00Z" },
  ], "2026-10-10");
  assert.equal(isCreditBlocked(a, S), false);
});

t("block default ON (523 + DEFAULT)", () => {
  assert.equal(S.block_overdue_credit, true);
  const sql = readFileSync("supabase/migrations/523_receivables_30day_recovery.sql", "utf8");
  assert.match(sql, /block_overdue_credit boolean not null default true/);
  assert.match(sql, /add column if not exists branch_id uuid/);
  assert.match(sql, /function public\.fn_branch_credit_aging/);
});

t("dealer/agri order ke chaaron raaste rok se guzarte hain", () => {
  const src = readFileSync("src/actions/agri-orders.ts", "utf8");
  for (const ctx of ["agri_order_create", "branch_agri_order_create", "agri_order_finance_verify", "agri_order_admin_approve_all"]) {
    assert.ok(src.includes(`context: "${ctx}"`), ctx);
  }
  assert.equal((src.match(/credit_override_reason/g) ?? []).length, 4);
});

console.log(`\n${n} tests pass`);
