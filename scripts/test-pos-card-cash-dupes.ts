/**
 * fix/pos-card-cash-dupes -- pure unit + wiring tests (koi database nahi).
 *     npm run test:pos-card-cash
 *
 * Live (19 Oct 2026, read-only) se mili teen baatein:
 *  1. Waseela Card ke bill (3C711691 Rs 230, 761F19F1 Rs 30) ka paisa
 *     pos_sales.cash_paid mein -- "Naqad aaya" phoola hua.
 *  2. Mujahid Abbas ke Rs 230 ke do bilkul ek jaise bill 24 second ke farq se.
 *  3. Shift 13-16 Oct: cash sale 1,870, expected 370 -- farq = 1,500 naqad
 *     udhaar (6 entries). Formula sahi hai; yahan pin kiya gaya hai.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateCheckoutTotals, saleSignature, findRecentDuplicate, DUPLICATE_SALE_MARKER, DUPLICATE_WINDOW_SECONDS } from "../src/lib/pos/checkout-guards";
import { createSubmitGate, runOnce, createCheckoutKey, isDuplicateSaleError, duplicateSaleMessage } from "../src/lib/pos/checkout-submit";
import { buildSaleCashIndex, saleCash } from "../src/lib/pos/sale-cash";
import { aggregateShiftCash } from "../src/lib/pos/shift-cash";

let n = 0;
const pending: Promise<void>[] = [];
function test(name: string, fn: () => void | Promise<void>) {
  const run = Promise.resolve().then(fn).then(() => { n++; console.log(`ok  ${name}`); });
  pending.push(run);
}

// ---- 1. card-as-cash ------------------------------------------------------
test("Waseela Card only bill: cashOnly 0, nonKhataPaid 230", () => {
  const r = validateCheckoutTotals({ items: [{ quantity: 1, unit_price: 230 }], cashPaid: 230, khataAmount: 0, paymentLines: [{ method: "waseela_card", amount: 230 }] });
  assert.ok(r.ok); if (r.ok) { assert.equal(r.cashOnly, 0); assert.equal(r.nonKhataPaid, 230); }
});
test("split cash 100 + card 50 + khata 80: cashOnly 100", () => {
  const r = validateCheckoutTotals({ items: [{ quantity: 1, unit_price: 230 }], cashPaid: 150, khataAmount: 80, paymentLines: [{ method: "cash", amount: 100 }, { method: "waseela_card", amount: 50 }, { method: "khata", amount: 80 }] });
  assert.ok(r.ok); if (r.ok) { assert.equal(r.cashOnly, 100); assert.equal(r.nonKhataPaid, 150); assert.equal(r.khata, 80); }
});
test("plain cash bill unchanged: cashOnly == nonKhataPaid", () => {
  const r = validateCheckoutTotals({ items: [{ quantity: 2, unit_price: 50 }], cashPaid: 100, khataAmount: 0, paymentLines: [{ method: "cash", amount: 100 }] });
  assert.ok(r.ok); if (r.ok) assert.equal(r.cashOnly, r.nonKhataPaid);
});
test("easypaisa/bank/jazzcash/qr/card never counted as cash", () => {
  for (const m of ["easypaisa", "bank_transfer", "jazzcash", "qr", "card"]) {
    const r = validateCheckoutTotals({ items: [{ quantity: 1, unit_price: 99 }], cashPaid: 99, khataAmount: 0, paymentLines: [{ method: m, amount: 99 }] });
    assert.ok(r.ok); if (r.ok) assert.equal(r.cashOnly, 0, m);
  }
});
test("posCheckout writes p_cash_paid from cashOnly (not nonKhataPaid)", () => {
  const src = readFileSync("src/actions/pos.ts", "utf8");
  assert.match(src, /p_cash_paid:\s*totals\.cashOnly/);
  assert.doesNotMatch(src, /p_cash_paid:\s*totals\.nonKhataPaid/);
});
test("report naqad: payment-detail cash lines, legacy fallback to cash_paid", () => {
  const idx = buildSaleCashIndex([
    { sale_id: "card", payment_method: "waseela_card", amount: 230 },
    { sale_id: "mix", payment_method: "cash", amount: 100 },
    { sale_id: "mix", payment_method: "easypaisa", amount: 50 },
    { sale_id: "mix", payment_method: "khata", amount: 80 },
  ]);
  assert.equal(saleCash({ id: "card", cash_paid: 230 }, idx), 0);
  assert.equal(saleCash({ id: "mix", cash_paid: 150 }, idx), 100);
  assert.equal(saleCash({ id: "old", cash_paid: 70 }, idx), 70);
});
test("sales report + meri-dukan use saleCash, not raw cash_paid", () => {
  for (const f of ["src/app/admin/reports/sales/page.tsx", "src/app/admin/reports/sales/meri-dukan/page.tsx"]) {
    const src = readFileSync(f, "utf8");
    assert.match(src, /saleCash\(/, f);
    assert.doesNotMatch(src, /Number\((s|x)\.cash_paid \?\? 0\)/, f);
  }
});

// ---- 2. double submit -----------------------------------------------------
const mujahid = { customerId: "559bac8d", total: 230, items: [{ product_id: "60720a57", quantity: 1, unit_price: 230 }] };
test("Mujahid case: same bill 24s later is a duplicate", () => {
  const prev = { ...mujahid, id: "0516b948", createdAt: "2026-10-16T14:24:02Z" };
  assert.equal(findRecentDuplicate(mujahid, [prev], new Date("2026-10-16T14:24:26Z"))?.id, "0516b948");
});
test("same bill after the window is NOT a duplicate", () => {
  const prev = { ...mujahid, id: "a", createdAt: "2026-10-16T14:00:00Z" };
  assert.equal(findRecentDuplicate(mujahid, [prev], new Date(Date.parse("2026-10-16T14:00:00Z") + (DUPLICATE_WINDOW_SECONDS + 1) * 1000)), null);
});
test("different customer / qty / price is NOT a duplicate", () => {
  const now = new Date("2026-10-16T14:24:26Z");
  const at = "2026-10-16T14:24:02Z";
  assert.equal(findRecentDuplicate(mujahid, [{ ...mujahid, customerId: "other", id: "a", createdAt: at }], now), null);
  assert.equal(findRecentDuplicate(mujahid, [{ ...mujahid, items: [{ ...mujahid.items[0], quantity: 2 }], total: 460, id: "b", createdAt: at }], now), null);
  assert.equal(findRecentDuplicate(mujahid, [{ ...mujahid, items: [{ ...mujahid.items[0], unit_price: 220 }], id: "c", createdAt: at }], now), null);
});
test("item order does not matter for the signature", () => {
  const a = { customerId: null, total: 30, items: [{ product_id: "x", quantity: 1, unit_price: 10 }, { product_id: "y", quantity: 2, unit_price: 10 }] };
  const b = { ...a, items: [...a.items].reverse() };
  assert.equal(saleSignature(a), saleSignature(b));
});
test("submit gate: two fast clicks run checkout once", async () => {
  const gate = createSubmitGate();
  let calls = 0;
  const fn = async () => { calls++; await new Promise((r) => setTimeout(r, 20)); return "ok"; };
  const [a, b] = await Promise.all([runOnce(gate, fn), runOnce(gate, fn)]);
  assert.equal(calls, 1); assert.equal(a, "ok"); assert.equal(b, undefined); assert.equal(gate.busy, false);
  await runOnce(gate, fn); assert.equal(calls, 2);
});
test("submit gate re-opens after an error", async () => {
  const gate = createSubmitGate();
  await assert.rejects(runOnce(gate, async () => { throw new Error("net"); }));
  assert.equal(gate.busy, false);
});
test("checkout key: same key on retry, new key after reset", () => {
  let i = 0; const k = createCheckoutKey(() => `k${++i}`);
  assert.equal(k.current(), "k1"); assert.equal(k.current(), "k1");
  k.reset(); assert.equal(k.current(), "k2");
});
test("duplicate error marker round-trip", () => {
  const e = `${DUPLICATE_SALE_MARKER} Bilkul aisa hi bill`;
  assert.ok(isDuplicateSaleError(e)); assert.ok(!isDuplicateSaleError("Bikri nahi ho saki."));
  assert.equal(duplicateSaleMessage(e), "Bilkul aisa hi bill");
});
test("POS client wiring: gate, idempotency key, offline allowDuplicate, server replay", () => {
  const c = readFileSync("src/components/pos/pos-client.tsx", "utf8");
  assert.match(c, /runOnce\(submitGate, runCheckout\)/);
  assert.match(c, /clientActionId: checkoutKey\.current\(\)/);
  assert.match(c, /checkoutKey\.reset\(\)/);
  assert.match(c, /clientActionId: action\.client_action_id, allowDuplicate: true/);
  const s = readFileSync("src/actions/pos.ts", "utf8");
  assert.match(s, /findSaleByClientAction\(clientActionId/);
  assert.match(s, /findDuplicateSale\(/);
  // DB-level guard already exists (504): unique client_action_id on pos_sales.
  const m = readFileSync("supabase/migrations/504_fix_create_pos_sale_ambiguity.sql", "utf8");
  assert.match(m, /client_action_id/);
});

// ---- 3. expected cash -----------------------------------------------------
test("shift SHIFT-26-00019 (13-16 Oct) live numbers -> expected 370", () => {
  const s = aggregateShiftCash(
    0,
    [{ total_amount: 7055, khata_amount: 4735 }],
    [{ payment_method: "cash", amount: 1870 }, { payment_method: "easypaisa", amount: 220 }, { payment_method: "waseela_card", amount: 230 }, { payment_method: "khata", amount: 4735 }],
    [],
    [],
    [100, 100, 100, 100, 1000, 100].map((cr) => ({ debit: 0, credit: cr })),
    []
  );
  assert.equal(s.cashSalesTotal, 1870);
  assert.equal(s.digitalTotal, 450);
  assert.equal(s.udhaarGivenCashTotal, 1500);
  assert.equal(s.expectedCash, 370);
});
test("expected cash ignores card even when cash_paid was inflated", () => {
  const s = aggregateShiftCash(0, [{ total_amount: 230, khata_amount: 0 }], [{ payment_method: "waseela_card", amount: 230 }], []);
  assert.equal(s.cashSalesTotal, 0); assert.equal(s.expectedCash, 0);
});
test("SHIFT-26-00022 (18 Oct): 730 + 220 cash - 700 naqad udhaar = 250", () => {
  const s = aggregateShiftCash(730, [{ total_amount: 590, khata_amount: 340 }],
    [{ payment_method: "cash", amount: 220 }, { payment_method: "waseela_card", amount: 30 }, { payment_method: "khata", amount: 340 }], [], [],
    [{ debit: 0, credit: 500 }, { debit: 0, credit: 200 }], []);
  assert.equal(s.expectedCash, 250);
});

Promise.all(pending).then(() => console.log(`\n${n} tests passed`)).catch((e) => { console.error(e); process.exit(1); });
