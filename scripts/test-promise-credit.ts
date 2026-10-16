import assert from "node:assert/strict";
import { pkr, rsPk, trustOf, nextBand, improvementSteps, promiseFormError, TERMS, TERMS_VERSION } from "../src/lib/recovery/credit-report";
import { mapCreditReport } from "../src/lib/recovery/credit-report-load";

// Pakistani (lakh) grouping
assert.equal(pkr(1622723), "16,22,723");
assert.equal(pkr(175200), "1,75,200");
assert.equal(pkr(999), "999");
assert.equal(pkr(12345678), "1,23,45,678");
assert.equal(pkr(-173990), "-1,73,990");
assert.equal(rsPk(null), "Rs —");
// trust categories
assert.equal(trustOf({ band: "platinum", defaultActive: false, state: "active" }), "trusted");
assert.equal(trustOf({ band: "gold", defaultActive: false, state: "active" }), "trusted");
assert.equal(trustOf({ band: "silver", defaultActive: false, state: "active" }), "watch");
assert.equal(trustOf({ band: "bronze", defaultActive: false, state: "active" }), "risky");
assert.equal(trustOf({ band: "platinum", defaultActive: true, state: "active" }), "default", "default beats band");
assert.equal(trustOf({ band: null, defaultActive: false, state: "score_building" }), "building");
// improvement
assert.deepEqual(nextBand(33), { band: "silver", label: "Silver", need: 8 });
assert.equal(nextBand(95), null);
const steps = improvementSteps({ score: 33, lateAmount: 173990, defaultActive: true, openPromise: true });
assert.ok(steps[0].includes("1,73,990"));
assert.ok(steps.some((s) => s.includes("12 mahine")));
// staff promise rules (verbal terms, 30 days)
assert.match(promiseFormError({ days: 15, isAdmin: false, termsAccepted: false })!, /Sharaait/);
assert.equal(promiseFormError({ days: 30, isAdmin: false, termsAccepted: true }), null);
assert.match(promiseFormError({ days: 31, isAdmin: false, termsAccepted: true })!, /30 din/);
assert.equal(promiseFormError({ days: 60, isAdmin: true, termsAccepted: true }), null);
assert.match(promiseFormError({ days: 0, isAdmin: true, termsAccepted: true })!, /1 ya zyada/);
assert.ok(TERMS.some((t) => /Default/.test(t)) && TERMS.some((t) => /udhaar fauran band/.test(t)));
assert.ok(TERMS_VERSION.length > 3);
// rpc mapping
const r = mapCreditReport("customer", { score: 33, band: "bronze", state: "active", default_active: true, kept: "1", broken: 2, promises: [{ date: "2026-10-30", amount: "173990", fulfilled: null, status: "open" }] })!;
assert.equal(r.kept, 1); assert.equal(r.promises[0].amount, 173990); assert.equal(r.promises[0].fulfilled, 0); assert.equal(r.defaultActive, true);
assert.equal(mapCreditReport("farmer", null), null);
console.log("PASS: promise + credit report helpers");
