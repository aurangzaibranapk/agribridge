/** 538: udhaar rok + waada ka khalis hisaab. npx tsx scripts/test-overdue-policy.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluatePosition, promiseRuleError, mapCreditPosition, limitLabel, addDaysIso } from "../src/lib/recovery/credit-position";
import { blockMessage } from "../src/lib/recovery/aging";

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log("ok -", name); };
const base = { balance: 2870, openDebits: [{ date: "2026-09-12", amount: 2870 }], asOf: "2026-10-16", globalDays: 30 };

t("Aurangzaib: 34 din, hadd 30 -> band; teen adad", () => {
  const p = evaluatePosition(base);
  assert.equal(p.blocked, true); assert.equal(p.oldestDays, 34);
  assert.equal(p.kulBaqaya, 2870); assert.equal(p.lateAmount, 2870); assert.equal(p.bahaliAmount, 2870);
  assert.equal(p.limitSource, "global");
});
t("Apni hadd 45 din -> chalu", () => {
  const p = evaluatePosition({ ...base, partyDays: 45 });
  assert.equal(p.blocked, false); assert.equal(p.lateAmount, 0); assert.equal(p.limitSource, "party"); assert.equal(p.bahaliAmount, 0);
});
t("Late sirf purana hissa: naya udhaar late nahi", () => {
  const p = evaluatePosition({ ...base, balance: 5000, openDebits: [{ date: "2026-09-01", amount: 1000 }, { date: "2026-10-10", amount: 4000 }] });
  assert.equal(p.kulBaqaya, 5000); assert.equal(p.lateAmount, 1000); assert.equal(p.bahaliAmount, 1000);
});
t("Chhoot: koi hadd nahi; muddat guzarne par wapas band", () => {
  assert.equal(evaluatePosition({ ...base, exempt: true }).blocked, false);
  assert.equal(evaluatePosition({ ...base, exempt: true, exemptUntil: "2026-12-31" }).limitSource, "exempt");
  assert.equal(evaluatePosition({ ...base, exempt: true, exemptUntil: "2026-10-01" }).blocked, true);
});
t("Khula waada: udhaar chalu; tareekh guzri to band", () => {
  const open = evaluatePosition({ ...base, promise: { date: "2026-10-31", amount: null, fulfilled: 0, status: "open" } });
  assert.equal(open.promiseState, "open"); assert.equal(open.blocked, false);
  const broken = evaluatePosition({ ...base, promise: { date: "2026-10-15", amount: 2000, fulfilled: 0, status: "open" } });
  assert.equal(broken.promiseState, "broken"); assert.equal(broken.blocked, true); assert.equal(broken.lateAmount, 2870);
});
t("Toota waada nayi raqam ko bhi late banata hai (hadd se pehle)", () => {
  const p = evaluatePosition({ ...base, openDebits: [{ date: "2026-10-05", amount: 2870 }], promise: { date: "2026-10-12", amount: 1500, fulfilled: 0, status: "open" } });
  assert.equal(p.lateAmount, 1500); assert.equal(p.blocked, true); assert.equal(p.bahaliAmount, 1500);
});
t("Waada poora / baqaya 0 -> fulfilled", () => {
  assert.equal(evaluatePosition({ ...base, promise: { date: "2026-10-01", amount: 1000, fulfilled: 1000, status: "open" } }).promiseState, "fulfilled");
  assert.equal(evaluatePosition({ ...base, balance: 0, openDebits: [], promise: { date: "2026-10-01", amount: null, fulfilled: 0, status: "open" } }).blocked, false);
});
t("Rok band setting / min raqam", () => {
  assert.equal(evaluatePosition({ ...base, blockEnabled: false }).blocked, false);
  assert.equal(evaluatePosition({ ...base, minAmount: 5000 }).blocked, false);
});
t("Staff waada usool", () => {
  assert.equal(promiseRuleError({ isAdmin: false, days: 15, hasOpenPromise: false, lastBroken: false }), null);
  assert.match(promiseRuleError({ isAdmin: false, days: 31, hasOpenPromise: false, lastBroken: false })!, /30 din/);
  assert.match(promiseRuleError({ isAdmin: false, days: 7, hasOpenPromise: true, lastBroken: false })!, /khula/);
  assert.match(promiseRuleError({ isAdmin: false, days: 7, hasOpenPromise: false, lastBroken: true })!, /sirf Admin/);
  assert.equal(promiseRuleError({ isAdmin: true, days: 60, hasOpenPromise: false, lastBroken: true }), null);
  assert.ok(promiseRuleError({ isAdmin: true, days: 0, hasOpenPromise: false, lastBroken: false }));
});
t("Paighaam mein asal hadd ke din", () => {
  assert.match(blockMessage("Aurangzaib", 2870, 34, 45), /45 din ki hadd/);
  assert.match(blockMessage("Aurangzaib", 2870, 34), /30 din ki hadd/);
  assert.match(blockMessage("Aurangzaib", 2870, 34, 30), /wajah likh kar ijazat/);
});
t("RPC row map + label + tareekh", () => {
  const p = mapCreditPosition({ kul_baqaya: "2870", late_amount: "2870", bahali_amount: "2870", oldest_days: 34, limit_days: 30, limit_source: "global", exempt: false, promise_state: null, blocked: true })!;
  assert.equal(p.kulBaqaya, 2870); assert.equal(p.blocked, true);
  assert.equal(limitLabel(p), "30 din · aam setting");
  assert.equal(mapCreditPosition(null), null);
  assert.equal(addDaysIso("2026-10-16", 15), "2026-10-31");
});
t("Migration 538: additive + trigger message wajah wala + admin-only RPC", () => {
  const sql = readFileSync("supabase/migrations/538_overdue_credit_policy.sql", "utf8");
  assert.doesNotMatch(sql, /drop table|drop column|truncate/i);
  assert.match(sql, /fn_customer_credit_position/);
  assert.match(sql, /wajah likh kar ijazat/);
  assert.match(sql, /'owner','super_admin','admin'/);
  assert.match(sql, /coalesce\(v_state,''\) <> 'open'/);
});
t("POS: window.prompt hata, dialog laga", () => {
  const src = readFileSync("src/components/pos/pos-client.tsx", "utf8");
  assert.doesNotMatch(src, /window\.prompt\(result\.error/);
  assert.match(src, /OverdueCreditDialog/);
});
console.log(`\n${n} tests passed`);
